'use client'

/**
 * P48 — 협업 모드 토글 (local / server / hybrid)
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, Radio, Server, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  COLLAB_MODE_LABELS,
  getCollabBandwidthMode,
  getCollabMode,
  getCollabWsUrl,
  setCollabBandwidthMode,
  setCollabMode,
  setCollabWsUrl,
  subscribeCollabMode,
  type CollabBandwidthMode,
  type CollabMode,
} from '@/lib/collab-mode'
import { useEscapeToClose, useFocusTrap } from '@/lib/a11y'

const MODES: CollabMode[] = ['local', 'server', 'hybrid']

function ModeIcon({ mode, className }: { mode: CollabMode; className?: string }) {
  if (mode === 'server') return <Server className={className} />
  if (mode === 'hybrid') return <Radio className={className} />
  return <Wifi className={className} />
}

export function CollabModeToggle() {
  const [mode, setMode] = useState<CollabMode>(() => getCollabMode())
  const [bandwidth, setBandwidth] = useState<CollabBandwidthMode>(() => getCollabBandwidthMode())
  const [wsUrl, setWsUrl] = useState(() => getCollabWsUrl())
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const close = useCallback(() => setOpen(false), [])

  useEscapeToClose(open, close)
  useFocusTrap(open, rootRef)

  useEffect(() => subscribeCollabMode(setMode), [])

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 rounded-full px-2.5 text-[11px]"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <ModeIcon mode={mode} className="h-3 w-3 opacity-70" />
        <span className="hidden sm:inline">협업 · {COLLAB_MODE_LABELS[mode]}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-1 w-64 rounded-xl border border-border bg-background p-2 shadow-lg"
        >
          <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            협업 모드
          </p>
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={mode === m}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                mode === m ? 'bg-muted font-medium' : 'hover:bg-muted/60'
              }`}
              onClick={() => {
                setCollabMode(m)
                setMode(m)
              }}
            >
              <ModeIcon mode={m} className="h-3.5 w-3.5" />
              <span className="flex-1">{COLLAB_MODE_LABELS[m]}</span>
            </button>
          ))}

          <div className="my-2 border-t border-border" />
          <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            대역폭
          </p>
          <div className="flex gap-1 px-1">
            {(['full', 'saver'] as CollabBandwidthMode[]).map((b) => (
              <Button
                key={b}
                type="button"
                size="sm"
                variant={bandwidth === b ? 'default' : 'outline'}
                className="h-7 flex-1 text-[10px]"
                onClick={() => {
                  setCollabBandwidthMode(b)
                  setBandwidth(b)
                }}
              >
                {b === 'full' ? '전체' : '절약'}
              </Button>
            ))}
          </div>

          {(mode === 'server' || mode === 'hybrid') && (
            <>
              <div className="my-2 border-t border-border" />
              <label className="block px-2 text-[10px] text-muted-foreground">
                WebSocket URL
                <input
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-[11px]"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  onBlur={() => setCollabWsUrl(wsUrl)}
                  placeholder="ws://127.0.0.1:1234"
                />
              </label>
              <p className="mt-1 px-2 text-[10px] text-muted-foreground">
                `npm run collab:server` 후 연결 · 탭 새로고침 권장
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
