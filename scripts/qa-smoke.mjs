#!/usr/bin/env node
/**
 * P18 QA 스모크 — 저장 디바운스/flush · 태그 집계 · 보드 상태 순서
 * 사용: npm run qa:smoke
 */

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

// --- debounce + flush (local-cache 동작 모형) ---
function createDebounce(fn, waitMs) {
  let timer = null
  let lastArgs = null
  const wrapped = (...args) => {
    lastArgs = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (lastArgs) fn(...lastArgs)
      lastArgs = null
    }, waitMs)
  }
  wrapped.flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (lastArgs) {
      fn(...lastArgs)
      lastArgs = null
    }
  }
  return wrapped
}

const store = new Map()
const writer = createDebounce((raw) => store.set('workspace_journals', raw), 300)
function setLocal(value) {
  const raw = JSON.stringify(value)
  store.set('__mem', raw)
  writer(raw)
}
function flush() {
  writer.flush()
}
function getLocal() {
  return JSON.parse(store.get('workspace_journals') || store.get('__mem') || '{}')
}

setLocal({ '2026-07-29': { content: '오늘', tags: ['qa'] } })
assert(!store.has('workspace_journals'), 'debounce: 즉시 localStorage 쓰기 없어야 함')
flush()
assert(getLocal()['2026-07-29'].content === '오늘', 'flush 후 내용 유지')
assert(JSON.stringify(getLocal()['2026-07-29'].tags) === JSON.stringify(['qa']), '태그 유지')

// --- 보드 컬럼 좌우 이동 ---
const STATUS_ORDER = ['backlog', 'in_progress', 'review', 'done']
function moveStatus(status, dir) {
  const idx = STATUS_ORDER.indexOf(status)
  if (dir === 'left' && idx > 0) return STATUS_ORDER[idx - 1]
  if (dir === 'right' && idx < STATUS_ORDER.length - 1) return STATUS_ORDER[idx + 1]
  return status
}
assert(moveStatus('backlog', 'right') === 'in_progress', '보드 → 이동')
assert(moveStatus('done', 'right') === 'done', '보드 done 우측 고정')
assert(moveStatus('review', 'left') === 'in_progress', '보드 ← 이동')

// --- 태그 클라우드 집계 ---
function buildTagCounts(sources) {
  const map = new Map()
  for (const item of sources) {
    for (const raw of item.tags ?? []) {
      const tag = raw.trim()
      if (!tag) continue
      map.set(tag, (map.get(tag) ?? 0) + 1)
    }
  }
  return [...map.entries()].map(([tag, count]) => ({ tag, count }))
}
const counts = buildTagCounts([{ tags: ['a', 'b'] }, { tags: ['a'] }])
assert(counts.find((c) => c.tag === 'a')?.count === 2, '태그 빈도')
assert(counts.find((c) => c.tag === 'b')?.count === 1, '태그 단일')

// --- wiki-link 파서 (P31) ---
const WIKI_RE = /\[\[([^\]|#]+?)(?:\|([^\]]+))?\]\]/g
function extractWiki(content) {
  const links = []
  let m
  const re = new RegExp(WIKI_RE.source, 'g')
  while ((m = re.exec(content)) !== null) {
    links.push({ target: m[1].trim(), alias: (m[2] || m[1]).trim() })
  }
  return links
}
const wiki = extractWiki('see [[API 명세|API]] and [[프로젝트 규칙]]')
assert(wiki.length === 2, 'wiki link count')
assert(wiki[0].target === 'API 명세' && wiki[0].alias === 'API', 'wiki alias')
assert(wiki[1].target === '프로젝트 규칙', 'wiki plain')

// --- export CSV escape (P32) ---
function csvEscape(value) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
assert(csvEscape('a,b') === '"a,b"', 'csv comma')
assert(csvEscape('say "hi"') === '"say ""hi"""', 'csv quote')
assert(csvEscape('plain') === 'plain', 'csv plain')

console.log('qa:smoke OK — debounce/flush, board move, tag counts, wiki links, export')
