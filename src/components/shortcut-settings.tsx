'use client'

/**
 * P64 — 단축키 커스터마이징 · 도움말 목록
 */
import { useEffect, useId, useState } from 'react'
import { Keyboard, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  formatBinding,
  loadShortcutBindings,
  resetShortcutBindings,
  saveShortcutBindings,
  SHORTCUT_DEFS,
  SHORTCUTS_CHANGED_EVENT,
  type KeyBinding,
  type ShortcutId,
} from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

function bindingFromEvent(e: React.KeyboardEvent): KeyBinding | null {
  if (e.key === 'Escape' || e.key === 'Tab') return null
  const key =
    e.key === ' ' ? 'space' : e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()
  if (['shift', 'control', 'meta', 'alt'].includes(key)) return null
  return {
    key,
    mod: e.metaKey || e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
  }
}

export function ShortcutHelpDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const [bindings, setBindings] = useState(loadShortcutBindings)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => setBindings(loadShortcutBindings()), 0)
    return () => window.clearTimeout(t)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4" role="dialog" aria-modal aria-labelledby={titleId}>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="text-sm font-semibold">
            단축키
          </h2>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto text-sm">
          {SHORTCUT_DEFS.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div>
                <p className="text-xs font-medium">{d.label}</p>
                <p className="text-[10px] text-muted-foreground">{d.description}</p>
              </div>
              <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px]">
                {formatBinding(bindings[d.id] ?? d.defaultBinding)}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-muted-foreground">
          설정에서 단축키를 바꿀 수 있습니다. 커맨드 팔레트: ⌘/Ctrl+K
        </p>
      </div>
    </div>
  )
}

export function ShortcutSettingsPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const [bindings, setBindings] = useState(loadShortcutBindings)
  const [listening, setListening] = useState<ShortcutId | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => setBindings(loadShortcutBindings()), 0)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    const onChange = () => setBindings(loadShortcutBindings())
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SHORTCUTS_CHANGED_EVENT, onChange)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby={titleId}>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 id={titleId} className="text-sm font-semibold">
              단축키 설정
            </h2>
            <p className="text-[11px] text-muted-foreground">클릭 후 새 키 조합을 입력하세요</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 overflow-y-auto px-4 py-3">
          {SHORTCUT_DEFS.map((d) => {
            const b = bindings[d.id] ?? d.defaultBinding
            const active = listening === d.id
            return (
              <div key={d.id} className="flex items-center gap-2 rounded-xl border p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{d.label}</p>
                  <p className="text-[10px] text-muted-foreground">{d.description}</p>
                </div>
                <Input
                  readOnly
                  value={active ? '키 입력…' : formatBinding(b)}
                  className={cn('h-8 w-36 cursor-pointer text-center text-[11px]', active && 'ring-2 ring-ring')}
                  onFocus={() => setListening(d.id)}
                  onBlur={() => setListening((cur) => (cur === d.id ? null : cur))}
                  onKeyDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const next = bindingFromEvent(e)
                    if (!next) {
                      if (e.key === 'Escape') setListening(null)
                      return
                    }
                    const map = { ...bindings, [d.id]: next }
                    setBindings(map)
                    saveShortcutBindings(map)
                    setListening(null)
                    setMsg(`${d.label} → ${formatBinding(next)}`)
                  }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => {
              const map = resetShortcutBindings()
              setBindings(map)
              setMsg('기본값으로 복원')
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            기본값
          </Button>
          {msg && <p className="text-[10px] text-muted-foreground">{msg}</p>}
        </div>
      </div>
    </div>
  )
}

export function ShortcutSettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2 text-[11px]"
        onClick={() => setOpen(true)}
      >
        <Keyboard className="size-3.5" aria-hidden />
        단축키
      </Button>
      <ShortcutSettingsPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
