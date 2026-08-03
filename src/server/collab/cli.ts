/**
 * P48 — Collab WS 서버 CLI
 * 사용: npm run collab:server
 */
import { startCollabServer } from '@/server/collab/server'

async function main() {
  const handle = await startCollabServer()
  console.log(
    `[folio-collab] ws://${handle.host === '0.0.0.0' ? '127.0.0.1' : handle.host}:${handle.port}/collab · backend=${handle.backend}`,
  )

  const shutdown = async () => {
    console.log('[folio-collab] shutting down…')
    await handle.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
