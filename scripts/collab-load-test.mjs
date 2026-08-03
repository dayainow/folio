#!/usr/bin/env node
/**
 * P48 — Collab WS 부하 스모크 (기본 100 동시 연결)
 * 사용: npm run collab:server & npm run collab:load
 */
import WebSocket from 'ws'

const URL = process.env.COLLAB_WS_URL ?? 'ws://127.0.0.1:1234/collab'
const N = Number(process.env.COLLAB_LOAD_N ?? 100)
const ROOM = process.env.COLLAB_LOAD_ROOM ?? 'load:bench'

function connect(i) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL)
    const t = setTimeout(() => {
      ws.close()
      reject(new Error(`timeout client ${i}`))
    }, 8000)
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          v: 1,
          type: 'join',
          room: ROOM,
          clientId: `load-${i}`,
          user: { id: `u${i}`, name: `User${i}` },
        }),
      )
      clearTimeout(t)
      resolve(ws)
    })
    ws.on('error', (err) => {
      clearTimeout(t)
      reject(err)
    })
  })
}

async function main() {
  const started = Date.now()
  console.log(`[collab-load] connecting ${N} clients → ${URL} room=${ROOM}`)
  const sockets = []
  const batch = 20
  for (let i = 0; i < N; i += batch) {
    const slice = []
    for (let j = i; j < Math.min(N, i + batch); j += 1) slice.push(connect(j))
    sockets.push(...(await Promise.all(slice)))
  }
  const joinMs = Date.now() - started

  // yjs fanout sample
  const payload = JSON.stringify({
    v: 1,
    type: 'yjs',
    room: ROOM,
    update: Array.from({ length: 64 }, (_, i) => i % 7),
  })
  const fanoutStart = Date.now()
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload)
  }
  await new Promise((r) => setTimeout(r, 500))
  const fanoutMs = Date.now() - fanoutStart

  for (const ws of sockets) {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }

  console.log(
    JSON.stringify(
      {
        clients: N,
        joinMs,
        fanoutMs,
        avgJoinMs: Math.round(joinMs / N),
        ok: true,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
