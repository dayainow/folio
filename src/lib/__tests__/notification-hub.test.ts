import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearNotifications,
  countUnreadNotifications,
  groupForKind,
  groupNotifications,
  listNotifications,
  markAllNotificationsRead,
  pushNotification,
  pushSaveNotification,
} from '@/lib/notification-center'
import {
  ensureMessageChannel,
  listChannelMessages,
  markMessagesRead,
  postInAppMessage,
  searchMessages,
  toggleMessageReaction,
} from '@/lib/in-app-messaging'
import {
  defaultNotificationPrefs,
  getNotificationPrefs,
  setNotificationPrefs,
  shouldEmailGroup,
} from '@/lib/notification-prefs'
import { buildDigestBody } from '@/lib/email-notify'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 })),
  )
})

describe('notification-center groups', () => {
  it('maps kinds to groups', () => {
    expect(groupForKind('save')).toBe('save')
    expect(groupForKind('mention')).toBe('collab')
    expect(groupForKind('share')).toBe('collab')
    expect(groupForKind('gate')).toBe('gate')
    expect(groupForKind('invite')).toBe('invite')
    expect(groupForKind('system')).toBe('system')
  })

  it('filters unread and groups', () => {
    pushSaveNotification('saved', 'ok')
    pushNotification({ kind: 'gate', title: 'Gate', body: 'P1' })
    expect(countUnreadNotifications()).toBe(2)
    expect(listNotifications(10, { group: 'save' })).toHaveLength(1)
    expect(listNotifications(10, { unreadOnly: true })).toHaveLength(2)
    markAllNotificationsRead('save')
    expect(countUnreadNotifications('save')).toBe(0)
    expect(countUnreadNotifications('gate')).toBe(1)
    const grouped = groupNotifications(listNotifications(20))
    expect(grouped.gate).toHaveLength(1)
    clearNotifications()
    expect(listNotifications()).toHaveLength(0)
  })
})

describe('in-app messaging', () => {
  it('posts, reacts, reads, searches', () => {
    const ch = ensureMessageChannel({ kind: 'doc', title: 'Spec', refId: 'doc-1' })
    const msg = postInAppMessage({
      channelId: ch.id,
      userId: 'u1',
      userName: 'Ada',
      text: 'hello folio channel',
    })
    expect(listChannelMessages(ch.id)).toHaveLength(1)
    toggleMessageReaction(msg.id, '👍', 'u2')
    const again = listChannelMessages(ch.id)[0]!
    expect(again.reactions['👍']).toContain('u2')
    markMessagesRead(ch.id, 'u2')
    expect(listChannelMessages(ch.id)[0]!.readBy).toContain('u2')
    expect(searchMessages('folio')).toHaveLength(1)
  })
})

describe('notification prefs + digest body', () => {
  it('stores group subscriptions', () => {
    const d = defaultNotificationPrefs()
    expect(d.digest).toBe('daily')
    setNotificationPrefs({
      email: 'a@b.co',
      groups: { ...d.groups, save: { inApp: true, email: true, push: false } },
    })
    expect(getNotificationPrefs().email).toBe('a@b.co')
    expect(shouldEmailGroup('save')).toBe(true)
  })

  it('builds digest body', () => {
    pushNotification({ kind: 'system', title: 'Hello', body: 'World' })
    const { text, html } = buildDigestBody(listNotifications(5))
    expect(text).toContain('Hello')
    expect(html).toContain('<ul>')
  })
})
