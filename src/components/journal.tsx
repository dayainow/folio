'use client';

import { useState, useCallback, useEffect, useEffectEvent, useMemo, useRef, memo, type CSSProperties, type KeyboardEvent, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, Save, Check, Loader2, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { saveJournal, saveJournalWithFallback, loadJournalsWithFallback, getAllTags, type JournalEntry } from '@/lib/journal';
import { loadTasksWithFallback } from '@/lib/board';
import { readObsidianMarkdownFiles } from '@/lib/obsidian';
import { TagCloud, buildTagCounts } from '@/components/tag-cloud';
import { setToastRetryHandler, showAppToast } from '@/lib/health-monitor';
import { ExportMenu } from '@/components/export-menu';
import {
  downloadText,
  filterJournalsByRange,
  journalsFilename,
  journalsToMarkdown,
} from '@/lib/export';
import { PresenceBar } from '@/components/presence-bar';
import { CollabTextarea } from '@/components/collab-textarea';
import { DocCommentsPanel } from '@/components/doc-comments';
import { CustomFieldsPanel } from '@/components/custom-fields-panel';
import dynamic from 'next/dynamic';
import { useCollabUser } from '@/hooks/use-collab-user';
import { useSwipe } from '@/hooks/use-swipe';
import { editorHeightFromViewport, useVisualViewport } from '@/hooks/use-visual-viewport';
import { subscribeMobileAction } from '@/lib/mobile-actions';
import { publishActivity } from '@/lib/activity-stream';
import { getOrCreateGuestId } from '@/lib/presence';
import { cn } from '@/lib/utils';

const VoiceInputButton = dynamic(
  () => import('@/components/voice-input-button').then((m) => ({ default: m.VoiceInputButton })),
  { ssr: false, loading: () => null },
);
const ImageAttachButton = dynamic(
  () => import('@/components/image-attach-button').then((m) => ({ default: m.ImageAttachButton })),
  { ssr: false, loading: () => null },
);

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

  type Day = { content: string; tags: string[] };
  const [days, setDays] = useState<Record<string, Day>>({});
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

  const selectDate = useCallback((nextDate: string, map?: Record<string, Day>) => {
    // 날짜 이탈 전 현재 초안을 days·local에 반영 (자동저장 대기 없이 유지)
    const leavingTags = parseTags(tagsInput);
    const base = map ?? days;
    const merged: Record<string, Day> = {
      ...base,
      [date]: { content: draft, tags: leavingTags },
    };

    if (nextDate !== date && (draft.trim() || leavingTags.length > 0 || Boolean(days[date]))) {
      void saveJournalWithFallback(date, draft, leavingTags);
    }

    setDays(merged);
    setDate(nextDate);
    setDraft(merged[nextDate]?.content ?? '');
    setTagsInput(joinTags(merged[nextDate]?.tags ?? []));
    setTagDraft('');
  }, [date, draft, tagsInput, days]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [entries, tasks] = await Promise.all([
        loadJournalsWithFallback(),
        loadTasksWithFallback().catch(() => []),
      ]);
      if (cancelled) return;
      const map: Record<string, Day> = {};
      for (const k in entries) map[k] = { content: entries[k].content, tags: entries[k].tags };
      const today = todayStr();
      setDays(map);
      setBoardTagSources(tasks.map(t => ({ tags: t.tags })));
      setDate(today);
      setDraft(map[today]?.content ?? '');
      setTagsInput(joinTags(map[today]?.tags ?? []));
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
    setDays(prev => ({ ...prev, [date]: { content: draft, tags } }));
    try {
      saveJournal(date, draft, tags);
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
      void saveJournalWithFallback(date, draft, tags)
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
  }, [date, draft, tagsInput, hasNotifyChannel, collabUser]);

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
      void saveJournalWithFallback(date, draft, tags)
        .then((result) => {
          setDays(prev => ({ ...prev, [date]: { content: draft, tags } }));
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
  }, [date, draft, tagsInput, ready]);

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
      .filter(([d]) => {
        if (filterTag && !days[d].tags?.includes(filterTag)) return false;
        if (rangeStart && d < rangeStart) return false;
        if (rangeEnd && d > rangeEnd) return false;
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
      let imported = 0;
      let skipped = 0;
      let noDate = 0;
      const nextMap = { ...days };

      for (const note of notes) {
        if (!note.date) {
          noDate += 1;
          continue;
        }
        const existing = nextMap[note.date];
        if (existing?.content?.trim()) {
          skipped += 1;
          continue;
        }
        const tags = note.tags;
        await saveJournalWithFallback(note.date, note.content, tags);
        nextMap[note.date] = { content: note.content, tags };
        imported += 1;
      }

      setDays(nextMap);
      if (nextMap[date]) {
        setDraft(nextMap[date].content);
        setTagsInput(joinTags(nextMap[date].tags));
      }
      setImportMsg(
        notes.length === 0
          ? '가져올 .md 파일이 없습니다.'
          : `${imported}개 가져옴${skipped ? `, 기존 ${skipped}건 스킵` : ''}${noDate ? `, 날짜 없음 ${noDate}건` : ''}`,
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
      <Card
        className={
          writingFirst
            ? 'flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-card shadow-sm dark:border-gray-800'
            : 'rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm bg-card'
        }
      >
        <div
          className={
            writingFirst
              ? 'flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 px-3 py-2 dark:border-gray-800'
              : 'flex items-center justify-between p-4 border-b border-gray-50 dark:border-gray-800'
          }
        >
          <div
            ref={dateSwipeRef}
            className={`flex items-center ${writingFirst ? 'gap-1.5' : 'gap-3'} touch-pan-y`}
            title="좌우로 쓸어 날짜 이동"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={prevDay}
              className={writingFirst ? 'h-12 w-12 min-h-[48px] min-w-[48px] md:h-7 md:w-7 md:min-h-0 md:min-w-0' : 'h-12 w-12 min-h-[48px] min-w-[48px] md:h-8 md:w-8 md:min-h-0 md:min-w-0'}
              aria-label="이전 날짜"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              <Calendar className={`${writingFirst ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-gray-400`} aria-hidden />
              <span
                className={`font-medium tabular-nums ${writingFirst ? 'text-xs' : 'text-sm'}`}
                aria-live="polite"
              >
                {date}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextDay}
              className={writingFirst ? 'h-12 w-12 min-h-[48px] min-w-[48px] md:h-7 md:w-7 md:min-h-0 md:min-w-0' : 'h-12 w-12 min-h-[48px] min-w-[48px] md:h-8 md:w-8 md:min-h-0 md:min-w-0'}
              aria-label="다음 날짜"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className={`flex flex-wrap items-center ${writingFirst ? 'gap-1.5' : 'gap-2'}`}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,text/markdown"
              className="hidden"
              onChange={importObsidian}
            />
            <ExportMenu
              label="내보내기"
              items={[
                {
                  id: 'md-range',
                  label: 'Markdown (기간)',
                  description: 'journals-YYYY-MM-DD-to-YYYY-MM-DD.md',
                  run: async (setProgress) => {
                    setProgress(0.2, '일지 수집…')
                    const asEntries: Record<string, JournalEntry> = {}
                    for (const [d, day] of Object.entries(days)) {
                      asEntries[d] = {
                        date: d,
                        content: day.content,
                        tags: day.tags,
                        updatedAt: new Date().toISOString(),
                      }
                    }
                    // 사이드바 기간 필터 우선, 없으면 전체 범위
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
              extra={
                <p className="text-[10px] text-gray-400">
                  기간: {rangeStart || '처음'} ~ {rangeEnd || '마지막'}
                  <br />
                  (사이드바 날짜 범위와 동일)
                </p>
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {importing ? '가져오는 중…' : 'Obsidian 가져오기'}
            </Button>
            <Button
              type="button"
              disabled={saveState === 'saving'}
              onClick={() => void save({ notify: notifyOnSave })}
              size="sm"
              aria-busy={saveState === 'saving'}
              aria-label={
                saveState === 'saving'
                  ? '저장 중'
                  : saveState === 'saved'
                    ? '저장됨'
                    : saveState === 'error'
                      ? '저장 실패'
                      : '일지 저장'
              }
              className="gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white min-w-[4.5rem]"
            >
              {saveState === 'saving' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> 저장 중
                </>
              ) : saveState === 'saved' ? (
                <>
                  <Check className="h-4 w-4" aria-hidden /> 저장됨
                </>
              ) : saveState === 'error' ? (
                <>
                  <Save className="h-4 w-4" aria-hidden /> 실패
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden /> 저장
                </>
              )}
            </Button>
          </div>
        </div>
        <span className="sr-only" aria-live="polite">
          {saveState === 'saved' ? '일지가 저장되었습니다' : saveState === 'saving' ? '일지 저장 중' : saveState === 'error' ? '일지 저장 실패' : ''}
        </span>
        {saveError && (
          <div
            role="alert"
            className="mx-4 mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            <span className="flex-1">{saveError}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => void save({ notify: notifyOnSave })}
            >
              다시 시도
            </Button>
          </div>
        )}
        {hasNotifyChannel && (
          <div className="px-4 pt-2">
            <label className="inline-flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnSave}
                onChange={e => setNotifyOnSave(e.target.checked)}
                className="rounded border-gray-300"
              />
              저장 시 Slack/Discord 알림
            </label>
          </div>
        )}
        {importMsg && (
          <p className="px-4 pt-2 text-[11px] text-gray-500">{importMsg}</p>
        )}
        <div className={writingFirst ? 'shrink-0 px-3 pt-2 sm:px-4' : 'p-4'}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <PresenceBar roomId={`journal:${date}`} tab="journal" user={collabUser} />
            <div className="flex flex-wrap items-center gap-1">
              <VoiceInputButton
                onTranscript={(text) =>
                  setDraft((prev) => (prev.trim() ? `${prev.replace(/\s*$/, '')}\n${text}` : text))
                }
              />
              <ImageAttachButton
                onInsert={(md) => setDraft((prev) => `${prev}${md}`)}
              />
            </div>
          </div>
          <label htmlFor="journal-draft" className="sr-only">
            일지 본문
          </label>
          <div style={editorStyle} className={cn(writingFirst && 'md:[--folio-editor-h:min(18rem,38vh)]')}>
            <CollabTextarea
              id="journal-draft"
              roomId={`journal:${date}`}
              value={draft}
              onChange={setDraft}
              user={collabUser}
              placeholder="오늘 한 일, 회의 내용, 이슈, 배운 것... 자유롭게 적으세요.\nMarkdown 지원: # 제목, - 리스트, **굵게**"
              className={editorClass}
              aria-describedby="journal-draft-hint"
            />
          </div>
          <p id="journal-draft-hint" className="sr-only">
            마크다운을 사용할 수 있습니다. 저장 버튼 또는 자동 저장으로 기록됩니다. 실시간 협업(Yjs)이 활성화되어 있습니다.
          </p>
          <div className="mt-3">
            <DocCommentsPanel targetKind="journal" targetId={date} user={collabUser} />
          </div>
        </div>
        <div className={writingFirst ? 'shrink-0 px-3 pb-3 pt-1 sm:px-4' : 'px-4 pb-4'}>
          <Separator className={writingFirst ? 'mb-2' : 'mb-3'} />
          <div className={writingFirst ? 'space-y-1.5' : 'space-y-2'}>
            <div className="flex flex-wrap items-center gap-2" aria-label="현재 태그">
              <span className="text-xs text-gray-400">태그:</span>
              {currentTags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => removeTag(tag)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${tag} 태그 제거`}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      removeTag(tag);
                    }
                  }}
                >
                  #{tag} ×
                </Badge>
              ))}
              {currentTags.length === 0 && (
                <span className="text-xs text-gray-300">없음</span>
              )}
            </div>
            <label htmlFor="journal-tag-draft" className="sr-only">
              태그 입력
            </label>
            <Input
              id="journal-tag-draft"
              value={tagDraft}
              onChange={handleTagDraftChange}
              onKeyDown={handleTagKeyDown}
              onBlur={commitTagDraft}
              placeholder="태그 입력 후 Enter 또는 쉼표"
              className="h-8 text-xs"
              aria-describedby="journal-tag-hint"
            />
            {!writingFirst && (
              <p id="journal-tag-hint" className="text-[11px] text-gray-400">
                Enter로 추가 · 빈 입력에서 Backspace로 마지막 태그 삭제
              </p>
            )}
            {writingFirst && <p id="journal-tag-hint" className="sr-only">Enter로 태그 추가</p>}
            {allTags.length > 0 && (!writingFirst || tagDraft.trim()) && (
              <div className="space-y-1.5">
                {!writingFirst && (
                  <span className="text-[11px] text-gray-400">
                    기존 태그 {tagDraft.trim() ? '자동완성' : '제안'}
                  </span>
                )}
                <div className="flex flex-wrap gap-1">
                  {suggestions.length === 0 ? (
                    !writingFirst ? (
                      <span className="text-[11px] text-gray-300">추가할 태그 없음</span>
                    ) : null
                  ) : (
                    suggestions.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          addTags([tag]);
                          setTagDraft('');
                        }}
                        className="text-xs px-2 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                      >
                        #{tag}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={writingFirst ? 'px-3 pb-3 sm:px-4' : 'px-4 pb-4'}>
          <CustomFieldsPanel entity="journal" recordId={date} />
        </div>
      </Card>

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
