#!/usr/bin/env node
/**
 * P22 — Folio 백업 복구 (.beacon)
 * 사용: npm run runbook:restore -- backups/folio-backup-<timestamp>
 */

import { cp, mkdir, readFile, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: npm run runbook:restore -- backups/folio-backup-<timestamp>')
    process.exit(1)
  }

  const backupDir = path.resolve(root, arg)
  if (!(await exists(backupDir))) {
    console.error(`FAIL: backup not found: ${backupDir}`)
    process.exit(1)
  }

  const manifestPath = path.join(backupDir, 'manifest.json')
  if (await exists(manifestPath)) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    console.log(`manifest: ${manifest.id} · version=${manifest.version}`)
  }

  const beaconBackup = path.join(backupDir, '.beacon')
  if (await exists(beaconBackup)) {
    const dest = path.join(root, '.beacon')
    if (await exists(dest)) {
      const bak = `${dest}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`
      await rename(dest, bak)
      console.log(`moved existing .beacon → ${path.relative(root, bak)}`)
    }
    await mkdir(path.dirname(dest), { recursive: true })
    await cp(beaconBackup, dest, { recursive: true })
    console.log('OK restored .beacon/')
  } else {
    console.log('skip: backup에 .beacon/ 없음')
  }

  console.log('')
  console.log('수동 복구 안내:')
  console.log('  - localStorage: 백업 JSON을 브라우저에 키별로 복원')
  console.log('  - Supabase: Dashboard restore 또는 pg_restore')
  console.log('  - 검증: npm run dev && curl -s localhost:3000/api/health')
}

main().catch((err) => {
  console.error('FAIL runbook:restore', err instanceof Error ? err.message : err)
  process.exit(1)
})
