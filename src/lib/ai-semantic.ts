/**
 * P67 — 로컬 해시 임베딩 + 의미 검색 (클라이언트·서버 공용)
 */
export type EmbeddingVector = Float32Array

const DIM = 256

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s#-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
}

function hashToken(token: string): number {
  let h = 2166136261
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % DIM
}

/** 로컬 bag-of-words 해시 임베딩 (정규화) */
export function localEmbed(text: string): EmbeddingVector {
  const v = new Float32Array(DIM)
  const tokens = tokenize(text)
  if (tokens.length === 0) return v
  for (const t of tokens) {
    v[hashToken(t)] += 1
  }
  let norm = 0
  for (let i = 0; i < DIM; i++) norm += v[i]! * v[i]!
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < DIM; i++) v[i]! /= norm
  return v
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!
  return s
}

export type SemanticDoc = {
  id: string
  source: 'journal' | 'doc' | 'task'
  title: string
  text: string
  updatedAt?: string
  tags?: string[]
}

export type SemanticHit = SemanticDoc & {
  score: number
  preview: string
}

function previewOf(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.slice(0, 140) + (t.length > 140 ? '…' : '')
}

/** 로컬 의미 검색 (임베딩 유사도) */
export function semanticSearchLocal(
  query: string,
  docs: SemanticDoc[],
  limit = 20,
): SemanticHit[] {
  const q = localEmbed(query)
  return docs
    .map((d) => {
      const score = cosineSimilarity(q, localEmbed(`${d.title}\n${d.text}\n${(d.tags ?? []).join(' ')}`))
      return {
        ...d,
        score,
        preview: previewOf(d.text || d.title),
      }
    })
    .filter((h) => h.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** 키워드 기반 관련 문서 추천 (동일 임베딩) */
export function recommendRelated(
  seed: string,
  docs: SemanticDoc[],
  excludeId?: string,
  limit = 5,
): SemanticHit[] {
  return semanticSearchLocal(seed, docs.filter((d) => d.id !== excludeId), limit)
}
