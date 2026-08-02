#!/usr/bin/env node
/**
 * 간단 번들/의존성 사이즈 로깅
 * 사용: npm run bundle:size
 * (빌드 후 .next/static 도 함께 출력)
 */

import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function dirSize(dir) {
  if (!existsSync(dir)) return 0
  let total = 0
  const walk = (p) => {
    let entries
    try {
      entries = readdirSync(p, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(p, e.name)
      try {
        if (e.isDirectory()) walk(full)
        else total += statSync(full).size
      } catch {
        /* ignore */
      }
    }
  }
  walk(dir)
  return total
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const PACKAGES = [
  '@dnd-kit/core',
  'recharts',
  '@supabase/supabase-js',
  '@supabase/ssr',
  'react-markdown',
  'sql.js',
  'lucide-react',
]

console.log('=== Folio bundle-size ===\n')
console.log('주요 의존성 (node_modules):')
for (const name of PACKAGES) {
  const size = dirSize(path.join(root, 'node_modules', ...name.split('/')))
  console.log(`  ${name.padEnd(28)} ${fmt(size)}`)
}

const nextStatic = path.join(root, '.next', 'static')
if (existsSync(nextStatic)) {
  console.log('\n.next/static:')
  console.log(`  total                     ${fmt(dirSize(nextStatic))}`)
  const chunks = path.join(nextStatic, 'chunks')
  if (existsSync(chunks)) {
    console.log(`  chunks                    ${fmt(dirSize(chunks))}`)
    const files = readdirSync(chunks)
      .filter((f) => f.endsWith('.js'))
      .map((f) => {
        const s = statSync(path.join(chunks, f)).size
        return { f, s }
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
    console.log('\n  top chunks:')
    for (const { f, s } of files) {
      console.log(`    ${f.padEnd(40)} ${fmt(s)}`)
    }
  }
} else {
  console.log('\n.next/static: (없음 — npm run build 후 재실행)')
}

console.log('\n권장: ANALYZE=true npm run analyze')

// v2.0 성능 예산 (경고만 — CI에서 로그로 확인)
const BUDGET_STATIC_MB = 8
if (existsSync(nextStatic)) {
  const bytes = dirSize(nextStatic)
  const mb = bytes / (1024 * 1024)
  console.log(`\n예산: .next/static ≤ ${BUDGET_STATIC_MB} MB → 현재 ${mb.toFixed(2)} MB`)
  if (mb > BUDGET_STATIC_MB) {
    console.warn(`⚠ 번들 예산을 초과했습니다 (${mb.toFixed(2)} > ${BUDGET_STATIC_MB}). docs/PERFORMANCE.md 참고`)
  } else {
    console.log('✓ 번들 예산 이내')
  }
}
