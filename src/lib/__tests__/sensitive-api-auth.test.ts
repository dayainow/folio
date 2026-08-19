import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { middleware } from '@/middleware'
import {
  canUseLocalSensitiveApis,
  hasValidApiBearer,
  isSensitiveApiPath,
} from '@/lib/sensitive-api-auth'

function configureEnv(input: { nodeEnv: string; apiSecret?: string }) {
  vi.stubEnv('NODE_ENV', input.nodeEnv)
  vi.stubEnv('FOLIO_API_SECRET', input.apiSecret ?? '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sensitive API authentication', () => {
  it('protects AI, Jira and Beacon routes without covering public APIs', () => {
    expect(isSensitiveApiPath('/api/ai/generate')).toBe(true)
    expect(isSensitiveApiPath('/api/jira/issues')).toBe(true)
    expect(isSensitiveApiPath('/api/beacon/folio')).toBe(true)
    expect(isSensitiveApiPath('/api/health')).toBe(false)
    expect(isSensitiveApiPath('/api/share/token')).toBe(false)
  })

  it('validates bearer credentials without accepting malformed headers', async () => {
    const valid = new Request('https://folio.example/api/ai/generate', {
      headers: { authorization: 'Bearer correct-secret' },
    })
    const malformed = new Request('https://folio.example/api/ai/generate', {
      headers: { authorization: 'Basic correct-secret' },
    })

    await expect(hasValidApiBearer(valid, 'correct-secret')).resolves.toBe(true)
    await expect(hasValidApiBearer(valid, 'wrong-secret')).resolves.toBe(false)
    await expect(hasValidApiBearer(malformed, 'correct-secret')).resolves.toBe(false)
  })

  it('keeps the no-configuration exception limited to local development', () => {
    expect(
      canUseLocalSensitiveApis({
        requestUrl: 'http://127.0.0.1:3456/api/beacon/folio',
        nodeEnv: 'development',
        apiSecretConfigured: false,
        supabaseConfigured: false,
      }),
    ).toBe(true)
    expect(
      canUseLocalSensitiveApis({
        requestUrl: 'https://folio.example/api/beacon/folio',
        nodeEnv: 'development',
        apiSecretConfigured: false,
        supabaseConfigured: false,
      }),
    ).toBe(false)
  })

  it('requires an explicit opt-in for a local production server', () => {
    const base = {
      requestUrl: 'http://127.0.0.1:3000/api/ai/generate',
      nodeEnv: 'production',
      apiSecretConfigured: false,
      supabaseConfigured: false,
    }
    expect(canUseLocalSensitiveApis(base)).toBe(false)
    expect(canUseLocalSensitiveApis({ ...base, allowProductionLoopback: true })).toBe(true)
  })

  it('closes sensitive production APIs when authentication is not configured', async () => {
    configureEnv({ nodeEnv: 'production' })
    const response = await middleware(new NextRequest('https://folio.example/api/beacon/folio'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: 'api_auth_not_configured' })
  })

  it('requires credentials when production API authentication is configured', async () => {
    configureEnv({ nodeEnv: 'production', apiSecret: 'correct-secret' })
    const response = await middleware(new NextRequest('https://folio.example/api/jira/issues'))

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe('Bearer')
  })

  it('accepts a valid bearer credential and bypasses browser-only CSRF checks', async () => {
    configureEnv({ nodeEnv: 'production', apiSecret: 'correct-secret' })
    const response = await middleware(
      new NextRequest('https://folio.example/api/ai/generate', {
        method: 'POST',
        headers: { authorization: 'Bearer correct-secret' },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('allows an unconfigured sensitive API only on a local development host', async () => {
    configureEnv({ nodeEnv: 'development' })
    const response = await middleware(new NextRequest('http://localhost:3456/api/beacon/folio'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
