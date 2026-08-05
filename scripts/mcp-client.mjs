#!/usr/bin/env node
/**
 * Folio MCP CLI 클라이언트 (P33)
 *
 * 사용:
 *   npm run mcp:client -- tools
 *   npm run mcp:client -- call journal_read '{"date":"2026-07-31"}'
 *   npm run mcp:client -- resources
 *   npm run mcp:client -- prompts
 *   npm run mcp:client -- --http http://localhost:3000/api/mcp tools
 *   npm run mcp:client -- webhook '{"message":"feat: demo"}'
 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function usage() {
  console.log(`Folio MCP client

Usage:
  mcp:client [--http URL] tools
  mcp:client [--http URL] call <tool> [json-args]
  mcp:client [--http URL] resources
  mcp:client [--http URL] read <uri>
  mcp:client [--http URL] prompts
  mcp:client webhook [json-body]   # POST /api/mcp/git-webhook (local)

Examples:
  npm run mcp:client -- tools
  npm run mcp:client -- call board_list '{}'
  npm run mcp:client -- --http http://localhost:3000/api/mcp tools
`)
}

function parseArgs(argv) {
  const args = [...argv]
  let http = null
  while (args[0]?.startsWith('--')) {
    const flag = args.shift()
    if (flag === '--http') http = args.shift()
    else if (flag === '--help' || flag === '-h') return { help: true }
    else throw new Error(`unknown flag: ${flag}`)
  }
  return { http, cmd: args[0], rest: args.slice(1), help: false }
}

/** 간단한 stdio JSON-RPC (initialize + 한 요청) */
async function withStdioRpc(request) {
  const child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'src/mcp/stdio.ts'],
    {
      cwd: root,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FOLIO_MCP_ROOT: root },
    },
  )

  const rl = createInterface({ input: child.stdout })
  let nextId = 1
  const pending = new Map()

  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })

  rl.on('line', (line) => {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(JSON.stringify(msg.error)))
      else resolve(msg.result)
    }
  })

  child.stderr.on('data', (buf) => {
    const s = buf.toString().trim()
    if (s) process.stderr.write(`[mcp-server] ${s}\n`)
  })

  try {
    await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'folio-mcp-client', version: '2.8.0' },
    })
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
    )
    const result = await send(request.method, request.params)
    return result
  } finally {
    child.kill()
    rl.close()
  }
}

async function withHttpRpc(baseUrl, request) {
  const initRes = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'folio-mcp-client', version: '2.8.0' },
      },
    }),
  })
  const session = initRes.headers.get('mcp-session-id')
  await initRes.json().catch(() => null)

  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  }
  if (session) headers['mcp-session-id'] = session

  await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  }).catch(() => null)

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: request.method, params: request.params }),
  })
  const data = await res.json()
  if (data.error) throw new Error(JSON.stringify(data.error))
  return data.result
}

async function rpc(http, method, params) {
  if (http) return withHttpRpc(http, { method, params })
  return withStdioRpc({ method, params })
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.help || !parsed.cmd) {
    usage()
    process.exit(parsed.help ? 0 : 1)
  }

  const { http, cmd, rest } = parsed

  if (cmd === 'webhook') {
    const body = rest[0] ? JSON.parse(rest[0]) : { message: 'chore: mcp client ping' }
    const base = (http || 'http://localhost:3000').replace(/\/api\/mcp\/?$/, '')
    const secret = process.env.FOLIO_MCP_WEBHOOK_SECRET || ''
    const headers = { 'content-type': 'application/json' }
    if (secret) headers['x-folio-mcp-secret'] = secret
    const res = await fetch(`${base}/api/mcp/git-webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    console.log(JSON.stringify(await res.json(), null, 2))
    return
  }

  if (cmd === 'tools') {
    const result = await rpc(http, 'tools/list', {})
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (cmd === 'resources') {
    const result = await rpc(http, 'resources/list', {})
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (cmd === 'prompts') {
    const result = await rpc(http, 'prompts/list', {})
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (cmd === 'read') {
    const uri = rest[0]
    if (!uri) throw new Error('uri required')
    const result = await rpc(http, 'resources/read', { uri })
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (cmd === 'call') {
    const name = rest[0]
    if (!name) throw new Error('tool name required')
    const args = rest[1] ? JSON.parse(rest[1]) : {}
    const result = await rpc(http, 'tools/call', { name, arguments: args })
    console.log(JSON.stringify(result, null, 2))
    return
  }

  usage()
  process.exit(1)
}

main().catch((err) => {
  console.error('mcp-client error:', err.message || err)
  process.exit(1)
})
