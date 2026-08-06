'use client'

/**
 * P64 — 커맨드 팔레트 (Cmd/Ctrl+K)
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Command, CornerDownLeft, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  buildCommands,
  CATEGORY_LABELS,
  commandShortcutHint,
  filterCommands,
  loadRecentCommandIds,
  pushRecentCommand,
  type CommandDef,
  type CommandHandlers,
} from '@/lib/command-registry'

export function CommandPalette({
  open,
  onClose,
  handlers,
}: {
  open: boolean
  onClose: () => void
  handlers: CommandHandlers
}) {
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recentIds, setRecentIds] = useState<string[]>([])

  const all = useMemo(() => buildCommands(handlers), [handlers])

  const filtered = useMemo(() => {
    const base = filterCommands(all, query)
    if (query.trim()) return base
    const recent = recentIds
      .map((id) => all.find((c) => c.id === id))
      .filter(Boolean) as CommandDef[]
    const rest = base.filter((c) => !recentIds.includes(c.id))
    return [...recent, ...rest]
  }, [all, query, recentIds])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      setQuery('')
      setActive(0)
      setRecentIds(loadRecentCommandIds())
      inputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  const run = useCallback(
    (cmd: CommandDef) => {
      pushRecentCommand(cmd.id)
      onClose()
      // close first so focus/modals don't fight
      window.setTimeout(() => cmd.run(), 0)
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-3 pt-[12vh] sm:pt-[15vh]"
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
    >
      <button type="button" className="absolute inset-0" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(filtered.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const cmd = filtered[active]
                if (cmd) run(cmd)
              }
            }}
            placeholder="명령 검색… (일지 작성, 문서, 설정)"
            className="h-9 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            aria-labelledby={titleId}
            aria-autocomplete="list"
            aria-controls={`${titleId}-list`}
          />
          <kbd className="hidden rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            esc
          </kbd>
        </div>
        <p id={titleId} className="sr-only">
          커맨드 팔레트
        </p>
        <ul
          id={`${titleId}-list`}
          role="listbox"
          className="max-h-[min(22rem,50vh)] overflow-y-auto py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">결과 없음</li>
          ) : (
            filtered.map((cmd, i) => {
              const hint = commandShortcutHint(cmd)
              const isRecent = !query.trim() && recentIds.includes(cmd.id)
              return (
                <li key={cmd.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                      i === active ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(cmd)}
                  >
                    <Command className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{cmd.title}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {isRecent ? '최근' : CATEGORY_LABELS[cmd.category]}
                    </span>
                    {hint ? (
                      <kbd className="shrink-0 rounded border px-1 py-0.5 text-[10px] text-muted-foreground">
                        {hint}
                      </kbd>
                    ) : (
                      <CornerDownLeft className="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden />
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
