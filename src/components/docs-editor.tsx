'use client';

/**
 * P62-1 — 문서 「작성」 에디터 (선택기 · 자동저장)
 */
import { useState, useCallback, useEffect, useEffectEvent, useMemo, useRef, memo, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { OptimizedImage } from '@/components/optimized-image';
import {
  Plus,
  FileText,
  Trash2,
  Save,
  Columns2,
  Eye,
  Pencil,
  Loader2,
  Share2,
  Link2,
  Bookmark,
  History,
} from 'lucide-react';
import { loadDocsWithFallback, saveDocWithFallback, deleteDocWithFallback, loadCategories, type DocEntry } from '@/lib/docs';
import {
  deleteDocVersions,
  restoreFromVersion,
  snapshotOnSave,
  startDocAutoSnapshot,
  stopDocAutoSnapshot,
  checkoutVersionAsDoc,
  type DocVersion,
} from '@/lib/doc-versions';
import { DocDiffViewer } from '@/components/doc-diff';
import { DocVersionSelect, DocVersionsPanel } from '@/components/doc-versions-panel';
import { TemplatePicker } from '@/components/template-picker';
import type { FolioTemplate } from '@/lib/templates';
import { toggleBookmark, isBookmarked } from '@/lib/bookmarks';
import { notifyBookmarksChanged } from '@/components/bookmarks-sidebar';
import { exportDocToBeacon, fetchBeaconMtimes } from '@/lib/beacon';
import { getBeaconAutoArtifact } from '@/lib/beacon-automation';
import { recordFolioTimelineEvent } from '@/lib/beacon-timeline-consent';
import { findBacklinks, wikiLinksToMarkdown } from '@/lib/link-parser';
import { WikiLinkTextarea } from '@/components/wiki-link-textarea';
import { ExportMenu } from '@/components/export-menu';
import { ShareResourceButton } from '@/components/share-resource';
import { PresenceBar } from '@/components/presence-bar';
import { CollabTextarea } from '@/components/collab-textarea';
import { DocCommentsPanel } from '@/components/doc-comments';
import { useCollabUser } from '@/hooks/use-collab-user';
import { publishActivity } from '@/lib/activity-stream';
import { getOrCreateGuestId } from '@/lib/presence';
import { subscribeMobileAction } from '@/lib/mobile-actions';
import {
  docFilename,
  docToMarkdown,
  downloadText,
} from '@/lib/export';
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
          img: ({ src, alt }) => (
            <OptimizedImage src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} />
          ),
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

export const DocsEditor = memo(function DocsEditor({
  focusDocId,
  onFocusHandled,
  writingFirst = false,
  onDirtyChange,
}: {
  focusDocId?: string | null;
  onFocusHandled?: () => void;
  writingFirst?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
} = {}) {
  const collabUser = useCollabUser();
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
  const [editing, setEditing] = useState(false);
  const baselineRef = useRef({ title: '', content: '', category: '' });
  const dirtyRef = useRef(false);

  const [editPane, setEditPane] = useState<EditPane>('edit');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Dev Guide');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [diffVersion, setDiffVersion] = useState<DocVersion | null>(null);
  const draftRef = useRef({ selectedId, title, content, category, docs });

  useEffect(() => {
    draftRef.current = { selectedId, title, content, category, docs };
  }, [selectedId, title, content, category, docs]);

  useEffect(() => {
    if (!selectedId) {
      dirtyRef.current = false;
      onDirtyChange?.(false);
      return;
    }
    const dirty =
      title !== baselineRef.current.title ||
      content !== baselineRef.current.content ||
      category !== baselineRef.current.category;
    dirtyRef.current = dirty;
    onDirtyChange?.(dirty);
  }, [selectedId, title, content, category, onDirtyChange]);

  // 선택 시 베이스라인 동기화
  useEffect(() => {
    if (!selectedId) return;
    const doc = docs.find((d) => d.id === selectedId);
    if (!doc) return;
    // 최초 로드/외부 선택만 — 편집 중이면 건너뜀은 selectDoc에서 처리
  }, [selectedId, docs]);

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
    baselineRef.current = { title: doc.title, content: doc.content, category: doc.category };
    dirtyRef.current = false;
    onDirtyChange?.(false);
    setEditing(false);
    setEditPane('edit');
  }, [editing, selectedId, docs, title, content, category, onDirtyChange]);

  useEffect(() => {
    if (!focusDocId || docs.length === 0) return;
    const doc = docs.find(d => d.id === focusDocId);
    const handle = window.setTimeout(() => {
      if (doc) {
        selectDoc(doc);
      }
      onFocusHandled?.();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [focusDocId, docs, selectDoc, onFocusHandled]);

  const startEdit = () => {
    setEditPane('edit');
    setEditing(true);
  };

  const startNew = async (fromTemplate?: FolioTemplate) => {
    const newDoc: DocEntry = {
      id: crypto.randomUUID(),
      title: fromTemplate?.name ?? '새 문서',
      content: fromTemplate?.body ?? '',
      category: fromTemplate?.category || category || 'Dev Guide',
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

  const doSave = async (opts?: { keepEditing?: boolean }) => {
    if (!selectedId) return;
    if (!title.trim()) {
      setSaveError('문서 제목은 필수입니다.');
      setSaveState('error');
      return;
    }
    const previous = docs.find(d => d.id === selectedId) ?? null;
    const createdAt = previous?.createdAt ?? new Date().toISOString();
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
    if (!opts?.keepEditing) {
      setEditing(false);
      setEditPane('edit');
    }
    try {
      await saveDocWithFallback(updated);
      snapshotOnSave(updated, previous);
      setSaveState('saved');
      baselineRef.current = { title: updated.title, content: updated.content, category: updated.category };
      dirtyRef.current = false;
      onDirtyChange?.(false);
      window.setTimeout(() => setSaveState('idle'), 2000);
      void publishActivity({
        type: 'save',
        actorId: collabUser?.id ?? getOrCreateGuestId(),
        actorName: collabUser?.name || collabUser?.email?.split('@')[0] || '게스트',
        targetKind: 'doc',
        targetId: updated.id,
        summary: `문서 저장 · ${updated.title}`,
      });
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

  // P59 — 5분 자동 스냅샷 (선택 문서 기준)
  useEffect(() => {
    if (!selectedId) return;
    return startDocAutoSnapshot(selectedId, () => {
      const d = draftRef.current;
      if (!d.selectedId) return null;
      const createdAt =
        d.docs.find((x) => x.id === d.selectedId)?.createdAt ?? new Date().toISOString();
      return {
        id: d.selectedId,
        title: d.title.trim() || '제목 없음',
        content: d.content,
        category: d.category,
        createdAt,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (selectedId) stopDocAutoSnapshot(selectedId);
    };
  }, [selectedId]);

  // P44 — FAB 새 문서 / 저장
  const onMobileAction = useEffectEvent((action: { type: string }) => {
    if (action.type === 'new-doc') {
      void startNew();
      return;
    }
    if (action.type === 'save') {
      void doSave();
    }
  });
  useEffect(() => subscribeMobileAction(onMobileAction), []);

  // P62-1 — 3초 디바운스 자동 저장
  useEffect(() => {
    if (!selectedId || !editing) return;
    if (!title.trim()) return;
    const dirty =
      title !== baselineRef.current.title ||
      content !== baselineRef.current.content ||
      category !== baselineRef.current.category;
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      void doSave({ keepEditing: true });
    }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on draft fields only
  }, [selectedId, editing, title, content, category]);

  const onShortcutNewDoc = useEffectEvent(() => {
    void startNew();
  });
  useEffect(() => {
    const onNew = () => onShortcutNewDoc();
    window.addEventListener('folio:new-doc', onNew);
    return () => window.removeEventListener('folio:new-doc', onNew);
  }, []);

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
    deleteDocVersions(id);
    stopDocAutoSnapshot(id);
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

  const applyVersionRestore = (v: DocVersion) => {
    if (!window.confirm(`${v.label}로 복원할까요? 현재 편집 내용이 덮어씌워집니다.`)) return;
    const fields = restoreFromVersion(v);
    setTitle(fields.title);
    setContent(fields.content);
    setCategory(fields.category);
    setEditing(true);
    setShowVersions(true);
  };

  const openDiff = (v: DocVersion) => {
    setDiffVersion(v);
  };

  const checkoutVersion = async (v: DocVersion, newTitle: string) => {
    const draft = checkoutVersionAsDoc(v, newTitle);
    const newDoc: DocEntry = {
      id: crypto.randomUUID(),
      title: draft.title,
      content: draft.content,
      category: draft.category,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
    setDocs((prev) => [newDoc, ...prev]);
    selectDoc(newDoc);
    setEditing(true);
    setDiffVersion(null);
    try {
      await saveDocWithFallback(newDoc);
      snapshotOnSave(newDoc, null);
    } catch {
      /* UI 반영됨 */
    }
  };

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

  const editorMinH = writingFirst
    ? 'h-[calc(100dvh-14rem)] max-h-[calc(100dvh-14rem)] min-h-[12rem] field-sizing-fixed lg:h-[calc(100dvh-12rem)] lg:max-h-[calc(100dvh-12rem)]'
    : 'min-h-[400px]';
  const previewH = writingFirst
    ? 'h-[calc(100dvh-14rem)] max-h-[calc(100dvh-14rem)] lg:h-[calc(100dvh-12rem)] lg:max-h-[calc(100dvh-12rem)]'
    : 'h-[450px]';

  return (
    <div
      className={
        writingFirst
          ? 'grid grid-cols-1 gap-3 lg:min-h-0'
          : 'grid grid-cols-1 gap-4'
      }
    >
      {/* 문서 선택기 */}
      <Card className="rounded-2xl border border-slate-100 p-3 shadow-sm dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="docs-editor-pick">문서 선택</label>
          <select
            id="docs-editor-pick"
            className="h-11 min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-background px-3 text-sm dark:border-slate-700"
            value={selectedId ?? ''}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const doc = docs.find((d) => d.id === id);
              if (doc) void selectDoc(doc);
            }}
            aria-label="문서 선택"
          >
            <option value="" disabled>
              문서 선택…
            </option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title || '(제목 없음)'}
              </option>
            ))}
          </select>
          <Button type="button" onClick={() => void startNew()} className="gap-2">
            <Plus className="h-4 w-4" /> 새 문서
          </Button>
          <TemplatePicker kind="doc" onApply={(tpl) => void startNew(tpl)} />
        </div>
      </Card>

      {/* Editor */}
      <Card
        className={`rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col ${
          writingFirst ? 'min-h-0 lg:h-full' : 'min-h-[500px]'
        }`}
      >
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
                      onChange={e => { setTitle(e.target.value); setEditing(true); }}
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
                <DocVersionSelect
                  docId={selectedId}
                  onPick={(v) => {
                    setShowVersions(true);
                    openDiff(v);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={showVersions ? 'default' : 'ghost'}
                  className="h-8 gap-1 px-2"
                  aria-label="버전 이력"
                  aria-pressed={showVersions}
                  onClick={() => setShowVersions((v) => !v)}
                >
                  <History className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px]">버전</span>
                </Button>
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
                    <ShareResourceButton
                      kind="doc"
                      resourceId={selectedId}
                      resourceLabel={docs.find((d) => d.id === selectedId)?.title ?? '문서'}
                      actorName={collabUser?.name}
                      actorId={collabUser?.id}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 px-2"
                      aria-label="북마크"
                      onClick={() => {
                        const doc = docs.find((d) => d.id === selectedId)
                        if (!doc) return
                        toggleBookmark({
                          kind: 'doc',
                          targetId: doc.id,
                          title: doc.title,
                          tags: [doc.category],
                        })
                        notifyBookmarksChanged()
                      }}
                    >
                      <Bookmark
                        className={`h-3.5 w-3.5 ${isBookmarked('doc', selectedId) ? 'fill-amber-400 text-amber-500' : ''}`}
                      />
                    </Button>
                    <ExportMenu
                      label="MD"
                      items={[
                        {
                          id: 'md-current',
                          label: '이 문서 Markdown',
                          description: '개별 .md 다운로드',
                          run: async (setProgress) => {
                            const doc = docs.find((d) => d.id === selectedId)
                            if (!doc) throw new Error('문서 없음')
                            setProgress(0.5, '변환…')
                            downloadText(
                              docToMarkdown(doc),
                              docFilename(doc),
                              'text/markdown;charset=utf-8',
                            )
                            setProgress(1, '완료')
                          },
                        },
                      ]}
                    />
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

            {showVersions && selectedId && (
              <div className="border-b border-gray-50 px-3 py-2 dark:border-gray-800">
                <DocVersionsPanel
                  doc={
                    docs.find((d) => d.id === selectedId) ?? {
                      id: selectedId,
                      title,
                      content,
                      category,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }
                  }
                  currentContent={content}
                  currentTitle={title}
                  onCompare={openDiff}
                  onRestore={applyVersionRestore}
                  className="max-h-64"
                />
              </div>
            )}

            {editing && (
              <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
                {paneButton('edit', '편집', <Pencil className="h-3 w-3" />)}
                {paneButton('preview', '미리보기', <Eye className="h-3 w-3" />)}
                {paneButton('split', '분할', <Columns2 className="h-3 w-3" />)}
                {selectedId && (
                  <PresenceBar
                    className="ml-auto"
                    roomId={`doc:${selectedId}`}
                    tab="docs"
                    user={collabUser}
                  />
                )}
              </div>
            )}

            <div className="flex-1 p-4">
              {editing ? (
                editPane === 'split' ? (
                  <div className="grid min-h-0 grid-cols-1 gap-4 md:grid-cols-2">
                    {selectedId ? (
                      <CollabTextarea
                        roomId={`doc:${selectedId}`}
                        value={content}
                        onChange={(v) => { setContent(v); setEditing(true); }}
                        user={collabUser}
                        placeholder="마크다운으로 작성 · [[문서명]] 링크 · 실시간 협업"
                        className={`${editorMinH} resize-none border border-gray-100 rounded-xl text-sm leading-relaxed font-mono`}
                      />
                    ) : (
                      <WikiLinkTextarea
                        value={content}
                        onChange={(v) => { setContent(v); setEditing(true); }}
                        docs={docs}
                        excludeDocId={selectedId}
                        placeholder="마크다운으로 작성 · [[문서명]] 링크 지원"
                        className={`${editorMinH} resize-none border border-gray-100 rounded-xl text-sm leading-relaxed font-mono`}
                      />
                    )}
                    <ScrollArea
                      className={`${writingFirst ? 'h-[calc(100dvh-14rem)] lg:h-[calc(100dvh-12rem)]' : 'h-[400px]'} rounded-xl border border-gray-100 p-3`}
                    >
                      <MarkdownPreview content={content} docs={docs} onOpenDoc={openDocById} />
                    </ScrollArea>
                  </div>
                ) : editPane === 'preview' ? (
                  <ScrollArea className={previewH}>
                    <MarkdownPreview content={content} docs={docs} onOpenDoc={openDocById} />
                  </ScrollArea>
                ) : selectedId ? (
                  <CollabTextarea
                    roomId={`doc:${selectedId}`}
                    value={content}
                    onChange={(v) => { setContent(v); setEditing(true); }}
                    user={collabUser}
                    placeholder="마크다운으로 작성 · [[ 위키링크 · 실시간 협업(Yjs)"
                    className={`${editorMinH} resize-none border-0 focus-visible:ring-0 text-sm leading-relaxed p-0 font-mono`}
                  />
                ) : (
                  <WikiLinkTextarea
                    value={content}
                    onChange={(v) => { setContent(v); setEditing(true); }}
                    docs={docs}
                    excludeDocId={selectedId}
                    placeholder="마크다운으로 작성 · [[ 입력 시 문서 자동완성"
                    className={`${editorMinH} resize-none border-0 focus-visible:ring-0 text-sm leading-relaxed p-0 font-mono`}
                  />
                )
              ) : (
                <ScrollArea className={previewH}>
                  <MarkdownPreview content={content} docs={docs} onOpenDoc={openDocById} />
                </ScrollArea>
              )}
            </div>

            {selectedId && (
              <div className="border-t border-gray-50 px-4 py-3">
                <DocCommentsPanel
                  targetKind="doc"
                  targetId={selectedId}
                  user={collabUser}
                  mentionSuggestions={
                    collabUser?.email ? [collabUser.email.split('@')[0]!] : []
                  }
                />
              </div>
            )}

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


      {/* 하단 메타 · 저장 */}
      {selectedId && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/50">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            카테고리
            <Input
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setEditing(true);
              }}
              className="h-11 w-40 text-xs"
              list="docs-editor-categories"
            />
            <datalist id="docs-editor-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <ExportMenu
              label="내보내기"
              items={[
                {
                  id: 'md-one',
                  label: 'Markdown',
                  run: async (setProgress) => {
                    const doc = docs.find((d) => d.id === selectedId);
                    if (!doc) throw new Error('문서 없음');
                    setProgress(0.5, '변환…');
                    const payload = { ...doc, title: title.trim() || doc.title, content, category };
                    downloadText(docToMarkdown(payload), docFilename(payload), 'text/markdown;charset=utf-8');
                    setProgress(1, '완료');
                  },
                },
              ]}
            />
            <Button
              type="button"
              disabled={saveState === 'saving' || !selectedId}
              onClick={() => void doSave({ keepEditing: true })}
              className="gap-2"
              aria-label="문서 저장"
            >
              {saveState === 'saving' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveState === 'saved' ? '저장됨' : '저장'}
            </Button>
          </div>
        </div>
      )}

      {/* 링크 그래프 — writing-first: 하단 전체 폭, 고정 높이(잘림 방지) */}
      {selectedId && (!writingFirst || docs.length > 0) && (
        <div
          className={
            writingFirst
              ? 'h-[22rem] lg:col-span-2'
              : 'min-h-[320px] lg:col-span-2 xl:col-span-1 xl:min-h-[420px]'
          }
        >
          <LinkGraphPanel
            docs={docs}
            selectedId={selectedId}
            onSelectDoc={openDocById}
            compact={writingFirst}
          />
        </div>
      )}

      <DocDiffViewer
        open={Boolean(diffVersion)}
        onClose={() => setDiffVersion(null)}
        before={
          diffVersion ?? {
            label: '—',
            title: '',
            content: '',
          }
        }
        after={{
          label: '현재',
          title,
          content,
        }}
        onRestore={
          diffVersion
            ? () => {
                applyVersionRestore(diffVersion);
                setDiffVersion(null);
              }
            : undefined
        }
        onCheckout={
          diffVersion
            ? (newTitle) => {
                void checkoutVersion(diffVersion, newTitle);
              }
            : undefined
        }
      />
    </div>
  );
});
