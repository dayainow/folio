/**
 * P52 — Lunr 기반 고급 검색 엔진
 * 필드 검색 · 부울 · 구문 · 와일드카드 · (옵션) 정규식 후처리
 */
'use client'

import lunr from 'lunr'
import type { JournalEntry } from '@/lib/journal'
import type { DocEntry } from '@/lib/docs'
import type { Task } from '@/lib/board'
import type { SourceMetadata } from '@/lib/provenance'
import {
  type DocSearchHit,
  type JournalSearchHit,
  type MatchField,
  type SearchAllResult,
  type SearchSource,
  type TaskSearchHit,
} from '@/lib/search'

export type SearchSort = 'relevance' | 'date' | 'priority'

export type SearchFieldFilter = 'title' | 'content' | 'tag' | 'date' | 'author' | 'all'

export type AdvancedSearchFilters = {
  sources?: SearchSource[]
  fields?: SearchFieldFilter[]
  tags?: string[]
  /** YYYY-MM-DD */
  dateFrom?: string
  dateTo?: string
  status?: Task['status'][]
  priority?: Task['priority'][]
  author?: string
  sort?: SearchSort
  /** P67 — 로컬 임베딩 의미 검색 병합 */
  semantic?: boolean
}

export type UnifiedSearchHit = {
  source: SearchSource
  id: string
  title: string
  preview: string
  score: number
  matched: MatchField | 'date' | 'author'
  updatedAt: string
  tags?: string[]
  status?: Task['status']
  priority?: Task['priority']
  date?: string
  category?: string
  highlights?: string[]
  raw?: JournalEntry | DocEntry | Task
  provenance?: SourceMetadata
  scoreSignals?: {
    keyword?: number
    semantic?: number
    keywordRank?: number
    semanticRank?: number
  }
}

export type AdvancedSearchResult = {
  journals: JournalSearchHit[]
  docs: DocSearchHit[]
  tasks: TaskSearchHit[]
  unified: UnifiedSearchHit[]
  total: number
  query: string
  parsedQuery: string
}

type IndexDoc = {
  id: string
  source: SearchSource
  title: string
  content: string
  tags: string
  date: string
  author: string
  status: string
  priority: string
  updatedAt: string
  provenance?: SourceMetadata
}

function firstLine(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find(Boolean)
  return line || '빈 일지'
}

function snippetAround(text: string, query: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  const terms = query
    .replace(/["*()]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^(AND|OR|NOT|title|content|tag|date|author):/i, ''))
    .filter((t) => t.length > 1)
  const lower = flat.toLowerCase()
  let idx = -1
  let termLen = 0
  for (const t of terms) {
    const i = lower.indexOf(t.toLowerCase())
    if (i >= 0) {
      idx = i
      termLen = t.length
      break
    }
  }
  if (idx < 0) {
    return flat.length > max ? `${flat.slice(0, max)}…` : flat
  }
  const start = Math.max(0, idx - 24)
  const end = Math.min(flat.length, idx + termLen + 72)
  const slice = flat.slice(start, end)
  return `${start > 0 ? '…' : ''}${slice}${end < flat.length ? '…' : ''}`
}

/** 하이라이트용 마크 — UI에서 <mark>로 변환 */
export function highlightText(text: string, query: string): string {
  const terms = extractHighlightTerms(query)
  if (!terms.length || !text) return text
  let out = text
  for (const t of terms) {
    const re = new RegExp(`(${escapeRegExp(t)})`, 'gi')
    out = out.replace(re, '⟦$1⟧')
  }
  return out
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractHighlightTerms(query: string): string[] {
  const phrases = [...query.matchAll(/"([^"]+)"/g)].map((m) => m[1]!).filter(Boolean)
  const rest = query
    .replace(/"([^"]+)"/g, ' ')
    .replace(/\b(AND|OR|NOT)\b/gi, ' ')
    .replace(/\b(title|content|tag|date|author):/gi, ' ')
    .replace(/[()*]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !t.startsWith('/'))
  return [...new Set([...phrases, ...rest])].slice(0, 8)
}

/**
 * 사용자 쿼리 → lunr 쿼리
 * 지원: AND OR NOT, "구문", field:term, trailing *, /regex/ (별도 플래그)
 */
export function parseSearchQuery(raw: string): {
  lunrQuery: string
  regex?: RegExp
  fieldBoost: SearchFieldFilter[]
} {
  const trimmed = raw.trim()
  if (!trimmed) return { lunrQuery: '', fieldBoost: ['all'] }

  let regex: RegExp | undefined
  let body = trimmed
  const regexMatch = body.match(/\/(.+)\/([i]*)\s*$/)
  if (regexMatch) {
    try {
      regex = new RegExp(regexMatch[1]!, regexMatch[2] || 'i')
      body = body.slice(0, regexMatch.index).trim()
    } catch {
      regex = undefined
    }
  }

  // 필드 지정 수집
  const fieldBoost: SearchFieldFilter[] = []
  if (/\btitle:/i.test(body)) fieldBoost.push('title')
  if (/\bcontent:/i.test(body)) fieldBoost.push('content')
  if (/\btag:/i.test(body)) fieldBoost.push('tag')
  if (/\bdate:/i.test(body)) fieldBoost.push('date')
  if (/\bauthor:/i.test(body)) fieldBoost.push('author')
  if (!fieldBoost.length) fieldBoost.push('all')

  // lunr: NOT → -, 유지 AND/OR, 와일드카드 *
  let lunrQuery = body
    .replace(/\bNOT\s+/gi, '-')
    .replace(/\bAND\b/gi, '')
    .replace(/\bOR\b/gi, ' ')
    // field aliases → lunr fields
    .replace(/\btitle:/gi, 'title:')
    .replace(/\bcontent:/gi, 'content:')
    .replace(/\btag:/gi, 'tags:')
    .replace(/\bdate:/gi, 'date:')
    .replace(/\bauthor:/gi, 'author:')

  // 단순 토큰에 대해 부분일치 보강 (이미 * 또는 필드/구문 아니면)
  if (!/[:"*()-]/.test(lunrQuery) && !/\s/.test(lunrQuery) && lunrQuery.length >= 2) {
    lunrQuery = `${lunrQuery}* ${lunrQuery}`
  }

  return { lunrQuery: lunrQuery.trim(), regex, fieldBoost }
}

function buildDocs(
  journals: Record<string, JournalEntry>,
  docs: DocEntry[],
  tasks: Task[],
): IndexDoc[] {
  const out: IndexDoc[] = []
  for (const entry of Object.values(journals)) {
    out.push({
      id: `journal:${entry.date}`,
      source: 'journal',
      title: `${entry.date} · ${firstLine(entry.content)}`,
      content: entry.content,
      tags: entry.tags.join(' '),
      date: entry.date,
      author: '',
      status: '',
      priority: '',
      updatedAt: entry.updatedAt,
      provenance: entry.provenance,
    })
  }
  for (const doc of docs) {
    out.push({
      id: `docs:${doc.id}`,
      source: 'docs',
      title: doc.title,
      content: `${doc.content}\n${doc.category}\n${doc.source ?? ''}\n${doc.noteType ?? ''}`,
      tags: [doc.category, ...(doc.tags ?? [])].join(' '),
      date: doc.updatedAt.slice(0, 10),
      author: '',
      status: '',
      priority: '',
      updatedAt: doc.updatedAt,
      provenance: doc.provenance,
    })
  }
  for (const task of tasks) {
    out.push({
      id: `board:${task.id}`,
      source: 'board',
      title: task.title,
      content: task.description,
      tags: task.tags.join(' '),
      date: task.updatedAt.slice(0, 10),
      author: '',
      status: task.status,
      priority: task.priority,
      updatedAt: task.updatedAt,
      provenance: task.provenance,
    })
  }
  return out
}

function buildIndex(docs: IndexDoc[]): lunr.Index {
  return lunr(function () {
    this.ref('id')
    this.field('title', { boost: 10 })
    this.field('content', { boost: 4 })
    this.field('tags', { boost: 7 })
    this.field('date', { boost: 3 })
    this.field('author', { boost: 2 })
    this.field('status')
    this.field('priority')
    this.pipeline.remove(lunr.stemmer)
    this.searchPipeline.remove(lunr.stemmer)
    for (const doc of docs) {
      this.add(doc)
    }
  })
}

function matchedFieldFromResult(
  result: lunr.Index.Result,
  fieldBoost: SearchFieldFilter[],
): MatchField | 'date' | 'author' {
  const meta = result.matchData?.metadata as Record<string, Record<string, unknown>> | undefined
  if (meta) {
    for (const term of Object.keys(meta)) {
      const fields = meta[term]
      if (!fields) continue
      if (fields.title) return 'title'
      if (fields.tags) return 'tag'
      if (fields.date) return 'date'
      if (fields.author) return 'author'
      if (fields.content) return 'content'
    }
  }
  if (fieldBoost.includes('title')) return 'title'
  if (fieldBoost.includes('tag')) return 'tag'
  return 'content'
}

function inDateRange(date: string, from?: string, to?: string): boolean {
  if (!date) return !from && !to
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

function applyFilters(
  docs: IndexDoc[],
  filters: AdvancedSearchFilters,
): IndexDoc[] {
  const sources = filters.sources?.length
    ? new Set(filters.sources)
    : null
  return docs.filter((d) => {
    if (sources && !sources.has(d.source)) return false
    if (filters.author && !d.author.toLowerCase().includes(filters.author.toLowerCase())) {
      return false
    }
    if (!inDateRange(d.date, filters.dateFrom, filters.dateTo)) return false
    if (filters.tags?.length) {
      const tagStr = d.tags.toLowerCase()
      if (!filters.tags.every((t) => tagStr.includes(t.toLowerCase()))) return false
    }
    if (d.source === 'board') {
      if (filters.status?.length && !filters.status.includes(d.status as Task['status'])) {
        return false
      }
      if (
        filters.priority?.length &&
        !filters.priority.includes(d.priority as Task['priority'])
      ) {
        return false
      }
    }
    return true
  })
}

function sortUnified(hits: UnifiedSearchHit[], sort: SearchSort): UnifiedSearchHit[] {
  const copy = [...hits]
  if (sort === 'date') {
    return copy.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  }
  if (sort === 'priority') {
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 }
    return copy.sort(
      (a, b) => (rank[b.priority ?? ''] ?? 0) - (rank[a.priority ?? ''] ?? 0) || b.score - a.score,
    )
  }
  return copy.sort((a, b) => b.score - a.score)
}

/** 데이터셋에 대해 고급 검색 실행 */
export function runAdvancedSearch(
  query: string,
  journals: Record<string, JournalEntry>,
  docs: DocEntry[],
  tasks: Task[],
  filters: AdvancedSearchFilters = {},
): AdvancedSearchResult {
  const allDocs = buildDocs(journals, docs, tasks)
  const filteredDocs = applyFilters(allDocs, filters)
  const byId = new Map(filteredDocs.map((d) => [d.id, d]))

  const { lunrQuery, regex, fieldBoost } = parseSearchQuery(query)
  let unified: UnifiedSearchHit[] = []

  const hasActiveFilters = Boolean(
    filters.tags?.length ||
      filters.status?.length ||
      filters.priority?.length ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.author ||
      (filters.sources && filters.sources.length > 0 && filters.sources.length < 3),
  )

  if (!lunrQuery && !regex && !hasActiveFilters) {
    return {
      journals: [],
      docs: [],
      tasks: [],
      unified: [],
      total: 0,
      query,
      parsedQuery: '',
    }
  }

  // 쿼리 없이 필터만
  if (!lunrQuery && !regex) {
    unified = filteredDocs.map((d) => toUnified(d, 1, 'content', query))
  } else if (!lunrQuery && regex) {
    for (const d of filteredDocs) {
      const hay = `${d.title}\n${d.content}\n${d.tags}`
      if (!regex.test(hay)) continue
      unified.push(toUnified(d, 1, 'content', query))
    }
  } else {
    try {
      const index = buildIndex(filteredDocs)
      let results: lunr.Index.Result[] = []
      try {
        results = index.search(lunrQuery)
      } catch {
        const simple = query.replace(/[^\w가-힣*]+/g, ' ').trim()
        results = simple ? index.search(simple) : []
      }

      for (const r of results) {
        const doc = byId.get(r.ref)
        if (!doc) continue
        if (regex) {
          const hay = `${doc.title}\n${doc.content}\n${doc.tags}`
          if (!regex.test(hay)) continue
        }
        unified.push(
          toUnified(doc, r.score, matchedFieldFromResult(r, fieldBoost), query),
        )
      }
    } catch {
      /* fall through to substring */
    }

    // lunr 미스(한국어·커스텀 토큰) 시 substring / 필드 폴백
    if (unified.length === 0) {
      const tagTerms = [...query.matchAll(/\btags?:([^\s]+)/gi)].map((m) => m[1]!.toLowerCase())
      const titleTerms = [...query.matchAll(/\btitle:([^\s]+)/gi)].map((m) =>
        m[1]!.replace(/\*$/, '').toLowerCase(),
      )
      const phrases = [...query.matchAll(/"([^"]+)"/g)].map((m) => m[1]!.toLowerCase())
      const plain = query
        .replace(/\b(AND|OR|NOT)\b/gi, ' ')
        .replace(/\b(title|content|tag|tags|date|author):[^\s]+/gi, ' ')
        .replace(/"([^"]+)"/g, ' ')
        .replace(/[/*/]/g, ' ')
        .trim()
        .toLowerCase()

      for (const doc of filteredDocs) {
        const title = doc.title.toLowerCase()
        const content = doc.content.toLowerCase()
        const tags = doc.tags.toLowerCase()
        const hay = `${title}\n${content}\n${tags}`

        if (regex && !regex.test(hay)) continue

        let ok = true
        if (tagTerms.length) {
          ok = tagTerms.every((t) => tags.includes(t.replace(/\*$/, '')))
        }
        if (ok && titleTerms.length) {
          ok = titleTerms.every((t) => title.includes(t))
        }
        if (ok && phrases.length) {
          ok = phrases.every((p) => hay.includes(p))
        }
        if (ok && plain) {
          const tokens = plain.split(/\s+/).filter(Boolean)
          // AND semantics for remaining tokens; OR if original had OR
          if (/\bOR\b/i.test(query)) {
            ok = tokens.some((t) => hay.includes(t))
          } else {
            ok = tokens.every((t) => hay.includes(t))
          }
        }
        if (!ok && !tagTerms.length && !titleTerms.length && !phrases.length && !plain && !regex) {
          continue
        }
        if (!ok) continue

        let matched: MatchField | 'date' | 'author' = 'content'
        if (tagTerms.length || tags.includes(plain)) matched = 'tag'
        else if (titleTerms.length || title.includes(plain)) matched = 'title'

        unified.push(toUnified(doc, matched === 'title' ? 100 : matched === 'tag' ? 70 : 40, matched, query))
      }
    }
  }

  unified = sortUnified(unified, filters.sort ?? 'relevance')

  const journalsHits: JournalSearchHit[] = []
  const docsHits: DocSearchHit[] = []
  const tasksHits: TaskSearchHit[] = []

  for (const u of unified) {
    if (u.source === 'journal') {
      journalsHits.push({
        id: u.id,
        date: u.date ?? u.id,
        title: u.title,
        preview: u.preview,
        tags: u.tags ?? [],
        updatedAt: u.updatedAt,
        score: u.score,
        matched: u.matched === 'date' || u.matched === 'author' ? 'content' : u.matched,
      })
    } else if (u.source === 'docs') {
      docsHits.push({
        id: u.id,
        title: u.title,
        preview: u.preview,
        category: u.category ?? '',
        updatedAt: u.updatedAt,
        score: u.score,
        matched: u.matched === 'date' || u.matched === 'author' ? 'content' : u.matched,
      })
    } else {
      tasksHits.push({
        id: u.id,
        title: u.title,
        preview: u.preview,
        status: u.status ?? 'backlog',
        tags: u.tags ?? [],
        updatedAt: u.updatedAt,
        score: u.score,
        matched: u.matched === 'date' || u.matched === 'author' ? 'content' : u.matched,
      })
    }
  }

  return {
    journals: journalsHits,
    docs: docsHits,
    tasks: tasksHits,
    unified,
    total: unified.length,
    query,
    parsedQuery: lunrQuery,
  }
}

function toUnified(
  doc: IndexDoc,
  score: number,
  matched: MatchField | 'date' | 'author',
  query: string,
): UnifiedSearchHit {
  const id = doc.id.replace(/^(journal|docs|board):/, '')
  return {
    source: doc.source,
    id,
    title: doc.title,
    preview: snippetAround(doc.content || doc.title, query) || doc.status || doc.tags,
    score,
    matched,
    updatedAt: doc.updatedAt,
    tags: doc.tags ? doc.tags.split(/\s+/).filter(Boolean) : [],
    status: (doc.status as Task['status']) || undefined,
    priority: (doc.priority as Task['priority']) || undefined,
    date: doc.date,
    category: doc.source === 'docs' ? doc.tags : undefined,
    highlights: extractHighlightTerms(query),
    provenance: doc.provenance,
  }
}

export function toSearchAllResult(adv: AdvancedSearchResult): SearchAllResult {
  return {
    journals: adv.journals,
    docs: adv.docs,
    tasks: adv.tasks,
  }
}

/** 추천 검색어 */
export function suggestQueries(
  journals: Record<string, JournalEntry>,
  docs: DocEntry[],
  tasks: Task[],
  limit = 8,
): string[] {
  const tags = new Map<string, number>()
  const bump = (t: string) => tags.set(t, (tags.get(t) ?? 0) + 1)
  for (const e of Object.values(journals)) e.tags.forEach(bump)
  for (const t of tasks) t.tags.forEach(bump)
  for (const d of docs) if (d.category) bump(d.category)

  const topTags = [...tags.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => `tag:${t}`)

  return [
    ...topTags,
    'status:in_progress',
    'priority:high',
    '"TODO"',
    ...Object.keys(journals).slice(-2).map((d) => `date:${d}`),
  ].slice(0, limit)
}
