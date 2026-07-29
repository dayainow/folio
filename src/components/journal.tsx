'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo, type KeyboardEvent, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, Save, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { saveJournalWithFallback, loadJournalsWithFallback, getAllTags } from '@/lib/journal';
import { loadTasksWithFallback } from '@/lib/board';
import { readObsidianMarkdownFiles } from '@/lib/obsidian';
import { TagCloud, buildTagCounts } from '@/components/tag-cloud';

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
}: {
  focusDate?: string | null;
  onFocusHandled?: () => void;
} = {}) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectDate = useCallback((nextDate: string, map?: Record<string, Day>) => {
    const source = map ?? days;
    setDate(nextDate);
    setDraft(source[nextDate]?.content ?? '');
    setTagsInput(joinTags(source[nextDate]?.tags ?? []));
    setTagDraft('');
  }, [days]);

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

  useEffect(() => {
    void import('@/lib/notify-client').then(({ fetchIntegrationsStatus }) =>
      fetchIntegrationsStatus().then(s => {
        setHasNotifyChannel(s.slack || s.discord);
      }),
    );
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
    }
  };

  const save = useCallback(async (opts?: { notify?: boolean }) => {
    const tags = parseTags(tagsInput);
    await saveJournalWithFallback(date, draft, tags);
    setDays(prev => ({ ...prev, [date]: { content: draft, tags } }));

    if (!opts?.notify || !hasNotifyChannel) return;

    const preview = draft.trim().slice(0, 120).replace(/\s+/g, ' ');
    await import('@/lib/notify-client').then(({ notifyChannels }) =>
      notifyChannels(
        `📓 Folio 일지 저장 · ${date}${preview ? `\n${preview}${draft.trim().length > 120 ? '…' : ''}` : ''}`,
      ),
    );
  }, [date, draft, tagsInput, hasNotifyChannel]);

  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      const tags = parseTags(tagsInput);
      void saveJournalWithFallback(date, draft, tags).then(() => {
        setDays(prev => ({ ...prev, [date]: { content: draft, tags } }));
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <Card className="rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm bg-card">
        <div className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={prevDay} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-sm">{date}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={nextDay} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,text/markdown"
              className="hidden"
              onChange={importObsidian}
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
            <Button onClick={() => void save({ notify: notifyOnSave })} size="sm" className="gap-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
              <Save className="h-4 w-4" /> 저장
            </Button>
          </div>
        </div>
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
        <div className="p-4">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="오늘 한 일, 회의 내용, 이슈, 배운 것... 자유롭게 적으세요.\nMarkdown 지원: # 제목, - 리스트, **굵게**"
            className="min-h-[400px] resize-none border-0 focus-visible:ring-0 text-[15px] leading-relaxed p-0 font-mono"
          />
        </div>
        <div className="px-4 pb-4">
          <Separator className="mb-3" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">태그:</span>
              {currentTags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => removeTag(tag)}
                >
                  #{tag} ×
                </Badge>
              ))}
              {currentTags.length === 0 && (
                <span className="text-xs text-gray-300">없음</span>
              )}
            </div>
            <Input
              value={tagDraft}
              onChange={handleTagDraftChange}
              onKeyDown={handleTagKeyDown}
              onBlur={commitTagDraft}
              placeholder="태그 입력 후 Enter 또는 쉼표"
              className="h-8 text-xs"
            />
            {allTags.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-gray-400">기존 태그 {tagDraft.trim() ? '자동완성' : '제안'}</span>
                <div className="flex flex-wrap gap-1">
                  {suggestions.length === 0 ? (
                    <span className="text-[11px] text-gray-300">추가할 태그 없음</span>
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
      </Card>

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
                <span className="text-xs text-gray-400">조건에 맞는 기록 없음</span>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
});
