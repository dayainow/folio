#!/usr/bin/env node
/**
 * P40 — 배포 후 헬스체크 (/api/health · /api/runtime)
 * Env:
 *   FOLIO_PRODUCTION_URL  — 우선 (커스텀 도메인)
 *   DEPLOY_URL            — Vercel 배포 URL 폴백
 *   HEALTH_RETRIES        — 기본 8
 *   HEALTH_INTERVAL_MS    — 기본 5000
 */
const base = (
  process.env.FOLIO_PRODUCTION_URL ||
  process.env.DEPLOY_URL ||
  ''
).replace(/\/$/, '')

if (!base) {
  console.log('No FOLIO_PRODUCTION_URL / DEPLOY_URL — skip health check')
  process.exit(0)
}

const retries = Number(process.env.HEALTH_RETRIES || 8)
const intervalMs = Number(process.env.HEALTH_INTERVAL_MS || 5000)

async function check(path) {
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`${path} non-JSON (${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok || json.status !== 'ok') {
    throw new Error(`${path} unhealthy (${res.status}): ${text.slice(0, 300)}`)
  }
  return json
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log(`Health check target: ${base}`)
  let lastErr
  for (let i = 1; i <= retries; i++) {
    try {
      const health = await check('/api/health')
      const runtime = await check('/api/runtime')
      console.log('OK /api/health', JSON.stringify(health))
      console.log('OK /api/runtime', JSON.stringify({
        status: runtime.status,
        version: runtime.version,
        folioVersion: runtime.folioVersion,
        env: runtime.env,
      }))
      process.exit(0)
    } catch (err) {
      lastErr = err
      console.warn(`[${i}/${retries}] ${err instanceof Error ? err.message : err}`)
      if (i < retries) await sleep(intervalMs)
    }
  }
  console.error('Health check failed:', lastErr instanceof Error ? lastErr.message : lastErr)
  process.exit(1)
}

main()
