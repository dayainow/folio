#!/usr/bin/env node
/**
 * 번들/의존성 사이즈 + 예산 검사 (P50)
 * 사용: npm run bundle:size
 * CI: BUNDLE_BUDGET_FAIL=1 이면 초과 시 exit 1
 */

import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
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
  'web-vitals',
  'jspdf',
  'react-window',
]

console.log('=== Folio bundle-size (P66) ===\n')
console.log('주요 의존성 (node_modules):')
for (const name of PACKAGES) {
  const size = dirSize(path.join(root, 'node_modules', ...name.split('/')))
  console.log(`  ${name.padEnd(28)} ${fmt(size)}`)
}

const nextStatic = path.join(root, '.next', 'static')
const BUDGET_STATIC_MB = Number(process.env.FOLIO_BUNDLE_BUDGET_MB ?? 8)
const CHUNK_BUDGET_KB = Number(process.env.FOLIO_CHUNK_BUDGET_KB ?? 500)
/** 초기 앱 라우트 관련 메인 chunk 합(대략) — gzip 전 원시 바이트 */
const INITIAL_JS_BUDGET_KB = Number(process.env.FOLIO_INITIAL_JS_BUDGET_KB ?? 900)
const failOnBudget =
  process.env.BUNDLE_BUDGET_FAIL === '1' ||
  process.env.BUNDLE_BUDGET_FAIL === 'true' ||
  process.env.CI === 'true'

let violated = false
const report = {
  staticMb: null,
  budgetMb: BUDGET_STATIC_MB,
  topChunks: [],
  chunkBudgetKb: CHUNK_BUDGET_KB,
  initialJsKb: null,
  initialJsBudgetKb: INITIAL_JS_BUDGET_KB,
  ok: true,
}

if (existsSync(nextStatic)) {
  console.log('\n.next/static:')
  const totalBytes = dirSize(nextStatic)
  console.log(`  total                     ${fmt(totalBytes)}`)
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
    const top = files.slice(0, 8)
    console.log('\n  top chunks:')
    for (const { f, s } of top) {
      const kb = s / 1024
      const flag = kb > CHUNK_BUDGET_KB ? ' ⚠' : ''
      console.log(`    ${f.padEnd(40)} ${fmt(s)}${flag}`)
      report.topChunks.push({ file: f, bytes: s })
      if (kb > CHUNK_BUDGET_KB) {
        console.warn(`    → chunk 예산 초과 (${kb.toFixed(0)} > ${CHUNK_BUDGET_KB} KB): ${f}`)
        // chunk는 경고만 (webpack 분할 특성) — static total만 fail 기준
      }
    }
    // P66 — 초기 라우트 추정: main-app + 상위 프레임워크/공유 청크 합
    const initialLike = files.filter(
      (x) =>
        /main-app|webpack|framework|polyfills|main-|app\/page|layout/i.test(x.f) ||
        x.f.startsWith('main-'),
    )
    const initialBytes =
      initialLike.length > 0
        ? initialLike.reduce((sum, x) => sum + x.s, 0)
        : files.slice(0, 3).reduce((sum, x) => sum + x.s, 0)
    const initialKb = initialBytes / 1024
    report.initialJsKb = Math.round(initialKb * 10) / 10
    console.log(
      `\n  초기 JS 추정: ${fmt(initialBytes)} (예산 ≤ ${INITIAL_JS_BUDGET_KB} KB)`,
    )
    if (initialKb > INITIAL_JS_BUDGET_KB) {
      violated = true
      report.ok = false
      console.warn(
        `⚠ 초기 JS 예산 초과 (${initialKb.toFixed(0)} > ${INITIAL_JS_BUDGET_KB} KB)`,
      )
    }
  }
  const mb = totalBytes / (1024 * 1024)
  report.staticMb = Math.round(mb * 100) / 100
  console.log(`\n예산: .next/static ≤ ${BUDGET_STATIC_MB} MB → 현재 ${mb.toFixed(2)} MB`)
  if (mb > BUDGET_STATIC_MB) {
    violated = true
    report.ok = false
    console.warn(
      `⚠ 번들 예산을 초과했습니다 (${mb.toFixed(2)} > ${BUDGET_STATIC_MB}). docs/PERFORMANCE.md 참고`,
    )
  } else {
    console.log('✓ 번들 예산 이내')
  }
} else {
  console.log('\n.next/static: (없음 — npm run build 후 재실행)')
}

try {
  writeFileSync(path.join(root, '.bundle-size-report.json'), JSON.stringify(report, null, 2))
} catch {
  /* ignore */
}

console.log('\n권장: ANALYZE=true npm run analyze · npm run lhci')

if (violated && failOnBudget) {
  console.error('\n✗ BUNDLE_BUDGET_FAIL — CI 실패')
  process.exit(1)
}
