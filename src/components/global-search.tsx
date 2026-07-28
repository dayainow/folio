'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Search, BookOpen, FileText, Kanban, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  searchAll,
  type DocSearchHit,
  type JournalSearchHit,
  type SearchAllResult,
  type SearchSource,
  type TaskSearchHit,
} from '@/lib/search';

export type SearchNavigatePayload =
  | { source: 'journal'; hit: JournalSearchHit }
  | { source: 'docs'; hit: DocSearchHit }
  | { source: 'board'; hit: TaskSearchHit };

interface GlobalSearchProps {
  onNavigate: (payload: SearchNavigatePayload) => void;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    return iso.slice(0, 10);
  } catch {
    return iso;
  }
}

function ResultRow({
  icon,
  title,
  preview,
  meta,
  active,
  onClick,
  onHover,
}: {
  icon: ReactNode;
  title: string;
  preview: string;
  meta: string;
  active: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={[
        'w-full text-left px-3 py-2.5 rounded-lg transition-colors',
        active ? 'bg-gray-100' : 'hover:bg-gray-50',
      ].join(' ')}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-gray-400 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">{title}</span>
            <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">{meta}</span>
          </div>
          {preview && (
            <p className="mt-0.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">{preview}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase text-gray-400">
      {children}
    </div>
  );
}

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchAllResult>({
    journals: [],
    docs: [],
    tasks: [],
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const requestId = useRef(0);

  const flatItems = useCallback((): SearchNavigatePayload[] => {
    return [
      ...results.journals.map(hit => ({ source: 'journal' as const, hit })),
      ...results.docs.map(hit => ({ source: 'docs' as const, hit })),
      ...results.tasks.map(hit => ({ source: 'board' as const, hit })),
    ];
  }, [results]);

  const totalCount =
    results.journals.length + results.docs.length + results.tasks.length;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults({ journals: [], docs: [], tasks: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      void searchAll(q).then(next => {
        if (requestId.current !== id) return;
        setResults(next);
        setActiveIndex(0);
        setLoading(false);
        setOpen(true);
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const root = document.getElementById(panelId);
      if (!root) return;
      if (!root.contains(e.target as Node) && e.target !== inputRef.current) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open, panelId]);

  const select = (payload: SearchNavigatePayload) => {
    onNavigate(payload);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const items = flatItems();
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) select(item);
    }
  };

  const showPanel = open && query.trim().length > 0;

  let flatOffset = 0;

  const renderGroup = <T,>(
    source: SearchSource,
    label: string,
    items: T[],
    render: (item: T, index: number, active: boolean) => ReactNode,
  ) => {
    if (items.length === 0) return null;
    const start = flatOffset;
    flatOffset += items.length;
    return (
      <div key={source}>
        <SectionLabel>
          {label} · {items.length}
        </SectionLabel>
        <div className="px-1 pb-1 space-y-0.5">
          {items.map((item, i) => render(item, start + i, activeIndex === start + i))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-xl mb-4" id={panelId}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="전체 검색… Journal · Docs · Board"
          className="pl-9 pr-16 h-10 rounded-xl border-gray-200 bg-gray-50/80 focus-visible:bg-white"
          aria-label="통합 검색"
          aria-expanded={showPanel}
          aria-controls={`${panelId}-list`}
          autoComplete="off"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-6 items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 text-[10px] font-medium text-gray-400">
          ⌘K
        </kbd>
      </div>

      {showPanel && (
        <div
          id={`${panelId}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg shadow-gray-200/60"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              검색 중…
            </div>
          ) : totalCount === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">결과가 없습니다</div>
          ) : (
            <ScrollArea className="max-h-[min(420px,60vh)]">
              <div className="py-1">
                {renderGroup('journal', '일지', results.journals, (hit, index, active) => (
                  <ResultRow
                    key={`j-${hit.id}`}
                    icon={<BookOpen className="h-3.5 w-3.5" />}
                    title={hit.title}
                    preview={hit.preview}
                    meta={formatDate(hit.date)}
                    active={active}
                    onHover={() => setActiveIndex(index)}
                    onClick={() => select({ source: 'journal', hit })}
                  />
                ))}
                {renderGroup('docs', '문서', results.docs, (hit, index, active) => (
                  <ResultRow
                    key={`d-${hit.id}`}
                    icon={<FileText className="h-3.5 w-3.5" />}
                    title={hit.title}
                    preview={hit.preview}
                    meta={formatDate(hit.updatedAt)}
                    active={active}
                    onHover={() => setActiveIndex(index)}
                    onClick={() => select({ source: 'docs', hit })}
                  />
                ))}
                {renderGroup('board', '일정', results.tasks, (hit, index, active) => (
                  <ResultRow
                    key={`t-${hit.id}`}
                    icon={<Kanban className="h-3.5 w-3.5" />}
                    title={hit.title}
                    preview={hit.preview}
                    meta={formatDate(hit.updatedAt)}
                    active={active}
                    onHover={() => setActiveIndex(index)}
                    onClick={() => select({ source: 'board', hit })}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
