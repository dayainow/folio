#!/usr/bin/env node
/**
 * 간단 성능/번들 측정 스크립트
 * - 의존성 패키지 디스크 크기
 * - `.next` 빌드 산출물(있으면) 합계
 *
 * 사용: npm run perf:measure
 * 분석 UI: ANALYZE=true npm run analyze
 */

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
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

const packages = [
  '@dnd-kit/core',
  'recharts',
  'react-markdown',
  'sql.js',
  '@supabase/supabase-js',
  'lucide-react',
]

console.log('=== Folio perf measure ===\n')
console.log('의존성 (node_modules 디스크):')
for (const name of packages) {
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
  }
} else {
  console.log('\n.next/static: (없음 — `npm run build` 후 재실행)')
}

const buildManifest = path.join(root, '.next', 'build-manifest.json')
if (existsSync(buildManifest)) {
  try {
    const manifest = JSON.parse(readFileSync(buildManifest, 'utf8'))
    const pages = manifest.pages ?? {}
    console.log('\nbuild-manifest pages (파일 수):')
    for (const [route, files] of Object.entries(pages).slice(0, 12)) {
      console.log(`  ${route}: ${files.length} files`)
    }
  } catch {
    /* ignore */
  }
}

console.log('\n권장:')
console.log('  ANALYZE=true npm run analyze   # 번들 UI')
console.log('  npm run build && npm run perf:measure')
console.log('\n목표: 초기 탭에서 recharts / @dnd-kit 미로드 (탭별 code splitting)')
