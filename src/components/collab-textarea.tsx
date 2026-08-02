'use client'

/**
 * Yjs 바인딩 Textarea — 동시 편집 + 선택 영역 Presence 공유(optional)
 */
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { createCollabSession, type CollabSession } from '@/lib/collab-yjs'
import { getOrCreateGuestId, joinPresenceRoom, presenceColorFor } from '@/lib/presence'
import { cn } from '@/lib/utils'

export type CollabTextareaProps = {
  roomId: string
  value: string
  onChange: (value: string) => void
  user?: { id: string; name: string; email?: string | null } | null
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  /** Presence 커서 공유 */
  shareSelection?: boolean
  'aria-describedby'?: string
}

export function CollabTextarea({
  roomId,
  value,
  onChange,
  user,
  placeholder,
  className,
  id,
  disabled,
  shareSelection = true,
  'aria-describedby': ariaDescribedBy,
}: CollabTextareaProps) {
  const sessionRef = useRef<CollabSession | null>(null)
  const applyingRemote = useRef(false)
  const valueRef = useRef(value)
  const [syncLabel, setSyncLabel] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const presenceRef = useRef<ReturnType<typeof joinPresenceRoom> | null>(null)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    const userId = user?.id ?? getOrCreateGuestId()
    const userName = user?.name || user?.email?.split('@')[0] || '편집자'
    const session = createCollabSession({
      roomId,
      userId,
      userName,
      color: presenceColorFor(userId),
      initialText: valueRef.current,
    })
    sessionRef.current = session
    setSyncLabel(session.transport)

    const unsub = session.observeText((text, origin) => {
      if (origin === 'remote') {
        applyingRemote.current = true
        onChange(text)
        queueMicrotask(() => {
          applyingRemote.current = false
        })
      }
    })

    if (shareSelection) {
      presenceRef.current = joinPresenceRoom({
        roomId: `sel:${roomId}`,
        self: { userId, name: userName, email: user?.email },
        onPeers: () => undefined,
      })
    }

    return () => {
      unsub()
      session.destroy()
      sessionRef.current = null
      presenceRef.current?.leave()
      presenceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id, user?.name, user?.email, shareSelection])

  useEffect(() => {
    if (applyingRemote.current) return
    sessionRef.current?.setText(value)
  }, [value])

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const pushSelection = () => {
    if (!shareSelection || !taRef.current || !presenceRef.current) return
    const el = taRef.current
    presenceRef.current.updateMeta({
      cursor: { anchor: el.selectionStart, head: el.selectionEnd },
    })
  }

  return (
    <div className="relative">
      <Textarea
        ref={taRef}
        id={id}
        value={value}
        onChange={handleChange}
        onSelect={pushSelection}
        onKeyUp={pushSelection}
        onClick={pushSelection}
        onBlur={() => presenceRef.current?.updateMeta({ cursor: null })}
        placeholder={placeholder}
        className={cn(className)}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        enterKeyHint="enter"
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
      />
      {syncLabel ? (
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-background/80 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
          collab:{syncLabel}
        </span>
      ) : null}
    </div>
  )
}
