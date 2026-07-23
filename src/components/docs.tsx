'use client';

import { useState, useCallback } from 'react';
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
} from 'lucide-react';
import { loadDocs, saveDoc, deleteDoc, loadCategories, type DocEntry } from '@/lib/docs';

export function DocsPanel() {
  const [docs, setDocs] = useState<DocEntry[]>(() => loadDocs());
  const refresh = () => setDocs(loadDocs());
  const [categories] = useState<string[]>(loadCategories);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Dev Guide');

  const selectDoc = useCallback((doc: DocEntry) => {
    setSelectedId(doc.id);
    setTitle(doc.title);
    setContent(doc.content);
    setCategory(doc.category);
    setEditing(false);
  }, []);

  const startNew = () => {
    const newDoc: DocEntry = {
      id: crypto.randomUUID(),
      title: '새 문서',
      content: '',
      category: filterCat || 'Dev Guide',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDoc(newDoc);
    refresh();
    selectDoc(newDoc);
    setEditing(true);
  };

  const doSave = () => {
    if (!selectedId) return;
    saveDoc({ id: selectedId, title, content, category, createdAt: docs.find(d => d.id === selectedId)!.createdAt, updatedAt: new Date().toISOString() });
    refresh();
    setEditing(false);
  };

  const doDelete = () => {
    if (!selectedId) return;
    deleteDoc(selectedId);
    setSelectedId(null);
    refresh();
  };

  const filtered = docs
    .filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()) || d.content.toLowerCase().includes(search.toLowerCase()))
    .filter(d => !filterCat || d.category === filterCat)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Sidebar */}
      <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-3 border-b border-gray-50 space-y-2">
          <Button onClick={startNew} size="sm" className="w-full gap-2 bg-gray-900 hover:bg-gray-800">
            <Plus className="h-4 w-4" /> 새 문서
          </Button>
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
            <div className="flex items-center justify-between p-4 border-b border-gray-50">
              <div className="flex items-center gap-3 flex-1">
                <FileText className="h-4 w-4 text-gray-400" />
                {editing ? (
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="h-8 text-sm border-0 focus-visible:ring-0 px-0"
                  />
                ) : (
                  <span className="font-medium">{docs.find(d => d.id === selectedId)?.title}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <Button size="sm" onClick={doSave} className="gap-1 bg-gray-900 hover:bg-gray-800">
                      <Save className="h-3 w-3" /> 저장
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>취소</Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline">{docs.find(d => d.id === selectedId)?.category}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>편집</Button>
                    <Button size="sm" variant="ghost" onClick={doDelete} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 p-4">
              {editing ? (
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="마크다운으로 문서를 작성하세요..."
                  className="min-h-[400px] resize-none border-0 focus-visible:ring-0 text-sm leading-relaxed p-0 font-mono"
                />
              ) : (
                <ScrollArea className="h-[450px]">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800">
                      {content || '(빈 문서)'}
                    </pre>
                  </div>
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
}
