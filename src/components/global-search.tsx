'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Search, BookOpen, FileText, Kanban, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/components/i18n-provider';
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
  /** icon: 헤더용 검색 아이콘 → 클릭 시 확장 */
  variant?: 'default' | 'icon';
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
  id,
  icon,
  title,
  preview,
  meta,
  active,
  onClick,
  onHover,
}: {
  id: string;
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
      id={id}
      role="option"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={onHover}
      className={[
        'w-full text-left px-3 py-3 min-h-[44px] rounded-lg transition-colors touch-manipulation',
        active ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-900',
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

export function GlobalSearch({ onNavigate, variant = 'default' }: GlobalSearchProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(variant !== 'icon');
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
    const onFocusSearch = () => {
      setExpanded(true);
      window.setTimeout(() => {
        inputRef.current?.focus();
        setOpen(true);
      }, 0);
    };
    // P64 — 통합 검색은 Cmd/Ctrl+Shift+F (단축키 호스트) → folio:focus-search
    window.addEventListener('folio:focus-search', onFocusSearch);
    return () => {
      window.removeEventListener('folio:focus-search', onFocusSearch);
    };
  }, []);

  // 모바일 검색 풀스크린일 때 스크롤 잠금
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    if (!mq.matches || !query.trim()) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, query]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;

    const id = ++requestId.current;
    const startTimer = window.setTimeout(() => {
      setLoading(true);
    }, 0);
    const timer = window.setTimeout(() => {
      void searchAll(q).then(next => {
        if (requestId.current !== id) return;
        setResults(next);
        setActiveIndex(0);
        setLoading(false);
        setOpen(true);
      });
    }, 300);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(timer);
    };
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
    setResults({ journals: [], docs: [], tasks: [] });
    setLoading(false);
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
  const activeOptionId =
    showPanel && flatItems().length > 0 ? `${panelId}-opt-${activeIndex}` : undefined;

  const resultGroups = useMemo(() => {
    const groups: Array<{
      source: SearchSource;
      label: string;
      startIndex: number;
      items: SearchNavigatePayload[];
    }> = [];
    let start = 0;
    const push = (
      source: SearchSource,
      label: string,
      items: SearchNavigatePayload[],
    ) => {
      if (items.length === 0) return;
      groups.push({ source, label, startIndex: start, items });
      start += items.length;
    };
    push(
      'journal',
      t('nav.journal'),
      results.journals.map(hit => ({ source: 'journal' as const, hit })),
    );
    push(
      'docs',
      t('nav.docs'),
      results.docs.map(hit => ({ source: 'docs' as const, hit })),
    );
    push(
      'board',
      t('nav.board'),
      results.tasks.map(hit => ({ source: 'board' as const, hit })),
    );
    return groups;
  }, [results, t]);

  if (variant === 'icon' && !expanded) {
    return (
      <div className="relative" id={panelId}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={t('search.open')}
          onClick={() => {
            setExpanded(true);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={
        variant === 'icon'
          ? 'relative w-[min(100vw-8rem,20rem)] sm:w-72'
          : 'relative w-full max-w-xl mb-4'
      }
      id={panelId}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => {
            const value = e.target.value;
            setQuery(value);
            setOpen(true);
            if (!value.trim()) {
              setResults({ journals: [], docs: [], tasks: [] });
              setLoading(false);
            }
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onBlur={() => {
            if (variant === 'icon' && !query.trim() && !showPanel) {
              window.setTimeout(() => setExpanded(false), 150);
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Escape' && variant === 'icon') {
              setExpanded(false);
              setOpen(false);
              setQuery('');
              return;
            }
            onInputKeyDown(e);
          }}
          placeholder={t('search.placeholder')}
          className="pl-9 pr-16 h-9 min-h-[36px] rounded-xl border-gray-200 bg-gray-50/80 focus-visible:bg-white"
          aria-label={t('search.aria')}
          aria-expanded={showPanel}
          aria-controls={`${panelId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-0.5 rounded-md border border-gray-200 bg-white px-1.5 text-[10px] font-medium text-gray-400">
          ⌘K
        </kbd>
      </div>

      {showPanel && (
        <>
          {/* 데스크톱: 드롭다운 */}
          <div
            id={`${panelId}-list`}
            role="listbox"
            className="hidden md:block absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg shadow-gray-200/60 dark:border-gray-800 dark:bg-background"
          >
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('search.searching')}
              </div>
            ) : totalCount === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">{t('search.noResults')}</div>
            ) : (
              <ScrollArea className="max-h-[min(420px,60vh)]">
                <div className="py-1">
                  {resultGroups.map(group => (
                    <div key={group.source}>
                      <SectionLabel>
                        {group.label} · {group.items.length}
                      </SectionLabel>
                      <div className="px-1 pb-1 space-y-0.5">
                        {group.items.map((item, i) => {
                          const index = group.startIndex + i;
                          const active = activeIndex === index;
                          if (item.source === 'journal') {
                            return (
                              <ResultRow
                                key={`j-${item.hit.id}`}
                                id={`${panelId}-opt-${index}`}
                                icon={<BookOpen className="h-3.5 w-3.5" />}
                                title={item.hit.title}
                                preview={item.hit.preview}
                                meta={formatDate(item.hit.date)}
                                active={active}
                                onHover={() => setActiveIndex(index)}
                                onClick={() => select(item)}
                              />
                            );
                          }
                          if (item.source === 'docs') {
                            return (
                              <ResultRow
                                key={`d-${item.hit.id}`}
                                id={`${panelId}-opt-${index}`}
                                icon={<FileText className="h-3.5 w-3.5" />}
                                title={item.hit.title}
                                preview={item.hit.preview}
                                meta={formatDate(item.hit.updatedAt)}
                                active={active}
                                onHover={() => setActiveIndex(index)}
                                onClick={() => select(item)}
                              />
                            );
                          }
                          return (
                            <ResultRow
                              key={`t-${item.hit.id}`}
                              id={`${panelId}-opt-${index}`}
                              icon={<Kanban className="h-3.5 w-3.5" />}
                              title={item.hit.title}
                              preview={item.hit.preview}
                              meta={formatDate(item.hit.updatedAt)}
                              active={active}
                              onHover={() => setActiveIndex(index)}
                              onClick={() => select(item)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* 모바일: 풀스크린 모달 */}
          <div
            className="md:hidden fixed inset-0 z-[70] flex flex-col bg-background"
            role="dialog"
            aria-modal="true"
            aria-label={t('search.aria')}
          >
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  value={query}
                  onChange={e => {
                    const value = e.target.value;
                    setQuery(value);
                    setOpen(true);
                    if (!value.trim()) {
                      setResults({ journals: [], docs: [], tasks: [] });
                      setLoading(false);
                    }
                  }}
                  onKeyDown={onInputKeyDown}
                  placeholder={t('search.placeholder')}
                  className="pl-9 h-11 min-h-[44px] rounded-xl"
                  aria-label={t('search.aria')}
                  autoFocus
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0"
                aria-label={t('search.close')}
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                  setResults({ journals: [], docs: [], tasks: [] });
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto" role="listbox" id={`${panelId}-list-mobile`}>
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('search.searching')}
                </div>
              ) : totalCount === 0 ? (
                <div className="px-4 py-8 text-sm text-muted-foreground text-center">{t('search.noResults')}</div>
              ) : (
                <div className="py-2 pb-24">
                  {resultGroups.map(group => (
                    <div key={`m-${group.source}`}>
                      <SectionLabel>
                        {group.label} · {group.items.length}
                      </SectionLabel>
                      <div className="px-2 space-y-0.5">
                        {group.items.map((item, i) => {
                          const index = group.startIndex + i;
                          const active = activeIndex === index;
                          if (item.source === 'journal') {
                            return (
                              <ResultRow
                                key={`mj-${item.hit.id}`}
                                id={`${panelId}-mopt-${index}`}
                                icon={<BookOpen className="h-3.5 w-3.5" />}
                                title={item.hit.title}
                                preview={item.hit.preview}
                                meta={formatDate(item.hit.date)}
                                active={active}
                                onHover={() => setActiveIndex(index)}
                                onClick={() => select(item)}
                              />
                            );
                          }
                          if (item.source === 'docs') {
                            return (
                              <ResultRow
                                key={`md-${item.hit.id}`}
                                id={`${panelId}-mopt-${index}`}
                                icon={<FileText className="h-3.5 w-3.5" />}
                                title={item.hit.title}
                                preview={item.hit.preview}
                                meta={formatDate(item.hit.updatedAt)}
                                active={active}
                                onHover={() => setActiveIndex(index)}
                                onClick={() => select(item)}
                              />
                            );
                          }
                          return (
                            <ResultRow
                              key={`mt-${item.hit.id}`}
                              id={`${panelId}-mopt-${index}`}
                              icon={<Kanban className="h-3.5 w-3.5" />}
                              title={item.hit.title}
                              preview={item.hit.preview}
                              meta={formatDate(item.hit.updatedAt)}
                              active={active}
                              onHover={() => setActiveIndex(index)}
                              onClick={() => select(item)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
