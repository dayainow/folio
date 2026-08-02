/**
 * Discord Incoming Webhook (서버 전용) — Embeds 지원 (P39).
 * DISCORD_WEBHOOK_URL 미설정 시 조용히 스킵.
 */

export type DiscordEmbedColor = 'success' | 'warning' | 'info' | 'neutral'

export type DiscordEmbedField = {
  name: string
  value: string
  inline?: boolean
}

export type DiscordEmbedPayload = {
  title?: string
  description?: string
  /** 색상 키 또는 raw decimal */
  color?: DiscordEmbedColor | number
  fields?: DiscordEmbedField[]
  url?: string
  footer?: string
}

export type DiscordNotifyPayload = {
  /** plain content (멘션 등) — embeds와 병행 가능 */
  content?: string
  embed?: DiscordEmbedPayload
  embeds?: DiscordEmbedPayload[]
}

const EMBED_COLORS: Record<DiscordEmbedColor, number> = {
  success: 0x22c55e, // 초록 — 완료
  warning: 0xf59e0b, // 주황 — 경고
  info: 0x3b82f6, // 파랑 — 정보
  neutral: 0x64748b,
}

export function isDiscordConfigured(): boolean {
  const url = process.env.DISCORD_WEBHOOK_URL
  return !!url && url !== 'your-discord-webhook-url' && url.startsWith('https://')
}

function folioFooterUrl(): string {
  return (
    process.env.NEXT_PUBLIC_FOLIO_URL?.replace(/\/$/, '') ||
    process.env.FOLIO_PUBLIC_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000'
  )
}

function resolveColor(color?: DiscordEmbedColor | number): number {
  if (typeof color === 'number') return color
  if (color && color in EMBED_COLORS) return EMBED_COLORS[color]
  return EMBED_COLORS.info
}

function toDiscordEmbed(embed: DiscordEmbedPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {
    color: resolveColor(embed.color),
    timestamp: new Date().toISOString(),
    footer: {
      text: embed.footer?.trim() || 'Folio',
    },
  }
  if (embed.title?.trim()) out.title = embed.title.trim().slice(0, 256)
  if (embed.description?.trim()) out.description = embed.description.trim().slice(0, 4096)
  if (embed.url?.startsWith('http')) out.url = embed.url
  if (embed.fields?.length) {
    out.fields = embed.fields.slice(0, 25).map((f) => ({
      name: f.name.slice(0, 256) || '—',
      value: f.value.slice(0, 1024) || '—',
      inline: Boolean(f.inline),
    }))
  }
  return out
}

/** Rich Embed 전송 (색상 · footer · timestamp) */
export async function sendDiscordEmbed(
  embed: DiscordEmbedPayload,
  content?: string,
): Promise<{ ok: boolean; skipped?: boolean }> {
  return sendDiscordNotification({
    content,
    embed: {
      ...embed,
      footer: embed.footer ?? `Folio · ${folioFooterUrl()}`,
      url: embed.url ?? folioFooterUrl(),
    },
  })
}

/** 이벤트 타입별 편의 헬퍼 */
export async function sendDiscordEvent(
  kind: 'save' | 'task_done' | 'gate' | 'info' | 'warning',
  title: string,
  description: string,
  fields?: DiscordEmbedField[],
): Promise<{ ok: boolean; skipped?: boolean }> {
  const color: DiscordEmbedColor =
    kind === 'task_done' || kind === 'save'
      ? 'success'
      : kind === 'warning'
        ? 'warning'
        : kind === 'gate'
          ? 'info'
          : 'info'

  return sendDiscordEmbed({
    title,
    description,
    color,
    fields,
  })
}

/**
 * webhook 전송.
 * - string: 기존 plain content (하위 호환)
 * - payload: embeds 우선
 */
export async function sendDiscordNotification(
  messageOrPayload: string | DiscordNotifyPayload,
): Promise<{ ok: boolean; skipped?: boolean }> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url || url === 'your-discord-webhook-url' || !url.startsWith('https://')) {
    return { ok: true, skipped: true }
  }

  const payload: DiscordNotifyPayload =
    typeof messageOrPayload === 'string'
      ? { content: messageOrPayload }
      : messageOrPayload

  const embedsRaw = [
    ...(payload.embeds ?? []),
    ...(payload.embed ? [payload.embed] : []),
  ]
  const embeds = embedsRaw.map((e) =>
    toDiscordEmbed({
      ...e,
      footer: e.footer ?? `Folio · ${folioFooterUrl()}`,
    }),
  )

  const content = payload.content?.trim()
  if (!content && embeds.length === 0) return { ok: true, skipped: true }

  const body: Record<string, unknown> = {}
  if (content) body.content = content.slice(0, 2000)
  if (embeds.length > 0) body.embeds = embeds.slice(0, 10)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`Discord webhook ${res.status}: ${errBody || res.statusText}`)
  }

  return { ok: true }
}
