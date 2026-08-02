'use client'

/**
 * P43 — Yjs 바인딩 textarea
 * · 원격 커서 오버레이 (옵션)
 * · 타이핑 표시
 * · Undo/Redo · 이력 스냅샷
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createCollabSession, type CollabSession } from '@/lib/collab-yjs'
import {
  getOrCreateGuestId,
  joinPresenceRoom,
  presenceColorFor,
  type PresenceUser,
} from '@/lib/presence'
import { pushCollabSnapshot } from '@/lib/collab-history'
import { CollabHistoryPanel } from '@/components/collab-history-panel'
import { cn } from '@/lib/utils'
import { Redo2, Undo2, History } from 'lucide-react'

export type CollabTextareaProps = {
  roomId: string
  value: string
  onChange: (value: string) => void
  user?: { id: string; name: string; email?: string | null } | null
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  shareSelection?: boolean
  'aria-describedby'?: string
}

function caretMetrics(ta: HTMLTextAreaElement, index: number): { top: number; left: number } {
  const style = window.getComputedStyle(ta)
  const div = document.createElement('div')
  const props = [
    'boxSizing',
    'width',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'fontFamily',
    'lineHeight',
    'letterSpacing',
    'textTransform',
    'wordSpacing',
    'textIndent',
    'whiteSpace',
    'wordBreak',
    'overflowWrap',
  ] as const
  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.wordWrap = 'break-word'
  div.style.overflow = 'hidden'
  for (const p of props) {
    const css = p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
    div.style.setProperty(css, style.getPropertyValue(css))
  }
  div.style.width = `${ta.clientWidth}px`
  div.textContent = ta.value.slice(0, index)
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  div.appendChild(marker)
  document.body.appendChild(div)
  const top = marker.offsetTop - ta.scrollTop
  const left = marker.offsetLeft - ta.scrollLeft
  document.body.removeChild(div)
  return { top, left }
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
  const [peers, setPeers] = useState<PresenceUser[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [cursorOverlays, setCursorOverlays] = useState<
    Array<{ peer: PresenceUser; top: number; left: number }>
  >([])
  const typingTimer = useRef<number | null>(null)

  const refreshUndoState = useCallback(() => {
    const s = sessionRef.current
    setCanUndo(Boolean(s?.canUndo()))
    setCanRedo(Boolean(s?.canRedo()))
  }, [])

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
    pushCollabSnapshot({
      roomId,
      text: valueRef.current,
      label: '세션 시작',
      actorName: userName,
    })
    refreshUndoState()

    const unsub = session.observeText((text, origin) => {
      if (origin === 'remote') {
        applyingRemote.current = true
        onChange(text)
        queueMicrotask(() => {
          applyingRemote.current = false
        })
      }
      refreshUndoState()
    })

    if (shareSelection) {
      presenceRef.current = joinPresenceRoom({
        roomId: `sel:${roomId}`,
        self: { userId, name: userName, email: user?.email },
        onPeers: (next) => setPeers(next),
      })
    }

    return () => {
      unsub()
      session.destroy()
      sessionRef.current = null
      presenceRef.current?.leave()
      presenceRef.current = null
      if (typingTimer.current) window.clearTimeout(typingTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id, user?.name, user?.email, shareSelection, refreshUndoState])

  useEffect(() => {
    if (applyingRemote.current) return
    sessionRef.current?.setText(value)
    refreshUndoState()
  }, [value, refreshUndoState])

  useEffect(() => {
    if (!shareSelection || !taRef.current) {
      setCursorOverlays([])
      return
    }
    const ta = taRef.current
    const next: Array<{ peer: PresenceUser; top: number; left: number }> = []
    for (const p of peers) {
      if (!p.cursor || typeof p.cursor.anchor !== 'number') continue
      const idx = Math.min(p.cursor.anchor, value.length)
      try {
        const pos = caretMetrics(ta, idx)
        next.push({ peer: p, top: pos.top, left: pos.left })
      } catch {
        /* ignore */
      }
    }
    setCursorOverlays(next)
  }, [peers, value, shareSelection])

  const markTyping = useCallback(() => {
    presenceRef.current?.updateMeta({ typing: true })
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => {
      presenceRef.current?.updateMeta({ typing: false })
    }, 1200)
  }, [])

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    markTyping()
    onChange(e.target.value)
  }

  const pushSelection = () => {
    if (!shareSelection || !taRef.current || !presenceRef.current) return
    const el = taRef.current
    presenceRef.current.updateMeta({
      cursor: { anchor: el.selectionStart, head: el.selectionEnd },
    })
  }

  const applyUndo = () => {
    const s = sessionRef.current
    if (!s?.canUndo()) return
    s.undo()
    applyingRemote.current = true
    onChange(s.getText())
    queueMicrotask(() => {
      applyingRemote.current = false
    })
    refreshUndoState()
  }

  const applyRedo = () => {
    const s = sessionRef.current
    if (!s?.canRedo()) return
    s.redo()
    applyingRemote.current = true
    onChange(s.getText())
    queueMicrotask(() => {
      applyingRemote.current = false
    })
    refreshUndoState()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault()
      applyUndo()
    } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault()
      applyRedo()
    }
  }

  const restoreSnapshot = (text: string) => {
    onChange(text)
    pushCollabSnapshot({
      roomId,
      text,
      label: '이력 복원',
      actorName: user?.name || user?.email?.split('@')[0] || '편집자',
    })
    setShowHistory(false)
  }

  const typingPeers = peers.filter((p) => p.typing)

  return (
    <div className="relative space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          disabled={disabled || !canUndo}
          onClick={applyUndo}
          aria-label="되돌리기"
          title="Ctrl/⌘+Z"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          disabled={disabled || !canRedo}
          onClick={applyRedo}
          aria-label="다시 실행"
          title="Ctrl/⌘+Shift+Z"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-[11px]"
          onClick={() => {
            pushCollabSnapshot({
              roomId,
              text: value,
              label: '수동 스냅샷',
              actorName: user?.name || undefined,
            })
            setShowHistory((v) => !v)
          }}
          aria-pressed={showHistory}
        >
          <History className="h-3.5 w-3.5" />
          이력
        </Button>
        {typingPeers.length > 0 && (
          <span className="ml-1 text-[10px] text-muted-foreground" aria-live="polite">
            {typingPeers.map((p) => p.name).join(', ')} 입력 중…
          </span>
        )}
      </div>

      <div className="relative">
        <Textarea
          ref={taRef}
          id={id}
          value={value}
          onChange={handleChange}
          onSelect={pushSelection}
          onKeyUp={pushSelection}
          onKeyDown={onKeyDown}
          onClick={pushSelection}
          onBlur={() => presenceRef.current?.updateMeta({ cursor: null, typing: false })}
          placeholder={placeholder}
          className={cn(className)}
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
          enterKeyHint="enter"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
        />
        {cursorOverlays.map((item) => (
          <span
            key={item.peer.userId}
            className="pointer-events-none absolute z-10 -translate-x-1/2"
            style={{ top: item.top, left: item.left }}
            title={`${item.peer.name} 커서`}
          >
            <span
              className="block h-4 w-0.5 animate-pulse rounded-full"
              style={{ backgroundColor: item.peer.color }}
            />
            <span
              className="mt-0.5 block max-w-[5rem] truncate rounded px-1 text-[9px] font-medium text-white"
              style={{ backgroundColor: item.peer.color }}
            >
              {item.peer.name}
            </span>
          </span>
        ))}
        {syncLabel ? (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-background/80 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
            collab:{syncLabel}
          </span>
        ) : null}
      </div>

      {showHistory && (
        <CollabHistoryPanel
          roomId={roomId}
          currentText={value}
          onRestore={restoreSnapshot}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
