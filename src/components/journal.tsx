'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { saveJournal, loadJournals } from '@/lib/journal';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function JournalPanel() {
  const [date, setDate] = useState(todayStr);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  type Day = { content: string; tags: string[] };
  const [days, setDays] = useState<Record<string, Day>>(() => {
    const entries = loadJournals();
    const map: Record<string, Day> = {};
    for (const k in entries) map[k] = { content: entries[k].content, tags: entries[k].tags };
    return map;
  });

  const content = days[date]?.content ?? '';
  const tagsValue = (days[date]?.tags ?? []).join(', ');
  const [draft, setDraft] = useState(content);
  const [tagsInput, setTagsInput] = useState(tagsValue);

  const save = useCallback(() => {
    const tags = tagsInput.split(',').map(s => s.trim()).filter(Boolean);
    saveJournal(date, draft, tags);
    setDays(prev => ({ ...prev, [date]: { content: draft, tags } }));
  }, [date, draft, tagsInput]);

  useEffect(() => {
    const t = setInterval(() => {
      const tags = tagsInput.split(',').map(s => s.trim()).filter(Boolean);
      saveJournal(date, draft, tags);
      setDays(prev => ({ ...prev, [date]: { content: draft, tags } }));
    }, 2000);
    return () => clearInterval(t);
  }, [date, draft, tagsInput]);

  const allTags = Array.from(new Set(Object.values(days).flatMap(d => d.tags))).sort();

  const prevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  };
  const nextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <Card className="rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-50">
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
          <Button onClick={save} size="sm" className="gap-2 bg-gray-900 hover:bg-gray-800">
            <Save className="h-4 w-4" /> 저장
          </Button>
        </div>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400">태그:</span>
            {(tagsInput.split(',').map(t => t.trim()).filter(Boolean)).map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs cursor-pointer hover:bg-gray-200" onClick={() => setTagsInput(tagsInput.split(',').map(t => t.trim()).filter(t => t !== tag).join(', '))}>
                #{tag} ×
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">태그 목록</h3>
          <ScrollArea className="h-32">
            <div className="flex flex-wrap gap-1">
              {allTags.length === 0 && <span className="text-xs text-gray-400">아직 태그 없음</span>}
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                    filterTag === tag ? 'bg-gray-900 text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <Card className="rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-semibold mb-3">최근 기록</h3>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {Object.entries(days)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .filter(([d]) => !filterTag || days[d].tags?.includes(filterTag))
                .slice(0, 20)
                .map(([d, entry]) => (
                  <button
                    key={d}
                    onClick={() => setDate(d)}
                    className={`w-full text-left p-2 rounded-xl text-xs transition-colors ${
                      date === d ? 'bg-gray-50 ring-1 ring-gray-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-700">{d}</div>
                    <div className="text-gray-400 truncate mt-0.5">{entry.content.slice(0, 60) || '(빈 일지)'}</div>
                    <div className="flex gap-1 mt-1">
                      {entry.tags.slice(0, 3).map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0">#{t}</Badge>
                      ))}
                    </div>
                  </button>
                ))}
              {Object.keys(days).length === 0 && (
                <span className="text-xs text-gray-400">아직 기록 없음</span>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
