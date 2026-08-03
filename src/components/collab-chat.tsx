'use client'

/**
 * P48 — 문서별 채팅/토론 패널
 */
import { useCallback, useEffect, useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createCollabWsClient, type CollabWsClient } from '@/lib/collab-ws-client'
import { getCollabMode, getCollabWsUrl } from '@/lib/collab-mode'
import type { CollabChatMessage } from '@/lib/collab-protocol'
import { cn } from '@/lib/utils'

export function CollabChatPanel({
  roomId,
  userId,
  userName,
  className,
}: {
  roomId: string
  userId: string
  userName: string
  className?: string
}) {
  const [messages, setMessages] = useState<CollabChatMessage[]>([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState(() =>
    getCollabMode() === 'local' ? 'local — 서버 모드에서 채팅 가능' : 'idle',
  )
  const [client, setClient] = useState<CollabWsClient | null>(null)

  useEffect(() => {
    if (getCollabMode() === 'local') return
    const c = createCollabWsClient({
      roomId,
      clientId: `${userId}-chat`,
      user: { id: userId, name: userName },
      url: getCollabWsUrl(),
      handlers: {
        onChat: (m) => setMessages((prev) => [...prev.slice(-99), m]),
        onStatus: (s) => setStatus(s),
      },
    })
    const handle = window.setTimeout(() => setClient(c), 0)
    return () => {
      window.clearTimeout(handle)
      c.destroy()
    }
  }, [roomId, userId, userName])

  const send = useCallback(() => {
    const t = text.trim()
    if (!t || !client) return
    const message: CollabChatMessage = {
      id: crypto.randomUUID(),
      userId,
      userName,
      text: t,
      ts: new Date().toISOString(),
    }
    client.sendChat(message)
    setMessages((prev) => [...prev, message])
    setText('')
  }, [client, text, userId, userName])

  return (
    <div className={cn('flex h-64 flex-col rounded-xl border border-border', className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-medium">
        <MessageSquare className="h-3.5 w-3.5" />
        토론
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">{status}</span>
      </div>
      <ul className="flex-1 space-y-1.5 overflow-y-auto px-3 py-2 text-[11px]">
        {messages.length === 0 ? (
          <li className="text-muted-foreground">메시지가 없습니다.</li>
        ) : (
          messages.map((m) => (
            <li key={m.id}>
              <span className="font-medium">{m.userName}</span>
              <span className="text-muted-foreground"> · {new Date(m.ts).toLocaleTimeString('ko-KR')}</span>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </li>
          ))
        )}
      </ul>
      <div className="flex gap-1 border-t border-border p-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="메시지…"
          disabled={!client}
        />
        <Button type="button" size="icon" className="h-8 w-8" onClick={send} disabled={!client || !text.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
