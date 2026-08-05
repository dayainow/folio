/**
 * P56 — 일지/문서/보드 템플릿 (builtin + 커스텀 CRUD)
 */
'use client'

import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'
import type { Task } from '@/lib/board'

export type TemplateKind = 'journal' | 'doc' | 'board'

export type FolioTemplate = {
  id: string
  kind: TemplateKind
  name: string
  body: string
  tags?: string[]
  /** docs */
  category?: string
  /** board */
  priority?: Task['priority']
  status?: Task['status']
  builtin?: boolean
}

const STORAGE_KEY = 'folio_templates_v1'

const BUILTIN: FolioTemplate[] = [
  {
    id: 'j-daily',
    kind: 'journal',
    name: '일일 회의',
    body: '## 일일 회의\n\n- 참석자:\n- 어제 한 일:\n- 오늘 할 일:\n- 블로커:\n',
    tags: ['meeting'],
    builtin: true,
  },
  {
    id: 'j-scrum',
    kind: 'journal',
    name: '스크럼',
    body: '## 스크럼\n\n- Done:\n- Doing:\n- Todo:\n- Impediments:\n',
    tags: ['scrum'],
    builtin: true,
  },
  {
    id: 'j-retro',
    kind: 'journal',
    name: '회고',
    body: '## 회고\n\n### Keep\n-\n\n### Problem\n-\n\n### Try\n-\n',
    tags: ['retro'],
    builtin: true,
  },
  {
    id: 'j-bug',
    kind: 'journal',
    name: '버그 리포트',
    body: '## 버그 리포트\n\n- 재현 환경:\n- 재현 단계:\n- 기대 동작:\n- 실제 동작:\n- 심각도:\n',
    tags: ['bug'],
    builtin: true,
  },
  {
    id: 'd-req',
    kind: 'doc',
    name: '요구사항',
    body: '# 요구사항\n\n## 배경\n\n## 목표\n\n## 범위\n\n## 비범위\n\n## 수용 기준\n- [ ]\n',
    category: 'Policy',
    tags: ['requirements'],
    builtin: true,
  },
  {
    id: 'd-design',
    kind: 'doc',
    name: '설계 문서',
    body: '# 설계 문서\n\n## 개요\n\n## 아키텍처\n\n## 데이터 모델\n\n## API\n\n## 리스크\n',
    category: 'Design',
    tags: ['design'],
    builtin: true,
  },
  {
    id: 'd-minutes',
    kind: 'doc',
    name: '회의록',
    body: '# 회의록\n\n- 일시:\n- 참석자:\n\n## 안건\n\n## 논의\n\n## 액션 아이템\n- [ ]\n',
    category: 'Meeting',
    tags: ['meeting'],
    builtin: true,
  },
  {
    id: 'd-retro',
    kind: 'doc',
    name: 'Retrospective',
    body: '# Retrospective\n\n## What went well\n\n## What didn’t\n\n## Action items\n- [ ]\n',
    category: 'Meeting',
    tags: ['retro'],
    builtin: true,
  },
  {
    id: 'b-bug',
    kind: 'board',
    name: '버그',
    body: '재현 단계 / 기대 / 실제',
    tags: ['bug'],
    priority: 'high',
    status: 'backlog',
    builtin: true,
  },
  {
    id: 'b-feature',
    kind: 'board',
    name: '기능',
    body: '사용자 스토리 / 수용 기준',
    tags: ['feature'],
    priority: 'medium',
    status: 'backlog',
    builtin: true,
  },
  {
    id: 'b-improve',
    kind: 'board',
    name: '개선',
    body: '현재 문제 / 개선안 / 측정',
    tags: ['improvement'],
    priority: 'medium',
    status: 'backlog',
    builtin: true,
  },
  {
    id: 'b-task',
    kind: 'board',
    name: '태스크',
    body: '',
    tags: ['task'],
    priority: 'medium',
    status: 'backlog',
    builtin: true,
  },
]

function loadCustom(): FolioTemplate[] {
  const raw = getLocalJson<FolioTemplate[]>(STORAGE_KEY, [])
  return Array.isArray(raw) ? raw.filter((t) => t && !t.builtin) : []
}

function saveCustom(list: FolioTemplate[]) {
  setLocalJson(STORAGE_KEY, list)
  flushLocalJson(STORAGE_KEY)
}

export function listTemplates(kind?: TemplateKind): FolioTemplate[] {
  const all = [...BUILTIN, ...loadCustom()]
  return kind ? all.filter((t) => t.kind === kind) : all
}

export function getTemplate(id: string): FolioTemplate | undefined {
  return listTemplates().find((t) => t.id === id)
}

export function upsertTemplate(
  input: Omit<FolioTemplate, 'builtin'> & { builtin?: boolean },
): FolioTemplate {
  if (input.builtin || BUILTIN.some((b) => b.id === input.id)) {
    throw new Error('builtin templates are read-only')
  }
  const custom = loadCustom()
  const next: FolioTemplate = { ...input, builtin: false }
  const idx = custom.findIndex((t) => t.id === next.id)
  if (idx >= 0) custom[idx] = next
  else custom.push(next)
  saveCustom(custom)
  return next
}

export function createTemplate(
  partial: Omit<FolioTemplate, 'id' | 'builtin'> & { id?: string },
): FolioTemplate {
  const id = partial.id ?? `custom-${crypto.randomUUID().slice(0, 8)}`
  return upsertTemplate({ ...partial, id, builtin: false })
}

export function deleteTemplate(id: string): boolean {
  if (BUILTIN.some((b) => b.id === id)) return false
  const custom = loadCustom()
  const next = custom.filter((t) => t.id !== id)
  if (next.length === custom.length) return false
  saveCustom(next)
  return true
}

export function resetCustomTemplates() {
  saveCustom([])
}
