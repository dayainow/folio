import { beforeEach, describe, expect, it } from 'vitest'
import { getCollabMode, setCollabMode, COLLAB_MODE_LABELS } from '@/lib/collab-mode'
import { decodeEnvelope, encodeEnvelope } from '@/lib/collab-protocol'
import { compressNumberArray, decompressNumberArray, throttle } from '@/lib/collab-perf'
import {
  resolveConflictMarkers,
  suggestConflictResolution,
  threeWayMerge,
} from '@/lib/conflict-merge'
import { RoomRegistry } from '@/server/collab/room'
import { createMemoryPubSub } from '@/server/collab/pubsub'
import { startCollabServer } from '@/server/collab/server'
import WebSocket from 'ws'

describe('collab-mode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to local and persists modes', () => {
    expect(getCollabMode()).toBe('local')
    setCollabMode('server')
    expect(getCollabMode()).toBe('server')
    setCollabMode('hybrid')
    expect(getCollabMode()).toBe('hybrid')
    expect(COLLAB_MODE_LABELS.hybrid).toBe('하이브리드')
  })
})

describe('collab-protocol', () => {
  it('roundtrips envelopes', () => {
    const msg = { v: 1 as const, type: 'ping' as const }
    expect(decodeEnvelope(encodeEnvelope(msg))).toEqual(msg)
  })
})

describe('collab-perf', () => {
  it('compresses and decompresses runs', () => {
    const arr = Array.from({ length: 80 }, () => 7)
    const packed = compressNumberArray(arr)
    expect(packed.compressed).toBe(true)
    expect(decompressNumberArray(packed.data, true)).toEqual(arr)
  })

  it('throttles bursts', async () => {
    let count = 0
    const fn = throttle(() => {
      count += 1
    }, 30)
    fn()
    fn()
    fn()
    expect(count).toBe(1)
    await new Promise((r) => setTimeout(r, 40))
    expect(count).toBeGreaterThanOrEqual(1)
  })
})

describe('conflict-merge', () => {
  it('auto-merges remote-only change', () => {
    const r = threeWayMerge('a\nb\nc', 'a\nb\nc', 'a\nb\nC')
    expect(r.ok).toBe(true)
    expect(r.merged).toContain('C')
  })

  it('detects conflicts and resolves markers', () => {
    const r = threeWayMerge('line', 'local-line', 'remote-line')
    expect(r.conflictCount).toBeGreaterThan(0)
    const local = resolveConflictMarkers(r.merged, 'local')
    expect(local).toContain('local')
    const tip = suggestConflictResolution('base', 'L', 'R')
    expect(tip.needsManual).toBe(true)
  })
})

describe('collab room registry', () => {
  it('tracks peers and buffers', () => {
    const reg = new RoomRegistry()
    const room = reg.getOrCreate('doc:1')
    const fakeSocket = { readyState: 1 } as unknown as import('ws').WebSocket
    room.addPeer({ clientId: 'a', socket: fakeSocket })
    room.pushYjsUpdate([1, 2, 3])
    room.pushChat({
      id: '1',
      userId: 'u',
      userName: 'U',
      text: 'hi',
      ts: new Date().toISOString(),
    })
    expect(room.size).toBe(1)
    expect(room.getYjsBuffers()).toHaveLength(1)
    expect(room.listChat()).toHaveLength(1)
    room.removePeer('a')
    reg.deleteIfEmpty('doc:1')
    expect(reg.get('doc:1')).toBeUndefined()
  })
})

describe('collab pubsub', () => {
  it('fans out in memory', async () => {
    const ps = createMemoryPubSub()
    const seen: string[] = []
    const unsub = ps.subscribe('ch', (_c, m) => seen.push(m))
    await ps.publish('ch', 'hello')
    expect(seen).toEqual(['hello'])
    unsub()
    await ps.close()
  })
})

describe('collab websocket server', () => {
  it('accepts join and relays chat', async () => {
    const handle = await startCollabServer({ port: 0, host: '127.0.0.1' })
    const addr = handle.httpServer.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0

    const a = new WebSocket(`ws://127.0.0.1:${port}/collab`)
    const b = new WebSocket(`ws://127.0.0.1:${port}/collab`)

    await Promise.all([
      new Promise<void>((res, rej) => {
        a.once('open', () => res())
        a.once('error', rej)
      }),
      new Promise<void>((res, rej) => {
        b.once('open', () => res())
        b.once('error', rej)
      }),
    ])

    const got = new Promise<string>((resolve) => {
      b.on('message', (data) => {
        const raw = data.toString()
        if (raw.includes('"type":"chat"')) resolve(raw)
      })
    })

    a.send(
      JSON.stringify({
        v: 1,
        type: 'join',
        room: 'doc:test',
        clientId: 'a',
        user: { id: 'a', name: 'A' },
      }),
    )
    b.send(
      JSON.stringify({
        v: 1,
        type: 'join',
        room: 'doc:test',
        clientId: 'b',
        user: { id: 'b', name: 'B' },
      }),
    )

    await new Promise((r) => setTimeout(r, 50))

    a.send(
      JSON.stringify({
        v: 1,
        type: 'chat',
        room: 'doc:test',
        message: {
          id: 'm1',
          userId: 'a',
          userName: 'A',
          text: 'hello-collab',
          ts: new Date().toISOString(),
        },
      }),
    )

    const payload = await Promise.race([
      got,
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000)),
    ])
    expect(payload).toContain('hello-collab')

    a.close()
    b.close()
    await handle.close()
  }, 10_000)
})
