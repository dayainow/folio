/**
 * P58 — 일지 폴더/트리 구조 관리
 * 폴더 CRUD · 참조(심볼릭) · 가상 폴더(미분류/날짜/프로젝트/태그) · 경로 · bulk
 */
import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'
import type { JournalEntry, JournalStatus } from '@/lib/journal'
import {
  journalPath as journalPathFn,
  parseJournalPath as parseJournalPathFn,
} from '@/lib/journal-path'

export type JournalFolderKind = 'system' | 'custom' | 'virtual'

export type JournalFolder = {
  id: string
  name: string
  /** 상위 폴더 (커스텀 중첩) */
  parentId: string | null
  kind: JournalFolderKind
  /** URL 세그먼트 */
  slug: string
  order: number
  createdAt: string
  updatedAt: string
}

/** 같은 일지를 여러 폴더에 참조 (심볼릭 링크) */
export type JournalRef = {
  id: string
  /** YYYY-MM-DD */
  journalDate: string
  folderId: string
  order: number
  createdAt: string
}

export type JournalTreeStore = {
  folders: JournalFolder[]
  refs: JournalRef[]
  /** 접힌 폴더 id */
  collapsed: string[]
}

export type TreeNodeKind = 'folder' | 'journal'

export type TreeNode = {
  id: string
  kind: TreeNodeKind
  label: string
  folderId?: string
  journalDate?: string
  parentId: string | null
  count: number
  dateLabel?: string
  children: TreeNode[]
  /** 검색 하이라이트 */
  highlight?: boolean
  system?: boolean
}

export const SYSTEM_FOLDER_IDS = {
  uncategorized: 'sys-uncategorized',
  byDate: 'sys-by-date',
  byProject: 'sys-by-project',
  byTag: 'sys-by-tag',
} as const

const STORAGE_KEY = 'folio_journal_tree_v1'

function nowIso() {
  return new Date().toISOString()
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣_-]/gi, '')
    .slice(0, 48)
  return base || `folder-${Date.now().toString(36)}`
}

function defaultFolders(): JournalFolder[] {
  const t = nowIso()
  return [
    {
      id: SYSTEM_FOLDER_IDS.uncategorized,
      name: '미분류',
      parentId: null,
      kind: 'system',
      slug: 'uncategorized',
      order: 0,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: SYSTEM_FOLDER_IDS.byDate,
      name: '날짜별',
      parentId: null,
      kind: 'virtual',
      slug: 'by-date',
      order: 1,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: SYSTEM_FOLDER_IDS.byProject,
      name: '프로젝트별',
      parentId: null,
      kind: 'virtual',
      slug: 'by-project',
      order: 2,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: SYSTEM_FOLDER_IDS.byTag,
      name: '태그별',
      parentId: null,
      kind: 'virtual',
      slug: 'by-tag',
      order: 3,
      createdAt: t,
      updatedAt: t,
    },
  ]
}

function emptyStore(): JournalTreeStore {
  return { folders: defaultFolders(), refs: [], collapsed: [] }
}

export function loadJournalTree(): JournalTreeStore {
  const raw = getLocalJson<JournalTreeStore | null>(STORAGE_KEY, null)
  if (!raw || !Array.isArray(raw.folders)) return emptyStore()
  const defaults = defaultFolders()
  const byId = new Map(raw.folders.map((f) => [f.id, f]))
  for (const d of defaults) {
    if (!byId.has(d.id)) byId.set(d.id, d)
  }
  return {
    folders: Array.from(byId.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ko')),
    refs: Array.isArray(raw.refs) ? raw.refs : [],
    collapsed: Array.isArray(raw.collapsed) ? raw.collapsed : [],
  }
}

function saveStore(store: JournalTreeStore) {
  setLocalJson(STORAGE_KEY, store)
  flushLocalJson(STORAGE_KEY)
}

export function createFolder(name: string, parentId: string | null = null): JournalFolder {
  const store = loadJournalTree()
  const folder: JournalFolder = {
    id: crypto.randomUUID(),
    name: name.trim() || '새 폴더',
    parentId,
    kind: 'custom',
    slug: slugify(name),
    order: store.folders.filter((f) => f.parentId === parentId).length,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  store.folders.push(folder)
  saveStore(store)
  return folder
}

export function renameFolder(folderId: string, name: string): JournalFolder | null {
  const store = loadJournalTree()
  const folder = store.folders.find((f) => f.id === folderId)
  if (!folder || folder.kind !== 'custom') return null
  folder.name = name.trim() || folder.name
  folder.slug = slugify(folder.name)
  folder.updatedAt = nowIso()
  saveStore(store)
  return folder
}

export function deleteFolder(folderId: string): boolean {
  const store = loadJournalTree()
  const folder = store.folders.find((f) => f.id === folderId)
  if (!folder || folder.kind !== 'custom') return false
  const removeIds = new Set<string>()
  const walk = (id: string) => {
    removeIds.add(id)
    for (const f of store.folders) {
      if (f.parentId === id) walk(f.id)
    }
  }
  walk(folderId)
  store.folders = store.folders.filter((f) => !removeIds.has(f.id))
  store.refs = store.refs.filter((r) => !removeIds.has(r.folderId))
  store.collapsed = store.collapsed.filter((id) => !removeIds.has(id))
  saveStore(store)
  return true
}

/** 일지를 폴더로 이동(기존 커스텀 참조 교체) 또는 추가 참조 */
export function moveJournalToFolder(
  journalDate: string,
  targetFolderId: string,
  opts?: { keepOthers?: boolean },
): JournalRef {
  const store = loadJournalTree()
  if (!opts?.keepOthers) {
    store.refs = store.refs.filter(
      (r) =>
        !(
          r.journalDate === journalDate &&
          store.folders.find((f) => f.id === r.folderId)?.kind === 'custom'
        ),
    )
  }
  const existing = store.refs.find(
    (r) => r.journalDate === journalDate && r.folderId === targetFolderId,
  )
  if (existing) {
    saveStore(store)
    return existing
  }
  const ref: JournalRef = {
    id: crypto.randomUUID(),
    journalDate,
    folderId: targetFolderId,
    order: store.refs.filter((r) => r.folderId === targetFolderId).length,
    createdAt: nowIso(),
  }
  store.refs.push(ref)
  saveStore(store)
  return ref
}

/** 심볼릭: 다른 폴더에도 같은 일지 참조 추가 */
export function linkJournalToFolder(journalDate: string, folderId: string): JournalRef {
  return moveJournalToFolder(journalDate, folderId, { keepOthers: true })
}

export function unlinkJournalFromFolder(journalDate: string, folderId: string): boolean {
  const store = loadJournalTree()
  const before = store.refs.length
  store.refs = store.refs.filter((r) => !(r.journalDate === journalDate && r.folderId === folderId))
  if (store.refs.length === before) return false
  saveStore(store)
  return true
}

/** 커스텀 폴더 참조 전부 제거 → 미분류 */
export function clearJournalCustomRefs(journalDate: string): void {
  const store = loadJournalTree()
  store.refs = store.refs.filter((r) => {
    if (r.journalDate !== journalDate) return true
    return store.folders.find((f) => f.id === r.folderId)?.kind !== 'custom'
  })
  saveStore(store)
}

/** 일지 날짜 키 변경 시 트리 참조 갱신 */
export function retargetJournalDate(from: string, to: string): void {
  if (from === to) return
  const store = loadJournalTree()
  store.refs = store.refs.map((r) =>
    r.journalDate === from ? { ...r, journalDate: to } : r,
  )
  saveStore(store)
}

export function toggleFolderCollapsed(folderId: string): string[] {
  const store = loadJournalTree()
  const set = new Set(store.collapsed)
  if (set.has(folderId)) set.delete(folderId)
  else set.add(folderId)
  store.collapsed = Array.from(set)
  saveStore(store)
  return store.collapsed
}

export function setFolderCollapsed(folderId: string, collapsed: boolean): void {
  const store = loadJournalTree()
  const set = new Set(store.collapsed)
  if (collapsed) set.add(folderId)
  else set.delete(folderId)
  store.collapsed = Array.from(set)
  saveStore(store)
}

export function bulkMoveJournals(dates: string[], targetFolderId: string): void {
  for (const d of dates) moveJournalToFolder(d, targetFolderId)
}

export function bulkUnlinkJournals(dates: string[], folderId: string): void {
  const store = loadJournalTree()
  store.refs = store.refs.filter(
    (r) => !(dates.includes(r.journalDate) && r.folderId === folderId),
  )
  saveStore(store)
}

export function journalPath(folderSlug: string, journalDate: string): string {
  return journalPathFn(folderSlug, journalDate)
}

export function parseJournalPath(segments: string[]): { folderSlug: string | null; date: string | null } {
  return parseJournalPathFn(segments)
}

export function findFolderBySlug(slug: string, store = loadJournalTree()): JournalFolder | undefined {
  return store.folders.find((f) => f.slug === slug || f.id === slug)
}

/** 폴더 및 하위 커스텀 폴더에 속한 일지 날짜 */
export function collectDatesInFolder(
  folderId: string,
  journals: Record<string, JournalEntry>,
  store = loadJournalTree(),
): string[] {
  const customChildren = (pid: string | null) =>
    store.folders.filter((f) => f.parentId === pid && f.kind === 'custom')

  const dates = new Set<string>()

  if (folderId === SYSTEM_FOLDER_IDS.uncategorized) {
    const linked = new Set(
      store.refs
        .filter((r) => store.folders.find((f) => f.id === r.folderId)?.kind === 'custom')
        .map((r) => r.journalDate),
    )
    for (const d of Object.keys(journals)) {
      if (!linked.has(d)) dates.add(d)
    }
    return Array.from(dates).sort().reverse()
  }

  if (folderId === SYSTEM_FOLDER_IDS.byDate) {
    return Object.keys(journals).sort().reverse()
  }

  if (folderId === SYSTEM_FOLDER_IDS.byProject) {
    for (const [d, e] of Object.entries(journals)) {
      if (e.projectId) dates.add(d)
    }
    return Array.from(dates).sort().reverse()
  }

  if (folderId === SYSTEM_FOLDER_IDS.byTag) {
    for (const [d, e] of Object.entries(journals)) {
      if ((e.tags ?? []).length) dates.add(d)
    }
    return Array.from(dates).sort().reverse()
  }

  // 가상 하위(월/프로젝트/태그) id 접두사
  if (folderId.startsWith('virt-date-')) {
    const ym = folderId.slice('virt-date-'.length)
    return Object.keys(journals)
      .filter((d) => d.startsWith(ym))
      .sort()
      .reverse()
  }
  if (folderId.startsWith('virt-project-')) {
    const pid = decodeURIComponent(folderId.slice('virt-project-'.length))
    return Object.entries(journals)
      .filter(([, e]) => (e.projectId || 'none') === pid)
      .map(([d]) => d)
      .sort()
      .reverse()
  }
  if (folderId.startsWith('virt-tag-')) {
    const tag = decodeURIComponent(folderId.slice('virt-tag-'.length))
    return Object.entries(journals)
      .filter(([, e]) => (e.tags ?? []).includes(tag))
      .map(([d]) => d)
      .sort()
      .reverse()
  }

  const folderIds = new Set<string>()
  const walk = (id: string) => {
    folderIds.add(id)
    for (const c of customChildren(id)) walk(c.id)
  }
  walk(folderId)

  for (const r of store.refs) {
    if (folderIds.has(r.folderId)) dates.add(r.journalDate)
  }
  return Array.from(dates).sort().reverse()
}

function previewLabel(content: string, date: string): string {
  const line = content.trim().split('\n').find((l) => l.trim())
  if (!line) return date
  return line.replace(/^#+\s*/, '').slice(0, 40)
}

export type BuildTreeOptions = {
  journals: Record<string, JournalEntry>
  searchQuery?: string
  /** 상태 필터 */
  statusFilter?: JournalStatus | 'all'
}

/** 사이드바용 트리 노드 생성 */
export function buildJournalTree(opts: BuildTreeOptions): TreeNode[] {
  const store = loadJournalTree()
  const q = (opts.searchQuery ?? '').trim().toLowerCase()
  const statusFilter = opts.statusFilter ?? 'all'
  const journals = { ...opts.journals }

  const matchesSearch = (date: string, entry: JournalEntry) => {
    if (!q) return true
    return (
      date.includes(q) ||
      (entry.content ?? '').toLowerCase().includes(q) ||
      (entry.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
      (entry.projectId ?? '').toLowerCase().includes(q)
    )
  }

  const statusOk = (entry: JournalEntry) => {
    if (statusFilter === 'all') return true
    return (entry.status ?? 'published') === statusFilter
  }

  const journalNode = (date: string, parentId: string): TreeNode | null => {
    const entry = journals[date]
    if (!entry || !statusOk(entry)) return null
    const hit = q ? matchesSearch(date, entry) : false
    if (q && !hit) return null
    return {
      id: `j:${parentId}:${date}`,
      kind: 'journal',
      label: previewLabel(entry.content, date),
      journalDate: date,
      folderId: parentId,
      parentId,
      count: 0,
      dateLabel: date,
      children: [],
      highlight: Boolean(q && hit),
    }
  }

  const customFolderNode = (folder: JournalFolder): TreeNode => {
    const childFolders = store.folders
      .filter((f) => f.parentId === folder.id && f.kind === 'custom')
      .sort((a, b) => a.order - b.order)
    const refs = store.refs
      .filter((r) => r.folderId === folder.id)
      .sort((a, b) => a.order - b.order)
    const children: TreeNode[] = [
      ...childFolders.map(customFolderNode),
      ...refs.map((r) => journalNode(r.journalDate, folder.id)).filter(Boolean) as TreeNode[],
    ]
    const count = collectDatesInFolder(folder.id, journals, store).filter((d) => {
      const e = journals[d]
      return e && statusOk(e) && matchesSearch(d, e)
    }).length
    return {
      id: folder.id,
      kind: 'folder',
      label: folder.name,
      folderId: folder.id,
      parentId: folder.parentId,
      count,
      children,
      system: false,
      highlight: q ? children.some((c) => c.highlight || c.children.some((x) => x.highlight)) : false,
    }
  }

  const roots: TreeNode[] = []

  // 미분류
  {
    const id = SYSTEM_FOLDER_IDS.uncategorized
    const dates = collectDatesInFolder(id, journals, store).filter((d) => {
      const e = journals[d]
      return e && statusOk(e) && matchesSearch(d, e)
    })
    roots.push({
      id,
      kind: 'folder',
      label: '미분류',
      folderId: id,
      parentId: null,
      count: dates.length,
      system: true,
      children: dates.map((d) => journalNode(d, id)).filter(Boolean) as TreeNode[],
      highlight: Boolean(q && dates.length),
    })
  }

  // 커스텀 루트 폴더
  for (const f of store.folders.filter((x) => x.kind === 'custom' && !x.parentId)) {
    roots.push(customFolderNode(f))
  }

  // 날짜별 (월 그룹)
  {
    const id = SYSTEM_FOLDER_IDS.byDate
    const months = new Map<string, string[]>()
    for (const d of Object.keys(journals).sort().reverse()) {
      const e = journals[d]
      if (!e || !statusOk(e) || !matchesSearch(d, e)) continue
      const ym = d.slice(0, 7)
      if (!months.has(ym)) months.set(ym, [])
      months.get(ym)!.push(d)
    }
    const children: TreeNode[] = Array.from(months.entries()).map(([ym, dates]) => ({
      id: `virt-date-${ym}`,
      kind: 'folder' as const,
      label: ym,
      folderId: `virt-date-${ym}`,
      parentId: id,
      count: dates.length,
      system: true,
      children: dates.map((d) => journalNode(d, `virt-date-${ym}`)).filter(Boolean) as TreeNode[],
    }))
    roots.push({
      id,
      kind: 'folder',
      label: '날짜별',
      folderId: id,
      parentId: null,
      count: children.reduce((s, c) => s + c.count, 0),
      system: true,
      children,
    })
  }

  // 프로젝트별
  {
    const id = SYSTEM_FOLDER_IDS.byProject
    const groups = new Map<string, string[]>()
    for (const [d, e] of Object.entries(journals)) {
      if (!statusOk(e) || !matchesSearch(d, e)) continue
      const pid = e.projectId || 'none'
      if (!groups.has(pid)) groups.set(pid, [])
      groups.get(pid)!.push(d)
    }
    const children: TreeNode[] = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'ko'))
      .map(([pid, dates]) => ({
        id: `virt-project-${encodeURIComponent(pid)}`,
        kind: 'folder' as const,
        label: pid === 'none' ? '(프로젝트 없음)' : pid,
        folderId: `virt-project-${encodeURIComponent(pid)}`,
        parentId: id,
        count: dates.length,
        system: true,
        children: dates
          .sort()
          .reverse()
          .map((d) => journalNode(d, `virt-project-${encodeURIComponent(pid)}`))
          .filter(Boolean) as TreeNode[],
      }))
    roots.push({
      id,
      kind: 'folder',
      label: '프로젝트별',
      folderId: id,
      parentId: null,
      count: children.reduce((s, c) => s + c.count, 0),
      system: true,
      children,
    })
  }

  // 태그별
  {
    const id = SYSTEM_FOLDER_IDS.byTag
    const groups = new Map<string, string[]>()
    for (const [d, e] of Object.entries(journals)) {
      if (!statusOk(e) || !matchesSearch(d, e)) continue
      const tags = e.tags?.length ? e.tags : ['(태그 없음)']
      for (const tag of tags) {
        if (!groups.has(tag)) groups.set(tag, [])
        groups.get(tag)!.push(d)
      }
    }
    const children: TreeNode[] = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'ko'))
      .map(([tag, dates]) => ({
        id: `virt-tag-${encodeURIComponent(tag)}`,
        kind: 'folder' as const,
        label: tag,
        folderId: `virt-tag-${encodeURIComponent(tag)}`,
        parentId: id,
        count: new Set(dates).size,
        system: true,
        children: Array.from(new Set(dates))
          .sort()
          .reverse()
          .map((d) => journalNode(d, `virt-tag-${encodeURIComponent(tag)}`))
          .filter(Boolean) as TreeNode[],
      }))
    roots.push({
      id,
      kind: 'folder',
      label: '태그별',
      folderId: id,
      parentId: null,
      count: children.reduce((s, c) => s + c.count, 0),
      system: true,
      children,
    })
  }

  return roots
}

export function exportJournalsMarkdown(
  dates: string[],
  journals: Record<string, JournalEntry>,
): string {
  const lines: string[] = ['# Folio Journals Export', '']
  for (const d of dates.sort()) {
    const e = journals[d]
    if (!e) continue
    lines.push(`## ${d}`)
    if (e.tags?.length) lines.push(`tags: ${e.tags.join(', ')}`)
    if (e.status) lines.push(`status: ${e.status}`)
    if (e.projectId) lines.push(`project: ${e.projectId}`)
    lines.push('')
    lines.push(e.content || '')
    lines.push('')
  }
  return lines.join('\n')
}
