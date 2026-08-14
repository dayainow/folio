'use client';

import { useState, useCallback, useEffect, useEffectEvent, useMemo, useRef, memo, type CSSProperties, type KeyboardEvent, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { saveJournal, saveJournalWithFallback, loadJournalsWithFallback, getAllTags, type JournalEntry } from '@/lib/journal';
import { loadTasksWithFallback } from '@/lib/board';
import { readObsidianMarkdownFiles } from '@/lib/obsidian';
import { appendIntakeHistory, buildIntakeCandidates, intakeFingerprintsFromTagSets, intakeTags } from '@/lib/intake';
import { createJournalEntryKey } from '@/lib/personal-assistant';
import { TagCloud, buildTagCounts } from '@/components/tag-cloud';
import { setToastRetryHandler, showAppToast } from '@/lib/health-monitor';
import {
  downloadText,
  filterJournalsByRange,
  journalsFilename,
  journalsToMarkdown,
} from '@/lib/export';
import { JournalEditor } from '@/components/journal-editor';
import { useCollabUser } from '@/hooks/use-collab-user';
import { useSwipe } from '@/hooks/use-swipe';
import { editorHeightFromViewport, useVisualViewport } from '@/hooks/use-visual-viewport';
import { subscribeMobileAction } from '@/lib/mobile-actions';
import { publishActivity } from '@/lib/activity-stream';
import { getOrCreateGuestId } from '@/lib/presence';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  s.setDate(s.getDate() + 6);
  return s;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function parseTags(input: string): string[] {
  return input.split(',').map(s => s.trim()).filter(Boolean);
}

function joinTags(tags: string[]): string {
  return tags.join(', ');
}

export const JournalPanel = memo(function JournalPanel({
  focusDate,
  onFocusHandled,
  onDraftChange,
  writingFirst = false,
}: {
  focusDate?: string | null;
  onFocusHandled?: () => void;
  /** 우측 사이드바 미리보기 연동 */
  onDraftChange?: (date: string, content: string) => void;
  /** 글쓰기 우선: 에디터 확대 · 보조 패널 접기 */
  writingFirst?: boolean;
} = {}) {
  const collabUser = useCollabUser();
  const [date, setDate] = useState(todayStr);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [boardTagSources, setBoardTagSources] = useState<Array<{ tags: string[] }>>([]);

  type Day = { date: string; content: string; tags: string[] };
  const [days, setDays] = useState<Record<string, Day>>({});
  const [entryKey, setEntryKey] = useState(todayStr);
  const [draft, setDraft] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [ready, setReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [notifyOnSave, setNotifyOnSave] = useState(false);
  const [hasNotifyChannel, setHasNotifyChannel] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateSwipeRef = useRef<HTMLDivElement>(null);
  const saveFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoNotifyAt = useRef(0);
  const autoNotifyKey = useRef('');
  const notifyOnSaveRef = useRef(notifyOnSave);
  const hasNotifyChannelRef = useRef(hasNotifyChannel);
  notifyOnSaveRef.current = notifyOnSave;
  hasNotifyChannelRef.current = hasNotifyChannel;
  const vv = useVisualViewport();
  const mobileEditorPx = editorHeightFromViewport(vv, 200);

  const selectDate = useCallback((nextRef: string, map?: Record<string, Day>) => {
    // 날짜 이탈 전 현재 초안을 days·local에 반영 (자동저장 대기 없이 유지)
    const leavingTags = parseTags(tagsInput);
    const base = map ?? days;
    const merged: Record<string, Day> = {
      ...base,
      [entryKey]: { date, content: draft, tags: leavingTags },
    };

    if (nextRef !== entryKey && (draft.trim() || leavingTags.length > 0 || Boolean(days[entryKey]))) {
      void saveJournalWithFallback(date, draft, leavingTags, entryKey);
    }

    const direct = merged[nextRef];
    const nextDate = direct?.date ?? nextRef;
    const nextKey = direct
      ? nextRef
      : Object.entries(merged)
          .filter(([, day]) => day.date === nextDate)
          .sort((a, b) => b[0].localeCompare(a[0]))[0]?.[0] ?? nextDate;
    const next = merged[nextKey];
    setDays(merged);
    setEntryKey(nextKey);
    setDate(nextDate);
    setDraft(next?.content ?? '');
    setTagsInput(joinTags(next?.tags ?? []));
    setTagDraft('');
  }, [date, draft, tagsInput, days, entryKey]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [entries, tasks] = await Promise.all([
        loadJournalsWithFallback(),
        loadTasksWithFallback().catch(() => []),
      ]);
      if (cancelled) return;
      const map: Record<string, Day> = {};
      for (const k in entries) map[k] = { date: entries[k].date, content: entries[k].content, tags: entries[k].tags };
      const today = todayStr();
      const todayKey = Object.entries(map)
        .filter(([, day]) => day.date === today)
        .sort((a, b) => b[0].localeCompare(a[0]))[0]?.[0] ?? today;
      setDays(map);
      setBoardTagSources(tasks.map(t => ({ tags: t.tags })));
      setDate(today);
      setEntryKey(todayKey);
      setDraft(map[todayKey]?.content ?? '');
      setTagsInput(joinTags(map[todayKey]?.tags ?? []));
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!focusDate || !ready) return;
    const handle = window.setTimeout(() => {
      selectDate(focusDate);
      onFocusHandled?.();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [focusDate, ready, selectDate, onFocusHandled]);

  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  useEffect(() => {
    onDraftChangeRef.current?.(date, draft);
  }, [date, draft]);

  useEffect(() => {
    void import('@/lib/notify-client').then(({ fetchIntegrationsStatus }) =>
      fetchIntegrationsStatus().then(s => {
        setHasNotifyChannel(s.slack || s.discord);
      }),
    );
  }, []);

  useEffect(() => {
    return () => {
      if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
    };
  }, []);

  const currentTags = useMemo(() => parseTags(tagsInput), [tagsInput]);

  const addTags = useCallback((incoming: string[]) => {
    if (incoming.length === 0) return;
    setTagsInput(prev => {
      const existing = parseTags(prev);
      const next = [...existing];
      for (const raw of incoming) {
        const tag = raw.trim();
        if (!tag) continue;
        if (!next.some(t => t.toLowerCase() === tag.toLowerCase())) {
          next.push(tag);
        }
      }
      return joinTags(next);
    });
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTagsInput(prev => joinTags(parseTags(prev).filter(t => t !== tag)));
  }, []);

  const commitTagDraft = useCallback(() => {
    const parts = parseTags(tagDraft);
    if (parts.length === 0) {
      if (tagDraft.includes(',')) setTagDraft('');
      return;
    }
    addTags(parts);
    setTagDraft('');
  }, [tagDraft, addTags]);

  const handleTagDraftChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.includes(',')) {
      const parts = parseTags(value);
      const endsWithComma = value.trimEnd().endsWith(',');
      if (parts.length > 0) {
        addTags(endsWithComma ? parts : parts.slice(0, -1));
        setTagDraft(endsWithComma ? '' : parts[parts.length - 1] ?? '');
        return;
      }
      setTagDraft('');
      return;
    }
    setTagDraft(value);
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTagDraft();
      return;
    }
    if (e.key === 'Backspace' && tagDraft === '' && currentTags.length > 0) {
      e.preventDefault();
      removeTag(currentTags[currentTags.length - 1]!);
    }
  };

  const save = useCallback(async (opts?: { notify?: boolean }) => {
    const tags = parseTags(tagsInput);
    if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
    setSaveState('saving');
    setSaveError(null);
    setDays(prev => ({ ...prev, [entryKey]: { date, content: draft, tags } }));
    try {
      saveJournal(date, draft, tags, entryKey);
      setSaveState('saved');
      void import('@/lib/push-notifications').then(({ showFolioPush }) =>
        showFolioPush({
          title: '일지 저장 완료',
          body: `${date} 일지가 저장되었습니다.`,
          url: `/?tab=journal&date=${encodeURIComponent(date)}`,
          tag: 'journal-save',
        }),
      );
      saveFeedbackTimer.current = setTimeout(() => setSaveState('idle'), 2000);
      void publishActivity({
        type: 'save',
        actorId: collabUser?.id ?? getOrCreateGuestId(),
        actorName: collabUser?.name || collabUser?.email?.split('@')[0] || '게스트',
        targetKind: 'journal',
        targetId: date,
        summary: `일지 저장 · ${date}`,
      });
      void saveJournalWithFallback(date, draft, tags, entryKey)
        .then((result) => {
          if (result.usedFallback) {
            setSaveState('error');
            setSaveError('클라우드/Beacon 동기화에 실패했지만 로컬에는 저장되었습니다.');
            showAppToast('원격 동기화 실패 · 로컬에는 저장됨', { withRetry: true });
          } else {
            void import('@/lib/beacon-timeline-consent').then(({ recordFolioTimelineEvent }) =>
              recordFolioTimelineEvent({
                title: `일지 저장 · ${date}`,
                type: 'journal_save',
                category: 'journal',
              }),
            );
          }
        })
        .catch(() => {
          setSaveState('error');
          setSaveError('클라우드/Beacon 동기화에 실패했지만 로컬에는 저장되었습니다.');
          showAppToast('원격 동기화 실패 · 로컬에는 저장됨', { withRetry: true });
        });
    } catch {
      setSaveState('error');
      setSaveError('저장에 실패했습니다. 다시 시도해 주세요.');
      showAppToast('일지 저장에 실패했습니다', { withRetry: true });
      saveFeedbackTimer.current = setTimeout(() => setSaveState('idle'), 2500);
      return;
    }

    if (!opts?.notify || !hasNotifyChannel) return;

    const preview = draft.trim().slice(0, 120).replace(/\s+/g, ' ');
    try {
      await import('@/lib/notify-client').then(({ notifyChannels }) =>
        notifyChannels(
          `📓 Folio 일지 저장 · ${date}${preview ? `\n${preview}${draft.trim().length > 120 ? '…' : ''}` : ''}`,
          {
            deepLink: { tab: 'journal', date },
            actionLabel: '확인',
            body: `*일지 저장 완료*\n• 날짜: \`${date}\`${preview ? `\n• 미리보기: ${preview}${draft.trim().length > 120 ? '…' : ''}` : ''}`,
          },
        ),
      );
    } catch {
      /* 알림 실패는 저장 UX를 막지 않음 */
    }
  }, [date, draft, tagsInput, hasNotifyChannel, collabUser, entryKey]);

  useEffect(() => {
    setToastRetryHandler(() => {
      void save({ notify: notifyOnSave });
    });
    return () => setToastRetryHandler(null);
  }, [save, notifyOnSave]);

  // P44 — FAB 빠른 저장 / 새 일지(오늘)
  const onMobileAction = useEffectEvent((action: { type: string }) => {
    if (action.type === 'save') {
      void save({ notify: notifyOnSaveRef.current });
      return;
    }
    if (action.type === 'new-journal') {
      selectDate(todayStr());
    }
  });
  useEffect(() => subscribeMobileAction(onMobileAction), []);

  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      const tags = parseTags(tagsInput);
      void saveJournalWithFallback(date, draft, tags, entryKey)
        .then((result) => {
          setDays(prev => ({ ...prev, [entryKey]: { date, content: draft, tags } }));
          if (result.usedFallback) {
            setSaveState('error');
            setSaveError('자동 저장: 원격 동기화 실패 · 로컬에는 저장됨');
            showAppToast('일지 자동 저장 동기화 실패', { withRetry: true });
            return;
          }
          if (!hasNotifyChannelRef.current || !notifyOnSaveRef.current) return;
          if (!draft.trim()) return;
          const key = `${date}:${draft.trim().slice(0, 80)}`;
          const now = Date.now();
          if (key === autoNotifyKey.current) return;
          if (now - autoNotifyAt.current < 120_000) return;
          autoNotifyKey.current = key;
          autoNotifyAt.current = now;
          const preview = draft.trim().slice(0, 120).replace(/\s+/g, ' ');
          void import('@/lib/notify-client').then(({ notifyChannels }) =>
            notifyChannels(`📓 Folio 일지 자동 저장 · ${date}`, {
              deepLink: { tab: 'journal', date },
              actionLabel: '확인',
              body: `*일지 자동 저장 완료*\n• 날짜: \`${date}\`\n• 미리보기: ${preview}${draft.trim().length > 120 ? '…' : ''}`,
            }),
          );
        })
        .catch(() => {
          setSaveState('error');
          setSaveError('자동 저장에 실패했습니다. 다시 시도해 주세요.');
          showAppToast('일지 자동 저장 실패', { withRetry: true });
        });
    }, 3000);
    return () => clearInterval(t);
  }, [date, draft, tagsInput, ready, entryKey]);

  const allTags = useMemo(() => getAllTags(days), [days]);

  const cloudTags = useMemo(() => {
    const journalSources = Object.values(days).map(d => ({ tags: d.tags }));
    return buildTagCounts([...journalSources, ...boardTagSources]);
  }, [days, boardTagSources]);

  const applyQuickRange = (kind: 'today' | 'week' | 'month') => {
    const now = new Date();
    if (kind === 'today') {
      const t = todayStr();
      setRangeStart(t);
      setRangeEnd(t);
      selectDate(t);
      return;
    }
    if (kind === 'week') {
      setRangeStart(toDateStr(startOfWeek(now)));
      setRangeEnd(toDateStr(endOfWeek(now)));
      return;
    }
    setRangeStart(toDateStr(startOfMonth(now)));
    setRangeEnd(toDateStr(endOfMonth(now)));
  };

  const clearRange = () => {
    setRangeStart('');
    setRangeEnd('');
  };

  const recentEntries = useMemo(() => {
    return Object.entries(days)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .filter(([, day]) => {
        if (filterTag && !day.tags?.includes(filterTag)) return false;
        if (rangeStart && day.date < rangeStart) return false;
        if (rangeEnd && day.date > rangeEnd) return false;
        return true;
      });
  }, [days, filterTag, rangeStart, rangeEnd]);

  const suggestions = useMemo(() => {
    const q = tagDraft.trim().toLowerCase();
    return allTags.filter(tag => {
      if (currentTags.some(t => t.toLowerCase() === tag.toLowerCase())) return false;
      if (!q) return true;
      return tag.toLowerCase().includes(q);
    });
  }, [allTags, currentTags, tagDraft]);

  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    selectDate(d.toISOString().slice(0, 10));
  };
  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    selectDate(d.toISOString().slice(0, 10));
  };

  const createMemo = () => {
    const tags = parseTags(tagsInput);
    if (draft.trim() || tags.length > 0) {
      saveJournal(date, draft, tags, entryKey);
      void saveJournalWithFallback(date, draft, tags, entryKey);
    }
    const nextKey = `${date}--${Date.now()}`;
    setDays(prev => ({ ...prev, [nextKey]: { date, content: '', tags: [] } }));
    setEntryKey(nextKey);
    setDraft('');
    setTagsInput('');
    setTagDraft('');
    setSaveState('idle');
  };

  useSwipe(dateSwipeRef, {
    onSwipe: (dir) => {
      if (dir === 'left') nextDay();
      else if (dir === 'right') prevDay();
    },
  });

  const importObsidian = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const notes = await readObsidianMarkdownFiles(files, 'journal');
      const knownFingerprints = intakeFingerprintsFromTagSets(Object.values(days).map((day) => day.tags));
      const candidates = buildIntakeCandidates(notes, undefined, new Date(), knownFingerprints).filter((candidate) => candidate.route === 'journal');
      let imported = 0;
      let skipped = 0;
      let noDate = 0;
      const nextMap = { ...days };
      const history = [];

      for (const note of candidates) {
        if (!note.date) {
          noDate += 1;
        }
        if (note.duplicate) {
          skipped += 1;
          continue;
        }
        const entryId = createJournalEntryKey(note.resolvedDate);
        const tags = intakeTags(note);
        await saveJournalWithFallback(note.resolvedDate, note.content, tags, entryId);
        nextMap[entryId] = { date: note.resolvedDate, content: note.content, tags };
        history.push({
          fingerprint: note.fingerprint,
          fileName: note.fileName,
          relativePath: note.relativePath,
          title: note.title,
          route: note.route,
          targetId: entryId,
          date: note.resolvedDate,
          importedAt: new Date().toISOString(),
        });
        imported += 1;
      }

      if (history.length) appendIntakeHistory(history);

      setDays(nextMap);
      if (nextMap[entryKey]) {
        setDraft(nextMap[entryKey].content);
        setTagsInput(joinTags(nextMap[entryKey].tags));
      }
      setImportMsg(
        candidates.length === 0
          ? '가져올 .md 파일이 없습니다.'
          : `${imported}개 새 기록으로 추가${skipped ? `, 중복 ${skipped}건 스킵` : ''}${noDate ? `, 날짜 보완 ${noDate}건` : ''}`,
      );
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // P42/P44: 모바일 에디터 — visualViewport 키보드 대응
  const editorClass = writingFirst
    ? 'h-[var(--folio-editor-h,70dvh)] max-h-none min-h-[12rem] field-sizing-fixed resize-none border-0 focus-visible:ring-0 text-base leading-relaxed p-0 font-mono md:h-[min(18rem,38vh)] md:max-h-[18rem] md:min-h-[12rem] md:text-[15px] lg:h-[min(20rem,40vh)] lg:max-h-[20rem]'
    : 'min-h-[400px] resize-none border-0 focus-visible:ring-0 text-[15px] leading-relaxed p-0 font-mono';

  const editorStyle = writingFirst
    ? ({ ['--folio-editor-h' as string]: `${mobileEditorPx}px` } as CSSProperties)
    : undefined;

  return (
    <div
      className={
        writingFirst
          ? 'grid grid-cols-1'
          : 'grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6'
      }
    >
      <div className="col-span-full mb-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={createMemo}>
          + 새 메모
        </Button>
      </div>
      <JournalEditor
        writingFirst={writingFirst}
        date={date}
        dateSwipeRef={dateSwipeRef}
        onPrevDay={prevDay}
        onNextDay={nextDay}
        saveState={saveState}
        saveError={saveError}
        onSave={() => void save({ notify: notifyOnSave })}
        fileInputRef={fileInputRef}
        onImportChange={importObsidian}
        importing={importing}
        importMsg={importMsg}
        exportItems={[
          {
            id: 'md-range',
            label: 'Markdown (기간)',
            description: 'journals-YYYY-MM-DD-to-YYYY-MM-DD.md',
            run: async (setProgress) => {
              setProgress(0.2, '일지 수집…')
              const asEntries: Record<string, JournalEntry> = {}
              for (const [, day] of Object.entries(days)) {
                const d = day.date
                asEntries[d] = {
                  date: d,
                  content: day.content,
                  tags: day.tags,
                  updatedAt: new Date().toISOString(),
                }
              }
              const dates = Object.keys(asEntries).sort()
              const from = rangeStart || dates[0] || date
              const to = rangeEnd || dates[dates.length - 1] || date
              const entries = filterJournalsByRange(asEntries, from, to)
              setProgress(0.7, `${entries.length}건 변환…`)
              const md = journalsToMarkdown(entries)
              downloadText(md, journalsFilename(from, to), 'text/markdown;charset=utf-8')
              setProgress(1, '완료')
            },
          },
          {
            id: 'md-today',
            label: '오늘 Markdown',
            description: `${date}.md`,
            run: async (setProgress) => {
              setProgress(0.5, '변환…')
              const entry: JournalEntry = {
                date,
                content: draft,
                tags: parseTags(tagsInput),
                updatedAt: new Date().toISOString(),
              }
              downloadText(
                journalsToMarkdown([entry]),
                `journal-${date}.md`,
                'text/markdown;charset=utf-8',
              )
              setProgress(1, '완료')
            },
          },
        ]}
        exportExtra={
          <p className="text-[10px] text-gray-400">
            기간: {rangeStart || '처음'} ~ {rangeEnd || '마지막'}
            <br />
            (사이드바 날짜 범위와 동일)
          </p>
        }
        hasNotifyChannel={hasNotifyChannel}
        notifyOnSave={notifyOnSave}
        onNotifyOnSaveChange={setNotifyOnSave}
        draft={draft}
        onDraftChange={setDraft}
        editorClassName={editorClass}
        editorStyle={editorStyle}
        collabUser={collabUser}
        currentTags={currentTags}
        tagDraft={tagDraft}
        onTagDraftChange={handleTagDraftChange}
        onTagKeyDown={handleTagKeyDown}
        onTagBlur={commitTagDraft}
        onRemoveTag={removeTag}
        suggestions={suggestions}
        allTags={allTags}
        onAddTags={addTags}
        onTagDraftClear={() => setTagDraft('')}
      />

      {!writingFirst && (
      <div className="space-y-4">
        <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 bg-card">
          <h3 className="text-sm font-semibold mb-3">날짜 범위</h3>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applyQuickRange('today')}>
              오늘
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applyQuickRange('week')}>
              이번 주
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applyQuickRange('month')}>
              이번 달
            </Button>
            {(rangeStart || rangeEnd) && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={clearRange}>
                초기화
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">시작</label>
              <Input
                type="date"
                value={rangeStart}
                onChange={e => setRangeStart(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">종료</label>
              <Input
                type="date"
                value={rangeEnd}
                onChange={e => setRangeEnd(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 bg-card">
          <h3 className="text-sm font-semibold mb-3">태그 클라우드</h3>
          <ScrollArea className="h-36">
            <TagCloud
              tags={cloudTags}
              selected={filterTag}
              onSelect={setFilterTag}
            />
          </ScrollArea>
        </Card>

        <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 bg-card">
          <h3 className="text-sm font-semibold mb-3">
            최근 기록
            {(rangeStart || rangeEnd || filterTag) && (
              <span className="ml-2 text-[11px] font-normal text-gray-400">
                {recentEntries.length}건
              </span>
            )}
          </h3>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {recentEntries.slice(0, 20).map(([d, entry]) => (
                  <button
                    key={d}
                    onClick={() => selectDate(d)}
                    className={`w-full text-left p-2 rounded-xl text-xs transition-colors ${
                      date === d
                        ? 'bg-gray-50 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <div className="font-medium text-gray-700 dark:text-gray-200">{d}</div>
                    <div className="text-gray-400 truncate mt-0.5">{entry.content.slice(0, 60) || '(빈 일지)'}</div>
                    <div className="flex gap-1 mt-1">
                      {entry.tags.slice(0, 3).map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">#{t}</Badge>
                      ))}
                    </div>
                  </button>
                ))}
              {recentEntries.length === 0 && (
                <div className="px-1 py-6 text-center" role="status">
                  <p className="text-xs font-medium text-gray-500 mb-1">기록이 없습니다</p>
                  <p className="text-[11px] text-gray-400">오늘 일지를 작성하고 저장해 보세요</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
      )}
    </div>
  );
});
