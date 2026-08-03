#!/usr/bin/env node
/**
 * P50 — Lighthouse CI 래퍼
 * 사전: npm run build
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
if (!existsSync(path.join(root, '.next'))) {
  console.error('✗ .next 없음 — 먼저 npm run build')
  process.exit(1)
}

const lhci = path.join(root, 'node_modules', '.bin', 'lhci')
if (!existsSync(lhci)) {
  console.error('✗ @lhci/cli 미설치 — npm i -D @lhci/cli')
  process.exit(1)
}

const result = spawnSync(lhci, ['autorun', '--config=./.lighthouserc.cjs'], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, LHCI_BUILD_CONTEXT__CURRENT_HASH: process.env.GITHUB_SHA ?? 'local' },
})

process.exit(result.status ?? 1)
