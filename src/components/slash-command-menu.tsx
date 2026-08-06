'use client'

/**
 * P64 — 슬래시 명령 메뉴 UI
 */
import { cn } from '@/lib/utils'
import type { SlashCommand } from '@/lib/slash-commands'

export function SlashCommandMenu({
  open,
  items,
  activeIndex,
  onPick,
  onHover,
}: {
  open: boolean
  items: SlashCommand[]
  activeIndex: number
  onPick: (cmd: SlashCommand) => void
  onHover: (index: number) => void
}) {
  if (!open || items.length === 0) return null
  return (
    <ul
      role="listbox"
      className="absolute bottom-full left-0 z-40 mb-1 max-h-56 w-64 overflow-y-auto rounded-xl border bg-background py-1 shadow-lg"
    >
      {items.map((cmd, i) => (
        <li key={cmd.id} role="option" aria-selected={i === activeIndex}>
          <button
            type="button"
            className={cn(
              'flex w-full flex-col items-start px-3 py-1.5 text-left',
              i === activeIndex ? 'bg-muted' : 'hover:bg-muted/70',
            )}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(cmd)
            }}
          >
            <span className="text-xs font-medium">{cmd.label}</span>
            <span className="text-[10px] text-muted-foreground">{cmd.hint}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
