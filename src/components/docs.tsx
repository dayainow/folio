'use client';

import { useState, useCallback, useEffect, useRef, memo, type ReactNode, type ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import { loadDocsWithFallback, saveDocWithFallback, deleteDocWithFallback, loadCategories, type DocEntry } from '@/lib/docs';
import { readObsidianMarkdownFiles, uniqueDocTitle } from '@/lib/obsidian';

type EditPane = 'edit' | 'preview' | 'split';

function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="text-sm text-gray-400">(빈 문서)</p>;
  }

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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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

  const refresh = useCallback(async () => {
    const next = await loadDocsWithFallback();
    setDocs(next);
  }, []);

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectDoc = useCallback((doc: DocEntry) => {
    setSelectedId(doc.id);
    setTitle(doc.title);
    setContent(doc.content);
    setCategory(doc.category);
    setEditing(false);
    setEditPane('edit');
  }, []);

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
    await saveDocWithFallback(newDoc);
    await refresh();
    selectDoc(newDoc);
    setEditPane('edit');
    setEditing(true);
  };

  const doSave = async () => {
    if (!selectedId) return;
    await saveDocWithFallback({
      id: selectedId,
      title,
      content,
      category,
      createdAt: docs.find(d => d.id === selectedId)!.createdAt,
      updatedAt: new Date().toISOString(),
    });
    await refresh();
    setEditing(false);
    setEditPane('edit');
  };

  const doDelete = async () => {
    if (!selectedId) return;
    await deleteDocWithFallback(selectedId);
    setSelectedId(null);
    await refresh();
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

  const paneButton = (pane: EditPane, label: string, icon: ReactNode) => (
    <Button
      key={pane}
      size="sm"
      variant={editPane === pane ? 'default' : 'ghost'}
      onClick={() => setEditPane(pane)}
      className={`h-7 gap-1 text-xs ${editPane === pane ? 'bg-gray-900 hover:bg-gray-800' : ''}`}
    >
      {icon}
      {label}
    </Button>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Sidebar */}
      <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-gray-50 space-y-2">
          <Button onClick={startNew} size="sm" className="w-full gap-2 bg-gray-900 hover:bg-gray-800">
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
            />
          </div>
        </div>
        <div className="p-2 flex flex-wrap gap-1 border-b border-gray-50">
          <Badge variant={filterCat === null ? 'default' : 'secondary'} className="cursor-pointer text-xs" onClick={() => setFilterCat(null)}>전체</Badge>
          {categories.map(cat => (
            <Badge key={cat} variant={filterCat === cat ? 'default' : 'secondary'} className="cursor-pointer text-xs" onClick={() => setFilterCat(filterCat === cat ? null : cat)}>
              {cat}
            </Badge>
          ))}
        </div>
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="p-2 space-y-1">
            {filtered.length === 0 && <span className="text-xs text-gray-400 px-2 py-4 block text-center">문서 없음</span>}
            {filtered.map(doc => (
              <button
                key={doc.id}
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
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="h-8 text-sm border-0 focus-visible:ring-0 px-0"
                  />
                ) : (
                  <span className="font-medium truncate">{docs.find(d => d.id === selectedId)?.title}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editing ? (
                  <>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <Button size="sm" onClick={doSave} className="gap-1 bg-gray-900 hover:bg-gray-800">
                      <Save className="h-3 w-3" /> 저장
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditPane('edit'); }}>취소</Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline">{docs.find(d => d.id === selectedId)?.category}</Badge>
                    <Button size="sm" variant="ghost" onClick={startEdit}>편집</Button>
                    <Button size="sm" variant="ghost" onClick={doDelete} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>

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
                    <Textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="마크다운으로 문서를 작성하세요..."
                      className="min-h-[400px] resize-none border border-gray-100 rounded-xl text-sm leading-relaxed font-mono"
                    />
                    <ScrollArea className="h-[400px] rounded-xl border border-gray-100 p-3">
                      <MarkdownPreview content={content} />
                    </ScrollArea>
                  </div>
                ) : editPane === 'preview' ? (
                  <ScrollArea className="h-[450px]">
                    <MarkdownPreview content={content} />
                  </ScrollArea>
                ) : (
                  <Textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="마크다운으로 문서를 작성하세요..."
                    className="min-h-[400px] resize-none border-0 focus-visible:ring-0 text-sm leading-relaxed p-0 font-mono"
                  />
                )
              ) : (
                <ScrollArea className="h-[450px]">
                  <MarkdownPreview content={content} />
                </ScrollArea>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>문서를 선택하거나 새 문서를 만드세요</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
});
