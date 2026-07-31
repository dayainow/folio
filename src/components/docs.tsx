'use client';

import { useState, useCallback, useEffect, useMemo, useRef, memo, type ReactNode, type ChangeEvent, type KeyboardEvent } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  FileText,
  Trash2,
  Save,
  Search,
  Columns2,
  Eye,
  Pencil,
  Upload,
  Loader2,
  Share2,
  Link2,
} from 'lucide-react';
import { loadDocsWithFallback, saveDocWithFallback, deleteDocWithFallback, loadCategories, type DocEntry } from '@/lib/docs';
import { readObsidianMarkdownFiles, uniqueDocTitle } from '@/lib/obsidian';
import { exportDocToBeacon, fetchBeaconMtimes } from '@/lib/beacon';
import { getBeaconAutoArtifact } from '@/lib/beacon-automation';
import { recordFolioTimelineEvent } from '@/lib/beacon-timeline-consent';
import { findBacklinks, wikiLinksToMarkdown } from '@/lib/link-parser';
import { WikiLinkTextarea } from '@/components/wiki-link-textarea';

const LinkGraphPanel = dynamic(
  () => import('@/components/link-graph').then((m) => ({ default: m.LinkGraphPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-100 text-xs text-gray-400">
        그래프 로딩…
      </div>
    ),
  },
);

type EditPane = 'edit' | 'preview' | 'split';

function MarkdownPreview({
  content,
  docs,
  onOpenDoc,
}: {
  content: string;
  docs: DocEntry[];
  onOpenDoc?: (docId: string) => void;
}) {
  if (!content.trim()) {
    return <p className="text-sm text-gray-400">(빈 문서)</p>;
  }

  const md = wikiLinksToMarkdown(content, docs);

  return (
    <div
      className={[
        'text-sm leading-relaxed text-gray-800',
        '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight',
        '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold',
        '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-medium',
        '[&_p]:my-2',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:my-0.5',
        '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-200 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600',
        '[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2',
        '[&_hr]:my-4 [&_hr]:border-gray-100',
        '[&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]',
        '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-gray-50 [&_pre]:p-3 [&_pre]:ring-1 [&_pre]:ring-gray-100',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left',
        '[&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium',
        '[&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1.5',
        '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg',
        '[&_del]:text-gray-400',
        '[&_input]:mr-2',
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('#doc:') && onOpenDoc) {
              const id = href.slice('#doc:'.length);
              return (
                <button
                  type="button"
                  className="text-blue-600 underline underline-offset-2"
                  onClick={() => onOpenDoc(id)}
                >
                  {children}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

export const DocsPanel = memo(function DocsPanel({
  focusDocId,
  onFocusHandled,
}: {
  focusDocId?: string | null;
  onFocusHandled?: () => void;
} = {}) {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await loadDocsWithFallback();
      if (cancelled) return;
      setDocs(next);
      setCategories(loadCategories(next));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editPane, setEditPane] = useState<EditPane>('edit');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Dev Guide');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectDoc = useCallback(async (doc: DocEntry) => {
    // 편집 중 다른 문서로 이동 시 현재 내용 저장
    if (editing && selectedId && selectedId !== doc.id) {
      const createdAt = docs.find(d => d.id === selectedId)?.createdAt ?? new Date().toISOString();
      const updated: DocEntry = {
        id: selectedId,
        title: title.trim() || '제목 없음',
        content,
        category,
        createdAt,
        updatedAt: new Date().toISOString(),
      };
      setDocs(prev => prev.map(d => (d.id === selectedId ? updated : d)));
      try {
        await saveDocWithFallback(updated);
      } catch {
        /* 계속 이동 */
      }
    }
    setSelectedId(doc.id);
    setTitle(doc.title);
    setContent(doc.content);
    setCategory(doc.category);
    setEditing(false);
    setEditPane('edit');
  }, [editing, selectedId, docs, title, content, category]);

  useEffect(() => {
    if (!focusDocId || docs.length === 0) return;
    const doc = docs.find(d => d.id === focusDocId);
    const handle = window.setTimeout(() => {
      if (doc) {
        selectDoc(doc);
        setFilterCat(null);
        setSearch('');
      }
      onFocusHandled?.();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [focusDocId, docs, selectDoc, onFocusHandled]);

  const startEdit = () => {
    setEditPane('edit');
    setEditing(true);
  };

  const startNew = async () => {
    const newDoc: DocEntry = {
      id: crypto.randomUUID(),
      title: '새 문서',
      content: '',
      category: filterCat || 'Dev Guide',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // 낙관적 UI — 저장 전에 에디터부터 열기
    setDocs(prev => [newDoc, ...prev]);
    selectDoc(newDoc);
    setEditPane('edit');
    setEditing(true);
    try {
      await saveDocWithFallback(newDoc);
    } catch {
      /* UI는 이미 반영 */
    }
  };

  const doSave = async () => {
    if (!selectedId) return;
    if (!title.trim()) {
      setSaveError('문서 제목은 필수입니다.');
      setSaveState('error');
      return;
    }
    const createdAt = docs.find(d => d.id === selectedId)?.createdAt ?? new Date().toISOString();
    const updated: DocEntry = {
      id: selectedId,
      title,
      content,
      category,
      createdAt,
      updatedAt: new Date().toISOString(),
    };
    setSaveState('saving');
    setSaveError(null);
    setDocs(prev => prev.map(d => (d.id === selectedId ? updated : d)));
    setEditing(false);
    setEditPane('edit');
    try {
      await saveDocWithFallback(updated);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 2000);
      void import('@/lib/push-notifications').then(({ showFolioPush }) =>
        showFolioPush({
          title: '문서 저장 완료',
          body: `「${updated.title}」이(가) 저장되었습니다.`,
          url: `/?tab=docs&docId=${encodeURIComponent(updated.id)}`,
          tag: 'docs-save',
        }),
      );
      void recordFolioTimelineEvent({
        title: `문서 저장 · ${updated.title}`,
        detail: updated.category,
        type: 'docs_save',
        category: 'docs',
      });
      if (getBeaconAutoArtifact()) {
        void (async () => {
          try {
            const mtimes = await fetchBeaconMtimes();
            if (!mtimes.available) return;
            const result = await exportDocToBeacon({
              title: updated.title,
              content: updated.content,
              category: updated.category,
              docId: updated.id,
              expectedMtime: mtimes.projectJson,
            });
            if (!result.ok && result.conflict) {
              await exportDocToBeacon({
                title: updated.title,
                content: updated.content,
                category: updated.category,
                docId: updated.id,
                expectedMtime: result.mtime ?? null,
                strategy: 'merge',
              });
            }
          } catch {
            /* 자동 산출물은 저장 성공과 분리 */
          }
        })();
      }
    } catch {
      setSaveState('error');
      setSaveError('문서 저장에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  const exportToBeacon = async (strategy?: 'merge' | 'reapply') => {
    if (!selectedId) return;
    const doc = docs.find((d) => d.id === selectedId);
    const payload = {
      title: (editing ? title : doc?.title)?.trim() || '제목 없음',
      content: editing ? content : doc?.content ?? '',
      category: editing ? category : doc?.category ?? 'Docs',
      docId: selectedId,
    };
    setExportBusy(true);
    setExportMsg(null);
    try {
      const mtimes = await fetchBeaconMtimes();
      if (!mtimes.available) {
        setExportMsg('Beacon이 초기화되지 않았습니다.');
        return;
      }
      const result = await exportDocToBeacon({
        ...payload,
        expectedMtime: mtimes.projectJson,
        strategy,
      });
      if (!result.ok && result.conflict) {
        setExportMsg('충돌: 병합/재적용이 필요합니다. 다시 눌러 병합합니다.');
        await exportDocToBeacon({ ...payload, expectedMtime: result.mtime ?? null, strategy: 'merge' });
        setExportMsg(`Beacon export 완료 (병합) · ${result.artifactPath ?? ''}`);
        return;
      }
      if (!result.ok) {
        setExportMsg(result.message ?? 'export 실패');
        return;
      }
      setExportMsg(`Beacon 산출물로 저장됨 · ${result.artifactPath ?? ''}`);
      void recordFolioTimelineEvent({
        title: `문서 export · ${payload.title}`,
        detail: result.artifactPath,
        type: 'docs_export',
        category: 'docs',
      });
    } finally {
      setExportBusy(false);
    }
  };

  const doDelete = async () => {
    if (!selectedId) return;
    const id = selectedId;
    const deleted = docs.find((d) => d.id === id);
    setDocs(prev => prev.filter(d => d.id !== id));
    setSelectedId(null);
    try {
      await deleteDocWithFallback(id);
      void recordFolioTimelineEvent({
        title: `문서 삭제 · ${deleted?.title ?? id}`,
        type: 'docs_delete',
        category: 'docs',
      });
    } catch {
      /* UI는 이미 반영 */
    }
  };

  const importObsidian = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const notes = await readObsidianMarkdownFiles(files, 'docs');
      const existingTitles = new Set(docs.map(d => d.title.toLowerCase()));
      let imported = 0;
      let renamed = 0;
      const now = new Date().toISOString();

      for (const note of notes) {
        const titleBase = note.title || note.fileName.replace(/\.md$/i, '');
        const hadConflict = existingTitles.has(titleBase.toLowerCase());
        const finalTitle = uniqueDocTitle(titleBase, existingTitles);
        if (hadConflict) renamed += 1;
        existingTitles.add(finalTitle.toLowerCase());

        const body =
          note.tags.length > 0
            ? `${note.content}\n\n<!-- tags: ${note.tags.map(t => `#${t}`).join(' ')} -->`
            : note.content;

        await saveDocWithFallback({
          id: crypto.randomUUID(),
          title: finalTitle,
          content: body,
          category: 'Obsidian Import',
          createdAt: now,
          updatedAt: now,
        });
        imported += 1;
      }

      const next = await loadDocsWithFallback();
      setDocs(next);
      setCategories(loadCategories(next));
      setImportMsg(
        notes.length === 0
          ? '가져올 .md 파일이 없습니다.'
          : `${imported}개 가져옴${renamed > 0 ? ` (이름 충돌 ${renamed}건 → (2) suffix)` : ''}`,
      );
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const filtered = docs
    .filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.content.toLowerCase().includes(search.toLowerCase()))
    .filter(d => !filterCat || d.category === filterCat)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const openDocById = useCallback(
    (id: string) => {
      const doc = docs.find((d) => d.id === id);
      if (doc) void selectDoc(doc);
    },
    [docs, selectDoc],
  );

  const backlinks = useMemo(
    () => (selectedId ? findBacklinks(docs, selectedId) : []),
    [docs, selectedId],
  );

  const paneButton = (pane: EditPane, label: string, icon: ReactNode) => (
    <Button
      key={pane}
      type="button"
      size="sm"
      variant={editPane === pane ? 'default' : 'ghost'}
      onClick={() => setEditPane(pane)}
      aria-pressed={editPane === pane}
      aria-label={`${label} 보기`}
      className={`h-7 gap-1 text-xs ${editPane === pane ? 'bg-gray-900 hover:bg-gray-800' : ''}`}
    >
      {icon}
      {label}
    </Button>
  );

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (filtered.length === 0) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const idx = filtered.findIndex(d => d.id === selectedId);
    const nextIdx =
      e.key === 'ArrowDown'
        ? Math.min(filtered.length - 1, (idx < 0 ? -1 : idx) + 1)
        : Math.max(0, (idx < 0 ? 0 : idx) - 1);
    const next = filtered[nextIdx];
    if (next) selectDoc(next);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr_280px] lg:grid-cols-[240px_1fr] gap-6">
      {/* Sidebar */}
      <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-gray-50 space-y-2">
          <Button type="button" onClick={() => void startNew()} size="sm" className="w-full gap-2 bg-gray-900 hover:bg-gray-800">
            <Plus className="h-4 w-4" /> 새 문서
          </Button>
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
            className="w-full gap-2"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {importing ? '가져오는 중…' : 'Obsidian 가져오기'}
          </Button>
          {importMsg && <p className="text-[11px] text-gray-500 px-0.5">{importMsg}</p>}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="검색..."
              className="pl-8 h-8 text-xs"
              aria-label="문서 검색"
            />
          </div>
        </div>
        <div className="p-2 flex flex-wrap gap-1 border-b border-gray-50" role="group" aria-label="카테고리 필터">
          <Badge variant={filterCat === null ? 'default' : 'secondary'} className="cursor-pointer text-xs" onClick={() => setFilterCat(null)}>전체</Badge>
          {categories.map(cat => (
            <Badge key={cat} variant={filterCat === cat ? 'default' : 'secondary'} className="cursor-pointer text-xs" onClick={() => setFilterCat(filterCat === cat ? null : cat)}>
              {cat}
            </Badge>
          ))}
        </div>
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div
            ref={listRef}
            className="p-2 space-y-1"
            role="listbox"
            aria-label="문서 목록. 위아래 화살표로 선택"
            tabIndex={0}
            onKeyDown={onListKeyDown}
          >
            {filtered.length === 0 && (
              <div className="px-2 py-8 text-center" role="status">
                <p className="text-xs font-medium text-gray-500 mb-1">문서가 없습니다</p>
                <p className="text-[11px] text-gray-400">「새 문서」로 첫 문서를 만들어 보세요</p>
              </div>
            )}
            {filtered.map(doc => (
              <button
                key={doc.id}
                type="button"
                role="option"
                aria-selected={selectedId === doc.id}
                aria-current={selectedId === doc.id ? 'true' : undefined}
                onClick={() => selectDoc(doc)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${
                  selectedId === doc.id ? 'bg-gray-50 ring-1 ring-gray-200' : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-gray-800 truncate">{doc.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-auto">{doc.category}</Badge>
                  <span className="text-[10px] text-gray-400">{new Date(doc.updatedAt).toLocaleDateString('ko-KR')}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Editor */}
      <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
        {selectedId && docs.find(d => d.id === selectedId) ? (
          <>
            <div className="flex items-center justify-between p-4 border-b border-gray-50 gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                {editing ? (
                  <>
                    <label htmlFor="doc-title" className="sr-only">
                      문서 제목 (필수)
                    </label>
                    <Input
                      id="doc-title"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="h-8 text-sm border-0 focus-visible:ring-0 px-0"
                      required
                      aria-required="true"
                      aria-describedby="doc-title-hint"
                    />
                  </>
                ) : (
                  <span className="font-medium truncate">{docs.find(d => d.id === selectedId)?.title}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editing ? (
                  <>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                      aria-label="문서 카테고리"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void doSave()}
                      className="gap-1 bg-gray-900 hover:bg-gray-800"
                      aria-busy={saveState === 'saving'}
                      aria-label={saveState === 'saving' ? '저장 중' : '문서 저장'}
                    >
                      {saveState === 'saving' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}{' '}
                      {saveState === 'saving' ? '저장 중' : '저장'}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setEditPane('edit'); }} aria-label="편집 취소">취소</Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline">{docs.find(d => d.id === selectedId)?.category}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      disabled={exportBusy}
                      onClick={() => void exportToBeacon()}
                      aria-label="Beacon으로 export"
                    >
                      {exportBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                      Beacon으로 export
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={startEdit} aria-label="문서 편집">편집</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void doDelete()} className="text-red-500 hover:text-red-600" aria-label="문서 삭제">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {exportMsg && (
              <p className="px-4 pt-1 text-[11px] text-muted-foreground">{exportMsg}</p>
            )}
            {editing && (
              <p id="doc-title-hint" className="px-4 pt-1 text-[11px] text-muted-foreground">
                제목은 필수 입력 항목입니다.
              </p>
            )}
            {saveError && (
              <div role="alert" className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <span className="flex-1">{saveError}</span>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => void doSave()}>
                  다시 시도
                </Button>
              </div>
            )}
            <span className="sr-only" aria-live="polite">
              {saveState === 'saved' ? '문서가 저장되었습니다' : saveState === 'saving' ? '문서 저장 중' : ''}
            </span>

            {editing && (
              <div className="px-4 pt-3 flex items-center gap-1">
                {paneButton('edit', '편집', <Pencil className="h-3 w-3" />)}
                {paneButton('preview', '미리보기', <Eye className="h-3 w-3" />)}
                {paneButton('split', '분할', <Columns2 className="h-3 w-3" />)}
              </div>
            )}

            <div className="flex-1 p-4">
              {editing ? (
                editPane === 'split' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[400px]">
                    <WikiLinkTextarea
                      value={content}
                      onChange={setContent}
                      docs={docs}
                      excludeDocId={selectedId}
                      placeholder="마크다운으로 작성 · [[문서명]] 링크 지원"
                      className="min-h-[400px] resize-none border border-gray-100 rounded-xl text-sm leading-relaxed font-mono"
                    />
                    <ScrollArea className="h-[400px] rounded-xl border border-gray-100 p-3">
                      <MarkdownPreview content={content} docs={docs} onOpenDoc={openDocById} />
                    </ScrollArea>
                  </div>
                ) : editPane === 'preview' ? (
                  <ScrollArea className="h-[450px]">
                    <MarkdownPreview content={content} docs={docs} onOpenDoc={openDocById} />
                  </ScrollArea>
                ) : (
                  <WikiLinkTextarea
                    value={content}
                    onChange={setContent}
                    docs={docs}
                    excludeDocId={selectedId}
                    placeholder="마크다운으로 작성 · [[ 입력 시 문서 자동완성"
                    className="min-h-[400px] resize-none border-0 focus-visible:ring-0 text-sm leading-relaxed p-0 font-mono"
                  />
                )
              ) : (
                <ScrollArea className="h-[450px]">
                  <MarkdownPreview content={content} docs={docs} onOpenDoc={openDocById} />
                </ScrollArea>
              )}
            </div>

            {backlinks.length > 0 && (
              <div className="border-t border-gray-50 px-4 py-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <Link2 className="h-3.5 w-3.5" aria-hidden />
                  역링크 ({backlinks.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {backlinks.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => openDocById(d.id)}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100"
                    >
                      {d.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>문서를 선택하거나 새 문서를 만드세요</p>
              <p className="mt-1 text-[11px] text-gray-400">본문에 [[문서명]] 으로 링크를 걸 수 있습니다</p>
            </div>
          </div>
        )}
      </Card>

      {/* 링크 그래프 — xl: 우측 / 그 외: 하단 풀폭 */}
      <div className="min-h-[320px] lg:col-span-2 xl:col-span-1 xl:min-h-[420px]">
        <LinkGraphPanel
          docs={docs}
          selectedId={selectedId}
          onSelectDoc={openDocById}
        />
      </div>
    </div>
  );
});
