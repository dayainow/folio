/**
 * P43 — 협업 알림 (멘션 · 초대 · Gate 팀 브로드캐스트)
 */
'use client'

import { showFolioPush } from '@/lib/push-notifications'
import { getActiveTeamId } from '@/lib/team'
import { publishActivity } from '@/lib/activity-stream'

const TEAM_BC = 'folio-team-notify'

export type TeamNotifyKind = 'mention' | 'invite' | 'gate' | 'share'

export type TeamNotifyPayload = {
  kind: TeamNotifyKind
  title: string
  body: string
  url?: string
  tag?: string
  teamId?: string | null
  /** 멘션 대상 (email / handle) — 본인 매칭용 */
  mentionTargets?: string[]
  actorId?: string
  actorName?: string
}

function channel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(TEAM_BC)
  } catch {
    return null
  }
}

/** 팀 채널로 알림 브로드캐스트 + 로컬 푸시 + 알림 센터 */
export async function broadcastTeamNotify(payload: TeamNotifyPayload): Promise<void> {
  const teamId = payload.teamId ?? getActiveTeamId()
  const msg: TeamNotifyPayload = { ...payload, teamId }
  channel()?.postMessage(msg)
  void import('@/lib/notification-center').then(({ pushFromTeamNotify }) => {
    pushFromTeamNotify(msg)
  })
  await showFolioPush({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    tag: payload.tag ?? `folio-${payload.kind}`,
    group: payload.kind === 'gate' ? 'gate' : payload.kind === 'invite' ? 'invite' : 'collab',
    thread: payload.teamId ?? payload.kind,
    actions: [
      { action: 'open', title: '열기' },
      { action: 'dismiss', title: '닫기' },
    ],
    kind: payload.kind,
  })
}

/** 다른 탭/창에서 팀 알림을 구독 (멘션은 본인 핸들 매칭) */
export function subscribeTeamNotify(
  self: { userId?: string | null; email?: string | null; name?: string | null },
  onNotify?: (p: TeamNotifyPayload) => void,
): () => void {
  const bc = channel()
  if (!bc) return () => undefined

  const handles = new Set(
    [self.userId, self.email, self.name, self.email?.split('@')[0]]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase()),
  )

  const onMsg = (ev: MessageEvent) => {
    const data = ev.data as TeamNotifyPayload | undefined
    if (!data?.kind) return
    if (data.kind === 'mention' && data.mentionTargets?.length) {
      const hit = data.mentionTargets.some((t) => handles.has(t.toLowerCase()))
      if (!hit) return
      // 본인이 보낸 멘션은 스킵
      if (data.actorId && self.userId && data.actorId === self.userId) return
    }
    onNotify?.(data)
    void import('@/lib/notification-center').then(({ pushFromTeamNotify }) => {
      pushFromTeamNotify(data)
    })
    void showFolioPush({
      title: data.title,
      body: data.body,
      url: data.url ?? '/',
      tag: data.tag ?? `folio-${data.kind}`,
      group: data.kind === 'gate' ? 'gate' : data.kind === 'invite' ? 'invite' : 'collab',
      thread: data.teamId ?? data.kind,
      actions: [
        { action: 'open', title: '열기' },
        { action: 'dismiss', title: '닫기' },
      ],
      kind: data.kind,
    })
  }
  bc.addEventListener('message', onMsg)
  return () => {
    bc.removeEventListener('message', onMsg)
    bc.close()
  }
}

/** @멘션 푸시 */
export async function notifyMentions(input: {
  mentions: string[]
  authorId: string
  authorName: string
  targetKind: 'doc' | 'journal'
  targetId: string
  excerpt: string
}): Promise<void> {
  if (!input.mentions.length) return
  const url =
    input.targetKind === 'journal'
      ? `/?tab=journal&date=${encodeURIComponent(input.targetId)}`
      : `/?tab=docs&docId=${encodeURIComponent(input.targetId)}`
  await broadcastTeamNotify({
    kind: 'mention',
    title: `${input.authorName}님이 멘션했습니다`,
    body: input.excerpt.slice(0, 120),
    url,
    tag: 'folio-mention',
    mentionTargets: input.mentions,
    actorId: input.authorId,
    actorName: input.authorName,
  })
  void publishActivity({
    type: 'comment',
    actorId: input.authorId,
    actorName: input.authorName,
    targetKind: input.targetKind,
    targetId: input.targetId,
    summary: `@멘션: ${input.mentions.join(', ')}`,
    meta: { mentions: input.mentions },
  })
}

/** 문서/보드 공유 초대 알림 */
export async function notifyShareInvite(input: {
  resource: 'doc' | 'board'
  resourceLabel: string
  permission: string
  actorName: string
  actorId?: string
  teamId?: string | null
}): Promise<void> {
  await broadcastTeamNotify({
    kind: 'share',
    title: '공유 초대',
    body: `${input.actorName}님이 ${input.resourceLabel}을(를) ${input.permission}으로 공유했습니다`,
    url: input.resource === 'doc' ? '/?tab=docs' : '/?tab=board',
    tag: 'folio-share',
    teamId: input.teamId,
    actorId: input.actorId,
    actorName: input.actorName,
  })
}

/** Gate 상태 변경 → 팀 전체 알림 */
export async function notifyGateTeamChange(input: {
  gateLabel: string
  status?: string
  actorName?: string
}): Promise<void> {
  await broadcastTeamNotify({
    kind: 'gate',
    title: 'Gate 상태 변경',
    body: `${input.gateLabel}${input.status ? ` → ${input.status}` : ''}${
      input.actorName ? ` · ${input.actorName}` : ''
    }`,
    url: '/?tab=process',
    tag: 'folio-gate-team',
    teamId: getActiveTeamId(),
    actorName: input.actorName,
  })
  void publishActivity({
    type: 'other',
    actorId: 'system',
    actorName: input.actorName ?? 'Beacon',
    targetKind: 'process',
    targetId: 'gate',
    summary: `Gate: ${input.gateLabel}`,
  })
}

/** 팀 초대 생성 시 수신자용 알림 페이로드 브로드캐스트 */
export async function notifyTeamInviteCreated(input: {
  email: string
  role: string
  inviteLink: string
  expiresAt: string
  actorName?: string
}): Promise<void> {
  const exp = new Date(input.expiresAt)
  const expLabel = Number.isNaN(exp.getTime())
    ? input.expiresAt
    : exp.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
  await broadcastTeamNotify({
    kind: 'invite',
    title: '팀 초대',
    body: `${input.email} → ${input.role} (만료 ${expLabel})`,
    url: input.inviteLink,
    tag: 'folio-team-invite',
    mentionTargets: [input.email, input.email.split('@')[0]!],
    actorName: input.actorName,
  })
}
