import { describe, expect, it } from 'vitest'

import { authorizeMcpHttpRequest } from '@/lib/mcp-http-auth'

function request(url = 'https://folio.example/api/mcp', authorization?: string): Request {
  return new Request(url, {
    headers: authorization ? { authorization } : undefined,
  })
}

describe('authorizeMcpHttpRequest', () => {
  it('rejects production requests when the MCP secret is not configured', () => {
    expect(authorizeMcpHttpRequest(request(), { nodeEnv: 'production', secret: '' })).toEqual({
      ok: false,
      status: 503,
      code: 'mcp_auth_not_configured',
    })
  })

  it('rejects missing and incorrect bearer credentials', () => {
    const options = { nodeEnv: 'production', secret: 'correct-secret' }
    expect(authorizeMcpHttpRequest(request(), options)).toMatchObject({ ok: false, status: 401 })
    expect(authorizeMcpHttpRequest(request(undefined, 'Bearer wrong-secret'), options)).toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('accepts the configured bearer credential', () => {
    expect(
      authorizeMcpHttpRequest(request(undefined, 'Bearer correct-secret'), {
        nodeEnv: 'production',
        secret: 'correct-secret',
      }),
    ).toEqual({ ok: true })
  })

  it('allows an unconfigured loopback request during local development', () => {
    expect(
      authorizeMcpHttpRequest(request('http://127.0.0.1:3456/api/mcp'), {
        nodeEnv: 'development',
        secret: '',
      }),
    ).toEqual({ ok: true })
  })

  it('does not extend the development exception to remote hosts', () => {
    expect(
      authorizeMcpHttpRequest(request(), { nodeEnv: 'development', secret: '' }),
    ).toMatchObject({ ok: false, status: 503 })
  })
})
