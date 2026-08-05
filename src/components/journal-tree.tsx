'use client'

/**
 * P58 — 일지 트리 사이드바 (폴더 · DnD · bulk · 우클릭 · 검색 하이라이트)
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  FileText,
  MoreHorizontal,
  Trash2,
  Pencil,
  Download,
  Tag,
  Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { JournalEntry, JournalStatus } from '@/lib/journal'
import { bulkPatchJournalMeta, loadJournals } from '@/lib/journal'
import {
  buildJournalTree,
  bulkMoveJournals,
  collectDatesInFolder,
  createFolder,
  deleteFolder,
  exportJournalsMarkdown,
  loadJournalTree,
  clearJournalCustomRefs,
  moveJournalToFolder,
  renameFolder,
  setFolderCollapsed,
  toggleFolderCollapsed,
  type TreeNode,
  SYSTEM_FOLDER_IDS,
} from '@/lib/journal-tree'
import { downloadText } from '@/lib/export'

type CtxMenu = {
  x: number
  y: number
  folderId: string | null
  journalDate: string | null
}

export type JournalTreeProps = {
  journals: Record<string, JournalEntry>
  selectedDate?: string | null
  selectedFolderId?: string | null
  searchQuery?: string
  onSelectDate?: (date: string) => void
  onSelectFolder?: (folderId: string | null) => void
  onJournalsChange?: () => void
  /** 일지 본문 삭제(맵에서 제거) — 부모가 처리 */
  onDeleteJournals?: (dates: string[]) => void
  className?: string
}

export function JournalTree({
  journals,
  selectedDate,
  selectedFolderId,
  searchQuery = '',
  onSelectDate,
  onSelectFolder,
  onJournalsChange,
  onDeleteJournals,
  className,
}: JournalTreeProps) {
  const [tick, setTick] = useState(0)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(loadJournalTree().collapsed))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastClicked, setLastClicked] = useState<string | null>(null)
  const [ctx, setCtx] = useState<CtxMenu | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [localFilter, setLocalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<JournalStatus | 'all'>('all')
  const [dragDate, setDragDate] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)

  const filterQ = localFilter || searchQuery

  const refresh = useCallback(() => {
    setCollapsed(new Set(loadJournalTree().collapsed))
    setTick((t) => t + 1)
    onJournalsChange?.()
  }, [onJournalsChange])

  const tree = useMemo(
    () =>
      buildJournalTree({
        journals,
        searchQuery: filterQ,
        statusFilter,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces reload after mutations
    [journals, filterQ, statusFilter, tick],
  )

  const flatJournalDates = useMemo(() => {
    const out: string[] = []
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.kind === 'journal' && n.journalDate) out.push(n.journalDate)
        walk(n.children)
      }
    }
    walk(tree)
    return out
  }, [tree])

  const closeCtx = () => setCtx(null)

  useEffect(() => {
    const onDoc = () => closeCtx()
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const toggleCollapse = (folderId: string) => {
    const next = toggleFolderCollapsed(folderId)
    setCollapsed(new Set(next))
  }

  const onCheckClick = (date: string, e: MouseEvent) => {
    e.stopPropagation()
    setSelected((prev) => {
      const next = new Set(prev)
      if (e.shiftKey && lastClicked) {
        const a = flatJournalDates.indexOf(lastClicked)
        const b = flatJournalDates.indexOf(date)
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          for (let i = lo; i <= hi; i++) next.add(flatJournalDates[i])
          return next
        }
      }
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
    setLastClicked(date)
  }

  const handleNewFolder = (parentId: string | null) => {
    const name = window.prompt('새 폴더 이름', '새 폴더')
    if (!name?.trim()) return
    createFolder(name.trim(), parentId)
    if (parentId) setFolderCollapsed(parentId, false)
    refresh()
    closeCtx()
  }

  const startRename = (folderId: string, current: string) => {
    setRenamingId(folderId)
    setRenameValue(current)
    closeCtx()
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameFolder(renamingId, renameValue.trim())
      refresh()
    }
    setRenamingId(null)
  }

  const handleDeleteFolder = (folderId: string) => {
    if (!window.confirm('폴더를 삭제할까요? (일지 본문은 유지됩니다)')) return
    deleteFolder(folderId)
    if (selectedFolderId === folderId) onSelectFolder?.(null)
    refresh()
    closeCtx()
  }

  const selectedList = Array.from(selected)

  const bulkMove = () => {
    if (!selectedList.length) return
    const store = loadJournalTree()
    const customs = store.folders.filter((f) => f.kind === 'custom')
    const pick =
      customs.length === 0
        ? null
        : window.prompt(
            `이동할 폴더 id 또는 이름:\n${customs.map((f) => `${f.name} (${f.id.slice(0, 8)})`).join('\n')}`,
            customs[0]?.name ?? '',
          )
    if (!pick) {
      if (customs.length === 0) {
        const f = createFolder('새 폴더')
        bulkMoveJournals(selectedList, f.id)
        bulkPatchJournalMeta(selectedList, { folder_id: f.id })
      }
      refresh()
      return
    }
    const target =
      customs.find((f) => f.id === pick || f.name === pick || f.slug === pick) ??
      customs.find((f) => f.name.includes(pick))
    if (!target) {
      window.alert('폴더를 찾을 수 없습니다')
      return
    }
    bulkMoveJournals(selectedList, target.id)
    bulkPatchJournalMeta(selectedList, { folder_id: target.id })
    setSelected(new Set())
    refresh()
  }

  const bulkDelete = () => {
    if (!selectedList.length) return
    if (!window.confirm(`${selectedList.length}개 일지를 삭제할까요?`)) return
    onDeleteJournals?.(selectedList)
    setSelected(new Set())
    refresh()
  }

  const bulkTag = () => {
    if (!selectedList.length) return
    const tag = window.prompt('추가할 태그', '')
    if (!tag?.trim()) return
    const all = loadJournals()
    for (const d of selectedList) {
      const e = all[d]
      if (!e) continue
      const tags = Array.from(new Set([...(e.tags ?? []), tag.trim()]))
      bulkPatchJournalMeta([d], { tags })
    }
    refresh()
  }

  const bulkStatus = (status: JournalStatus) => {
    if (!selectedList.length) return
    bulkPatchJournalMeta(selectedList, { status })
    refresh()
  }

  const bulkExport = () => {
    if (!selectedList.length) return
    const md = exportJournalsMarkdown(selectedList, journals)
    downloadText(md, `journals-export-${new Date().toISOString().slice(0, 10)}.md`)
  }

  const onDragStart = (date: string, e: DragEvent) => {
    setDragDate(date)
    e.dataTransfer.setData('text/journal-date', date)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDropFolder = (folderId: string, e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const date = e.dataTransfer.getData('text/journal-date') || dragDate
    setDragDate(null)
    if (!date) return
    if (
      folderId === SYSTEM_FOLDER_IDS.byDate ||
      folderId === SYSTEM_FOLDER_IDS.byProject ||
      folderId === SYSTEM_FOLDER_IDS.byTag ||
      folderId.startsWith('virt-')
    ) {
      return
    }
    const target =
      folderId === SYSTEM_FOLDER_IDS.uncategorized
        ? null
        : folderId
    if (target) {
      moveJournalToFolder(date, target)
      bulkPatchJournalMeta([date], { folder_id: target })
    } else {
      clearJournalCustomRefs(date)
      bulkPatchJournalMeta([date], { folder_id: null })
    }
    refresh()
  }

  const openCtx = (e: MouseEvent, folderId: string | null, journalDate: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    setCtx({ x: e.clientX, y: e.clientY, folderId, journalDate })
  }

  const renderNode = (node: TreeNode, depth: number) => {
    const isFolder = node.kind === 'folder'
    const isOpen = isFolder ? !collapsed.has(node.id) : true
    const isActiveFolder = selectedFolderId === node.folderId
    const isActiveJournal = node.journalDate && selectedDate === node.journalDate

    return (
      <div key={node.id} className="select-none">
        <div
          className={cn(
            'group flex items-center gap-2 rounded-lg px-1 py-0.5 text-sm',
            isActiveFolder && isFolder && 'bg-accent/60',
            isActiveJournal && 'bg-slate-900/10 text-slate-900 dark:bg-slate-100/10 dark:text-slate-100',
            node.highlight && 'ring-1 ring-amber-400/70',
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
          onContextMenu={(e) =>
            openCtx(e, node.folderId ?? null, node.journalDate ?? null)
          }
          onDragOver={
            isFolder
              ? (e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }
              : undefined
          }
          onDrop={isFolder && node.folderId ? (e) => onDropFolder(node.folderId!, e) : undefined}
        >
          {isFolder ? (
            <button
              type="button"
              className="inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground shadow-sm hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:hover:bg-slate-800 dark:focus-visible:ring-slate-100"
              onClick={() => toggleCollapse(node.id)}
              aria-label={isOpen ? '접기' : '펼치기'}
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <input
              type="checkbox"
              className="mx-1 size-4 min-h-4 min-w-4"
              checked={selected.has(node.journalDate!)}
              onChange={() => {}}
              onClick={(e) => onCheckClick(node.journalDate!, e)}
              aria-label={`${node.journalDate} 선택`}
            />
          )}

          {isFolder ? (
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <span
              className="inline-flex shrink-0"
              draggable
              onDragStart={(e) => onDragStart(node.journalDate!, e)}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}

          {renamingId === node.folderId ? (
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') setRenamingId(null)
              }}
              className="h-6 flex-1 px-1 text-xs"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className={cn(
                'min-h-11 min-w-0 flex-1 truncate rounded-lg px-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100',
                isFolder ? 'font-medium' : 'text-muted-foreground',
              )}
              draggable={!isFolder}
              onDragStart={
                !isFolder && node.journalDate
                  ? (e) => onDragStart(node.journalDate!, e as unknown as DragEvent)
                  : undefined
              }
              onClick={() => {
                if (isFolder && node.folderId) {
                  onSelectFolder?.(node.folderId)
                } else if (node.journalDate) {
                  onSelectDate?.(node.journalDate)
                  if (node.folderId) onSelectFolder?.(node.folderId)
                }
              }}
              aria-label={isFolder ? `폴더 ${node.label}` : `일지 ${node.label}`}
            >
              {node.label}
            </button>
          )}

          {isFolder && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {node.count}
            </span>
          )}
          {!isFolder && node.dateLabel && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {node.dateLabel.slice(5)}
            </span>
          )}
        </div>
        {isFolder && isOpen && node.children.map((c) => renderNode(c, depth + 1))}
      </div>
    )
  }

  const folderDates =
    selectedFolderId != null
      ? collectDatesInFolder(selectedFolderId, journals)
      : null

  return (
    <div
      ref={treeRef}
      className={cn(
        'flex h-full min-h-[12rem] flex-col rounded-2xl border border-gray-100 bg-card dark:border-gray-800',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-2 dark:border-slate-800">
        <span className="text-xs font-semibold tracking-tight">일지 트리</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="새 폴더"
            onClick={() => handleNewFolder(null)}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="더보기"
            onClick={(e) => openCtx(e, null, null)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 border-b border-slate-100 px-2 py-2 dark:border-slate-800">
        <Input
          value={localFilter || searchQuery}
          onChange={(e) => setLocalFilter(e.target.value)}
          placeholder="트리 검색…"
          className="h-11 min-h-11 rounded-lg text-xs shadow-sm"
          aria-label="트리 검색"
        />
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'published', 'archived'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                'min-h-11 rounded-lg px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100',
                statusFilter === s
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
              )}
              onClick={() => setStatusFilter(s)}
              aria-label={`상태 필터 ${s === 'all' ? '전체' : s}`}
              aria-pressed={statusFilter === s}
            >
              {s === 'all' ? '전체' : s}
            </button>
          ))}
        </div>
        {folderDates && (
          <p className="text-[10px] text-muted-foreground">
            폴더 필터 · {folderDates.length}건
            <button
              type="button"
              className="ml-2 min-h-11 rounded-lg px-2 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              onClick={() => onSelectFolder?.(null)}
              aria-label="폴더 필터 해제"
            >
              해제
            </button>
          </p>
        )}
      </div>

      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-2 py-2 dark:border-slate-800">
          <span className="w-full text-[10px] text-muted-foreground">{selectedList.length}개 선택</span>
          <Button type="button" variant="outline" size="sm" onClick={bulkMove} aria-label="선택 항목 이동">
            이동
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={bulkTag} aria-label="선택 항목 태그">
            <Tag className="h-4 w-4" />
            태그
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => bulkStatus('archived')}
            aria-label="선택 항목 보관"
          >
            <Archive className="h-4 w-4" />
            보관
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={bulkExport} aria-label="선택 항목 내보내기">
            <Download className="h-4 w-4" />
            내보내기
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={bulkDelete} aria-label="선택 항목 삭제">
            <Trash2 className="h-4 w-4" />
            삭제
          </Button>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1 px-1 py-1">
        <div className="pb-2">{tree.map((n) => renderNode(n, 0))}</div>
      </ScrollArea>

      {ctx && (
        <div
          className="fixed z-50 min-w-[10rem] rounded-lg border border-slate-200 bg-popover p-1 text-popover-foreground shadow-sm dark:border-slate-700"
          style={{ left: ctx.x, top: ctx.y }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:hover:bg-slate-800"
            onClick={() => handleNewFolder(ctx.folderId && !ctx.journalDate ? ctx.folderId : null)}
            role="menuitem"
            aria-label="새 폴더"
          >
            <FolderPlus className="h-4 w-4" /> 새 폴더
          </button>
          {ctx.folderId &&
            !ctx.journalDate &&
            !ctx.folderId.startsWith('sys-') &&
            !ctx.folderId.startsWith('virt-') && (
              <>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:hover:bg-slate-800"
                  onClick={() => {
                    const f = loadJournalTree().folders.find((x) => x.id === ctx.folderId)
                    if (f) startRename(f.id, f.name)
                  }}
                  role="menuitem"
                  aria-label="폴더 이름변경"
                >
                  <Pencil className="h-4 w-4" /> 이름변경
                </button>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-xs text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:hover:bg-red-950/40"
                  onClick={() => handleDeleteFolder(ctx.folderId!)}
                  role="menuitem"
                  aria-label="폴더 삭제"
                >
                  <Trash2 className="h-4 w-4" /> 삭제
                </button>
              </>
            )}
          {ctx.journalDate && (
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-xs hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:hover:bg-slate-800"
              onClick={() => {
                setSelected(new Set([ctx.journalDate!]))
                bulkMove()
                closeCtx()
              }}
              role="menuitem"
              aria-label="일지 이동"
            >
              이동
            </button>
          )}
        </div>
      )}
    </div>
  )
}
