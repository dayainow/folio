#!/usr/bin/env node
/**
 * P22 — Folio 배포 진입점
 * 사용:
 *   npm run runbook:deploy
 *   FOLIO_DEPLOY_TARGET=docker npm run runbook:deploy
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = (process.env.FOLIO_DEPLOY_TARGET || 'vercel').toLowerCase()

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env,
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    })
    child.on('error', reject)
  })
}

async function main() {
  console.log(`runbook:deploy target=${target}`)

  if (target === 'docker') {
    await run('docker', ['compose', 'up', '--build', '-d'])
    console.log('OK docker compose up --build -d')
    console.log('헬스체크: curl -s http://localhost:3000/api/health')
    return
  }

  if (target === 'vercel' || target === 'prod') {
    await run('npx', ['vercel', '--prod', '--yes'])
    console.log('OK vercel --prod')
    console.log('헬스체크: curl -sS https://<host>/api/health && curl -sS https://<host>/api/runtime')
    return
  }

  console.error(`Unknown FOLIO_DEPLOY_TARGET=${target} (use vercel|docker)`)
  process.exit(1)
}

main().catch((err) => {
  console.error('FAIL runbook:deploy', err instanceof Error ? err.message : err)
  process.exit(1)
})
