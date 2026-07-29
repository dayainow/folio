#!/usr/bin/env node
/**
 * P22 — Folio 백업 (Beacon 디렉터리 + 매니페스트)
 * 사용: npm run runbook:backup
 * 출력: backups/folio-backup-<timestamp>/
 */

import { cp, mkdir, stat, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const id = `folio-backup-${stamp()}`
  const outDir = path.join(root, 'backups', id)
  await mkdir(outDir, { recursive: true })

  const included = []
  const skipped = []

  const beaconSrc = path.join(root, '.beacon')
  if (await exists(beaconSrc)) {
    await cp(beaconSrc, path.join(outDir, '.beacon'), { recursive: true })
    included.push('.beacon/')
  } else {
    skipped.push('.beacon/ (없음)')
  }

  const envExample = path.join(root, 'docs', 'env.example')
  if (await exists(envExample)) {
    await cp(envExample, path.join(outDir, 'env.example'))
    included.push('docs/env.example → env.example')
  }

  // localStorage / Supabase는 브라우저·클라우드 작업 — 안내만 기록
  const notes = [
    'localStorage: 브라우저 DevTools에서 workspace_* / folio_* 키를 export 하세요.',
    'Supabase: Dashboard Backups 또는 pg_dump 로 DB를 백업하세요. (시크릿 URL 사용)',
    '.env.local 실값은 보안상 이 백업에 포함하지 않습니다.',
  ]

  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    version: pkg.version ?? null,
    root,
    included,
    skipped,
    notes,
  }

  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  console.log(`OK backup → ${path.relative(root, outDir)}`)
  console.log(`  included: ${included.length ? included.join(', ') : '(없음)'}`)
  if (skipped.length) console.log(`  skipped: ${skipped.join(', ')}`)
  console.log('  notes:')
  for (const n of notes) console.log(`   - ${n}`)
}

main().catch((err) => {
  console.error('FAIL runbook:backup', err instanceof Error ? err.message : err)
  process.exit(1)
})
