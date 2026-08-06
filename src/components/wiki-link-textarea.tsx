'use client'

/**
 * [[문서명]] 자동완성 + P64 슬래시 명령 textarea
 */
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import {
  detectWikiLinkQuery,
  suggestWikiLinkTitles,
  type DocRef,
} from '@/lib/link-parser'
import {
  applySlashCommand,
  detectSlashQuery,
  filterSlashCommands,
} from '@/lib/slash-commands'
import { SlashCommandMenu } from '@/components/slash-command-menu'

export function WikiLinkTextarea({
  value,
  onChange,
  docs,
  excludeDocId,
  placeholder,
  className,
  rows,
}: {
  value: string
  onChange: (next: string) => void
  docs: DocRef[]
  excludeDocId?: string | null
  placeholder?: string
  className?: string
  rows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [cursor, setCursor] = useState(0)
  const [activeIdx, setActiveIdx] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [slashDismissed, setSlashDismissed] = useState(false)

  const queryInfo = useMemo(() => {
    if (dismissed) return null
    return detectWikiLinkQuery(value, cursor)
  }, [value, cursor, dismissed])

  const slashInfo = useMemo(() => {
    if (slashDismissed || queryInfo) return null
    return detectSlashQuery(value, cursor)
  }, [value, cursor, slashDismissed, queryInfo])

  const suggestions = useMemo(() => {
    if (!queryInfo) return []
    return suggestWikiLinkTitles(docs, queryInfo.query, 8, excludeDocId ?? undefined)
  }, [docs, excludeDocId, queryInfo])

  const slashItems = useMemo(() => {
    if (!slashInfo) return []
    return filterSlashCommands(slashInfo.query)
  }, [slashInfo])

  const syncCursor = useCallback(() => {
    const el = ref.current
    if (!el) return
    setCursor(el.selectionStart ?? 0)
  }, [])

  const applySuggestion = useCallback(
    (title: string) => {
      if (!queryInfo || !ref.current) return
      const el = ref.current
      const before = value.slice(0, queryInfo.start)
      const after = value.slice(cursor)
      const close = after.startsWith(']]') ? '' : ']]'
      const insertion = `[[${title}${close}`
      const next = before + insertion + (close ? after : after.slice(2))
      const newPos = before.length + insertion.length
      onChange(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(newPos, newPos)
        setCursor(newPos)
        setActiveIdx(0)
      })
    },
    [cursor, onChange, queryInfo, value],
  )

  const applySlash = useCallback(
    (cmd: (typeof slashItems)[number]) => {
      if (!slashInfo || !ref.current) return
      const el = ref.current
      const { next, caret } = applySlashCommand(value, cursor, slashInfo.start, cmd)
      onChange(next)
      setSlashDismissed(true)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(caret, caret)
        setCursor(caret)
        setActiveIdx(0)
      })
    },
    [cursor, onChange, slashInfo, value],
  )

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (queryInfo && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const pick = suggestions[activeIdx]
        if (pick) applySuggestion(pick.title)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDismissed(true)
        return
      }
    }

    if (slashInfo && slashItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(slashItems.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const pick = slashItems[activeIdx]
        if (pick) applySlash(pick)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashDismissed(true)
      }
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder ?? '마크다운… `/` 명령 · `[[` 링크'}
        className={className}
        onChange={(e) => {
          onChange(e.target.value)
          setCursor(e.target.selectionStart ?? 0)
          setActiveIdx(0)
          setDismissed(false)
          setSlashDismissed(false)
        }}
        onClick={syncCursor}
        onKeyUp={syncCursor}
        onSelect={syncCursor}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-controls={
          queryInfo ? 'wiki-link-suggestions' : slashInfo ? 'slash-commands' : undefined
        }
        aria-expanded={Boolean(
          (queryInfo && suggestions.length) || (slashInfo && slashItems.length),
        )}
      />
      <SlashCommandMenu
        open={Boolean(slashInfo && slashItems.length)}
        items={slashItems}
        activeIndex={activeIdx}
        onPick={applySlash}
        onHover={setActiveIdx}
      />
      {queryInfo && suggestions.length > 0 && (
        <ul
          id="wiki-link-suggestions"
          role="listbox"
          aria-label="문서 링크 제안"
          className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {suggestions.map((doc, idx) => (
            <li key={doc.id} role="option" aria-selected={idx === activeIdx}>
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs ${
                  idx === activeIdx ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  applySuggestion(doc.title)
                }}
              >
                <span className="truncate font-medium text-gray-800 dark:text-gray-100">{doc.title}</span>
                <span className="shrink-0 text-[10px] text-gray-400">{doc.category}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {queryInfo && suggestions.length === 0 && queryInfo.query.length > 0 && (
        <p className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-gray-100 bg-white px-3 py-2 text-[11px] text-gray-400 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          일치하는 문서 없음 — 새 제목을 직접 입력하세요
        </p>
      )}
    </div>
  )
}
