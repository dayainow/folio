'use client';

/**
 * 클라이언트 알림 — 연동 상태 조회 및 Slack/Discord 알림 요청.
 */
export interface IntegrationsStatus {
  slack: boolean
  discord: boolean
  github: boolean
  githubRepo: string | null
}

let cachedStatus: IntegrationsStatus | null = null
let statusPromise: Promise<IntegrationsStatus> | null = null

/** 서버 env 기반 연동 가능 여부 (토큰 미노출) */
export async function fetchIntegrationsStatus(): Promise<IntegrationsStatus> {
  if (cachedStatus) return cachedStatus
  if (statusPromise) return statusPromise

  statusPromise = (async () => {
    try {
      const res = await fetch('/api/integrations/status', { cache: 'no-store' })
      if (!res.ok) {
        return { slack: false, discord: false, github: false, githubRepo: null }
      }
      const data = (await res.json()) as IntegrationsStatus
      cachedStatus = data
      return data
    } catch {
      return { slack: false, discord: false, github: false, githubRepo: null }
    } finally {
      statusPromise = null
    }
  })()

  return statusPromise
}

export function clearIntegrationsStatusCache() {
  cachedStatus = null
}

/** Slack/Discord 알림 — 미설정이면 서버가 skipped */
export async function notifyChannels(
  message: string,
  channels: Array<'slack' | 'discord'> = ['slack', 'discord'],
): Promise<void> {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, channels }),
    })
  } catch {
    /* 네트워크 실패도 UI를 막지 않음 */
  }
}
