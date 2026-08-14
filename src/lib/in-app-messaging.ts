/**
 * P61 — 인앱 메시지 채널 (문서/프로젝트) · 읽음 · 반응 · 검색
 */
'use client'

import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'

export type MessageChannelKind = 'doc' | 'project' | 'general'

export type MessageChannel = {
  id: string
  kind: MessageChannelKind
  title: string
  /** docId / projectId 등 */
  refId?: string
  createdAt: string
  updatedAt: string
}

export type MessageReaction = Record<string, string[]> // emoji → userIds

export type InAppMessage = {
  id: string
  channelId: string
  userId: string
  userName: string
  text: string
  createdAt: string
  readBy: string[]
  reactions: MessageReaction
}

const CH_KEY = 'folio_message_channels_v1'
const MSG_KEY = 'folio_messages_v1'
const CHANGE = 'folio-messages-changed'
const MAX_MSG = 500
const MAX_CH = 40

function emit() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE))
  }
}

function loadChannels(): MessageChannel[] {
  const list = getLocalJson<MessageChannel[]>(CH_KEY, [])
  return Array.isArray(list) ? list : []
}

function saveChannels(list: MessageChannel[]) {
  setLocalJson(CH_KEY, list.slice(0, MAX_CH))
  flushLocalJson(CH_KEY)
  emit()
}

function loadMessages(): InAppMessage[] {
  const list = getLocalJson<InAppMessage[]>(MSG_KEY, [])
  return Array.isArray(list) ? list : []
}

function saveMessages(list: InAppMessage[]) {
  setLocalJson(MSG_KEY, list.slice(-MAX_MSG))
  flushLocalJson(MSG_KEY)
  emit()
}

export function listMessageChannels(): MessageChannel[] {
  return loadChannels().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function ensureMessageChannel(input: {
  kind: MessageChannelKind
  title: string
  refId?: string
  id?: string
}): MessageChannel {
  const channels = loadChannels()
  const existing = channels.find(
    (c) =>
      (input.id && c.id === input.id) ||
      (input.refId && c.refId === input.refId && c.kind === input.kind),
  )
  if (existing) return existing
  const now = new Date().toISOString()
  const ch: MessageChannel = {
    id: input.id ?? crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    refId: input.refId,
    createdAt: now,
    updatedAt: now,
  }
  saveChannels([ch, ...channels])
  return ch
}

export function listChannelMessages(channelId: string, limit = 100): InAppMessage[] {
  return loadMessages()
    .filter((m) => m.channelId === channelId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-limit)
}

export function searchMessages(query: string, channelId?: string): InAppMessage[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return loadMessages()
    .filter((m) => (!channelId || m.channelId === channelId) && m.text.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40)
}

export function postInAppMessage(input: {
  channelId: string
  userId: string
  userName: string
  text: string
}): InAppMessage {
  const text = input.text.trim()
  if (!text) throw new Error('empty_message')
  const msg: InAppMessage = {
    id: crypto.randomUUID(),
    channelId: input.channelId,
    userId: input.userId,
    userName: input.userName,
    text,
    createdAt: new Date().toISOString(),
    readBy: [input.userId],
    reactions: {},
  }
  saveMessages([...loadMessages(), msg])
  const channels = loadChannels().map((c) =>
    c.id === input.channelId ? { ...c, updatedAt: msg.createdAt } : c,
  )
  saveChannels(channels)
  void import('@/lib/notification-center').then(({ pushNotification }) => {
    pushNotification({
      kind: 'message',
      title: `새 메시지 · ${channels.find((c) => c.id === input.channelId)?.title ?? '채널'}`,
      body: `${input.userName}: ${text.slice(0, 120)}`,
      meta: { channelId: input.channelId, messageId: msg.id },
    })
  })
  return msg
}

export function markMessagesRead(channelId: string, userId: string): void {
  let changed = false
  const next = loadMessages().map((m) => {
    if (m.channelId !== channelId || m.readBy.includes(userId)) return m
    changed = true
    return { ...m, readBy: [...m.readBy, userId] }
  })
  if (changed) saveMessages(next)
}

export function toggleMessageReaction(
  messageId: string,
  emoji: string,
  userId: string,
): InAppMessage | null {
  const all = loadMessages()
  const i = all.findIndex((m) => m.id === messageId)
  if (i < 0) return null
  const msg = all[i]!
  const reactions = { ...msg.reactions }
  const users = new Set(reactions[emoji] ?? [])
  if (users.has(userId)) users.delete(userId)
  else users.add(userId)
  if (users.size === 0) delete reactions[emoji]
  else reactions[emoji] = [...users]
  const next = { ...msg, reactions }
  all[i] = next
  saveMessages(all)
  return next
}

export function countUnreadMessages(userId: string, channelId?: string): number {
  return loadMessages().filter(
    (m) =>
      (!channelId || m.channelId === channelId) &&
      m.userId !== userId &&
      !m.readBy.includes(userId),
  ).length
}

export function subscribeMessages(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const h = () => cb()
  window.addEventListener(CHANGE, h)
  window.addEventListener('storage', h)
  return () => {
    window.removeEventListener(CHANGE, h)
    window.removeEventListener('storage', h)
  }
}
