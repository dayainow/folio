const SENSITIVE_API_PREFIXES = ['/api/ai/', '/api/jira/', '/api/beacon/'] as const

export function isSensitiveApiPath(pathname: string): boolean {
  return SENSITIVE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function isLoopbackUrl(url: string): boolean {
  const hostname = new URL(url).hostname.toLowerCase()
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

export async function hasValidApiBearer(request: Request, configuredSecret?: string): Promise<boolean> {
  const secret = configuredSecret?.trim()
  const token = bearerToken(request)
  if (!secret || !token) return false

  const [actual, expected] = await Promise.all([digest(token), digest(secret)])
  let difference = 0
  for (let index = 0; index < expected.length; index += 1) {
    difference |= actual[index]! ^ expected[index]!
  }
  return difference === 0
}

export function canUseLocalSensitiveApis(input: {
  requestUrl: string
  nodeEnv?: string
  allowProductionLoopback?: boolean
  apiSecretConfigured: boolean
  supabaseConfigured: boolean
}): boolean {
  return (
    (input.nodeEnv !== 'production' || input.allowProductionLoopback === true) &&
    !input.apiSecretConfigured &&
    !input.supabaseConfigured &&
    isLoopbackUrl(input.requestUrl)
  )
}
