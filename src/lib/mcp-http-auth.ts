import { timingSafeEqual } from 'node:crypto'

export type McpHttpAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; code: 'mcp_unauthorized' | 'mcp_auth_not_configured' }

function isLoopbackRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname.toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

function secretsMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

/** Protects the stateful MCP HTTP endpoint while keeping local development frictionless. */
export function authorizeMcpHttpRequest(
  request: Request,
  options: { secret?: string; nodeEnv?: string } = {},
): McpHttpAuthResult {
  const secret = (options.secret ?? process.env.FOLIO_MCP_HTTP_SECRET)?.trim()
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV

  if (!secret) {
    if (nodeEnv !== 'production' && isLoopbackRequest(request)) return { ok: true }
    return { ok: false, status: 503, code: 'mcp_auth_not_configured' }
  }

  const token = bearerToken(request)
  if (!token || !secretsMatch(token, secret)) {
    return { ok: false, status: 401, code: 'mcp_unauthorized' }
  }

  return { ok: true }
}
