/**
 * Obsidian 스타일 wiki-link 파서 · 역색인 · 그래프 데이터 (P31)
 * 문법: [[문서명]] | [[문서명|별칭]]
 */

export interface WikiLink {
  /** 원본 매치 전체 (예: [[API 명세|API]]) */
  raw: string
  /** 대상 문서명 */
  target: string
  /** 표시용 별칭 (없으면 target) */
  alias: string
  /** content 내 시작 index */
  index: number
  /** 매치 길이 */
  length: number
}

export interface DocLinkNode {
  id: string
  title: string
  category: string
  /** 나가는 링크 수 */
  outDegree: number
  /** 들어오는 링크 수 (역링크) */
  inDegree: number
}

export interface DocLinkEdge {
  source: string
  target: string
  /** 원본에 쓰인 링크 텍스트 (별칭 포함) */
  label: string
}

export interface DocGraphData {
  nodes: DocLinkNode[]
  links: DocLinkEdge[]
  /** 노드 수 */
  nodeCount: number
  /** 엣지 수 (중복 제거 후) */
  edgeCount: number
  /** 평균 링크 수 (노드당 outDegree 평균) */
  avgLinks: number
}

export interface DocRef {
  id: string
  title: string
  content: string
  category: string
}

/** `[[target]]` 또는 `[[target|alias]]` — 코드 펜스/인라인 코드는 호출 전 strip 권장 */
const WIKI_LINK_RE = /\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]/g

/** 제목 비교용 정규화 */
export function normalizeDocTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * 단일 문서 content에서 wiki-link 추출
 */
export function extractWikiLinks(content: string): WikiLink[] {
  if (!content) return []
  const links: WikiLink[] = []
  const re = new RegExp(WIKI_LINK_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const target = (m[1] ?? '').trim()
    if (!target) continue
    const alias = (m[2] ?? '').trim() || target
    links.push({
      raw: m[0],
      target,
      alias,
      index: m.index,
      length: m[0].length,
    })
  }
  return links
}

/**
 * 제목 → 문서 id 맵 (동일 제목 시 첫 문서 우선)
 */
export function buildTitleIndex(docs: DocRef[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const d of docs) {
    const key = normalizeDocTitle(d.title)
    if (!key || map.has(key)) continue
    map.set(key, d.id)
  }
  return map
}

/**
 * 역색인: 대상 문서 id → 그 문서를 링크하는 문서 id 목록
 */
export function buildBacklinkIndex(docs: DocRef[]): Map<string, string[]> {
  const titleIndex = buildTitleIndex(docs)
  const backlinks = new Map<string, Set<string>>()

  for (const d of docs) {
    const links = extractWikiLinks(d.content)
    for (const link of links) {
      const targetId = titleIndex.get(normalizeDocTitle(link.target))
      if (!targetId || targetId === d.id) continue
      let set = backlinks.get(targetId)
      if (!set) {
        set = new Set()
        backlinks.set(targetId, set)
      }
      set.add(d.id)
    }
  }

  const result = new Map<string, string[]>()
  for (const [id, set] of backlinks) {
    result.set(id, [...set])
  }
  return result
}

/**
 * 특정 문서를 링크하는 문서 목록 (역링크)
 */
export function findBacklinks(docs: DocRef[], docId: string): DocRef[] {
  const index = buildBacklinkIndex(docs)
  const ids = index.get(docId) ?? []
  const byId = new Map(docs.map((d) => [d.id, d]))
  return ids.map((id) => byId.get(id)).filter((d): d is DocRef => Boolean(d))
}

/**
 * 문서 집합에서 네트워크 그래프 데이터 생성
 * - 노드: 모든 문서 (+ 미해결 링크 대상은 orphan placeholder 없이 스킵)
 * - 엣지: 제목이 존재하는 문서 간만
 */
export function buildDocGraph(docs: DocRef[]): DocGraphData {
  const titleIndex = buildTitleIndex(docs)
  const byId = new Map(docs.map((d) => [d.id, d]))

  const outCounts = new Map<string, number>()
  const inCounts = new Map<string, number>()
  const edgeKeys = new Set<string>()
  const links: DocLinkEdge[] = []

  for (const d of docs) {
    outCounts.set(d.id, 0)
    inCounts.set(d.id, 0)
  }

  for (const d of docs) {
    const wikiLinks = extractWikiLinks(d.content)
    const seenTargets = new Set<string>()
    for (const link of wikiLinks) {
      const targetId = titleIndex.get(normalizeDocTitle(link.target))
      if (!targetId || targetId === d.id) continue
      if (!byId.has(targetId)) continue
      const edgeKey = `${d.id}->${targetId}`
      if (edgeKeys.has(edgeKey)) continue
      edgeKeys.add(edgeKey)
      seenTargets.add(targetId)
      links.push({
        source: d.id,
        target: targetId,
        label: link.alias,
      })
      inCounts.set(targetId, (inCounts.get(targetId) ?? 0) + 1)
    }
    outCounts.set(d.id, seenTargets.size)
  }

  const nodes: DocLinkNode[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    outDegree: outCounts.get(d.id) ?? 0,
    inDegree: inCounts.get(d.id) ?? 0,
  }))

  const nodeCount = nodes.length
  const edgeCount = links.length
  const avgLinks =
    nodeCount === 0
      ? 0
      : Math.round((nodes.reduce((s, n) => s + n.outDegree, 0) / nodeCount) * 100) / 100

  return { nodes, links, nodeCount, edgeCount, avgLinks }
}

/** 카테고리별 그래프 노드 색 */
export function categoryColor(category: string): string {
  // 전체 테마와 어울리도록 파스텔 톤(밝고 부드러운 색)으로 통일
  const map: Record<string, string> = {
    'Dev Guide': '#93c5fd', // blue-300
    API: '#6ee7b7', // emerald-300
    Policy: '#fca5a5', // red-300
    Design: '#c4b5fd', // violet-300
    Deploy: '#fdba74', // orange-300
    Meeting: '#67e8f9', // cyan-300
    'Obsidian Import': '#cbd5e1', // slate-300
  }
  if (map[category]) return map[category]
  // 해시 기반 팔레트 — 명도를 높여 파스텔로
  let h = 0
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 65% 72%)`
}

/**
 * `[[` 자동완성: 커서 앞 텍스트에서 미완성 wiki-link 쿼리 추출
 * 예: "...[[API" → { query: "API", start: n }
 */
export function detectWikiLinkQuery(
  content: string,
  cursor: number,
): { query: string; start: number } | null {
  const before = content.slice(0, cursor)
  const open = before.lastIndexOf('[[')
  if (open < 0) return null
  const afterOpen = before.slice(open + 2)
  if (afterOpen.includes(']]') || afterOpen.includes('\n')) return null
  // 별칭 구간(|) 이후는 제안 대상 아님
  if (afterOpen.includes('|')) return null
  return { query: afterOpen, start: open }
}

/**
 * 쿼리에 맞는 문서 제목 제안 (최대 limit)
 */
export function suggestWikiLinkTitles(
  docs: DocRef[],
  query: string,
  limit = 8,
  excludeId?: string,
): DocRef[] {
  const q = query.trim().toLowerCase()
  const scored = docs
    .filter((d) => !excludeId || d.id !== excludeId)
    .map((d) => {
      const t = d.title.toLowerCase()
      let score = 0
      if (!q) score = 1
      else if (t.startsWith(q)) score = 3
      else if (t.includes(q)) score = 2
      else score = 0
      return { d, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.d.title.localeCompare(b.d.title, 'ko'))
  return scored.slice(0, limit).map((x) => x.d)
}

/**
 * wiki-link를 미리보기용 마크다운 링크로 치환 (제목 매칭 시)
 * 미해결 링크는 `[[title]]` 형태 유지하되 강조 표시용 HTML은 호출측에서 처리
 */
export function wikiLinksToMarkdown(content: string, docs: DocRef[]): string {
  const titleIndex = buildTitleIndex(docs)
  return content.replace(WIKI_LINK_RE, (raw, target: string, alias?: string) => {
    const t = (target ?? '').trim()
    const a = (alias ?? '').trim() || t
    const id = titleIndex.get(normalizeDocTitle(t))
    if (!id) return raw
    return `[${a}](#doc:${id})`
  })
}
