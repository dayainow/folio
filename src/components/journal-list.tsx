'use client'

/**
 * P58 — 일지 목록 뷰 (시간순 · 미리보기 · 필터 · bulk)
 * P66 — 긴 목록 react-window 가상화 · 행 memo
 */
import { memo, useCallback, useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { Download, Tag, Trash2, FolderInput } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { JournalEntry } from '@/lib/journal'
import { bulkPatchJournalMeta, deleteJournals, getAllTags, loadJournals } from '@/lib/journal'
import {
  bulkMoveJournals,
  createFolder,
  exportJournalsMarkdown,
  loadJournalTree,
} from '@/lib/journal-tree'
import { downloadText } from '@/lib/export'
import { VirtualList } from '@/components/virtual-list'
import { useRenderMark } from '@/lib/render-profiler'

export type JournalListProps = {
  journals: Record<string, JournalEntry>
  selectedDate?: string | null
  folderFilterId?: string | null
  folderDates?: string[] | null
  onSelectDate?: (date: string) => void
  onJournalsChange?: () => void
  className?: string
}

function preview(content: string): string {
  const t = content.replace(/\s+/g, ' ').trim()
  return t.slice(0, 100) + (t.length > 100 ? '…' : '')
}

const JournalRow = memo(function JournalRow({
  date,
  entry,
  selected,
  isActive,
  onToggle,
  onSelect,
}: {
  date: string
  entry: JournalEntry
  selected: boolean
  isActive: boolean
  onToggle: (date: string, e: MouseEvent) => void
  onSelect: (date: string) => void
}) {
  return (
    <div
      className={cn(
        'flex gap-2 px-3 py-2 hover:bg-muted/40',
        isActive && 'bg-primary/5',
      )}
    >
      <input
        type="checkbox"
        className="mt-1 h-3.5 w-3.5"
        checked={selected}
        onChange={() => {}}
        onClick={(e) => onToggle(date, e)}
        aria-label={`${date} 선택`}
      />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(date)}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tabular-nums">{date}</span>
          {(entry.tags ?? []).slice(0, 4).map((t) => (
            <Badge key={t} variant="secondary" className="h-4 px-1 text-[9px]">
              {t}
            </Badge>
          ))}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {preview(entry.content) || '(빈 일지)'}
        </p>
      </button>
    </div>
  )
})

export function JournalList({
  journals,
  selectedDate,
  folderFilterId,
  folderDates,
  onSelectDate,
  onJournalsChange,
  className,
}: JournalListProps) {
  useRenderMark('JournalList')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastClicked, setLastClicked] = useState<string | null>(null)

  const tags = useMemo(() => getAllTags(journals), [journals])

  const rows = useMemo(() => {
    const folderSet = folderDates ? new Set(folderDates) : null
    return Object.entries(journals)
      .filter(([d, e]) => {
        if (!e.content?.trim() && !(e.tags?.length)) return false
        if (folderSet && !folderSet.has(d)) return false
        if (tag && !(e.tags ?? []).includes(tag)) return false
        if (from && d < from) return false
        if (to && d > to) return false
        if (q.trim()) {
          const qq = q.trim().toLowerCase()
          const hay = `${d} ${e.content} ${(e.tags ?? []).join(' ')}`.toLowerCase()
          if (!hay.includes(qq)) return false
        }
        return true
      })
      .sort((a, b) => b[0].localeCompare(a[0]))
  }, [journals, folderDates, tag, from, to, q])

  const dates = rows.map(([d]) => d)

  const toggle = useCallback((date: string, e: MouseEvent) => {
    e.stopPropagation()
    setSelected((prev) => {
      const next = new Set(prev)
      if (e.shiftKey && lastClicked) {
        const a = dates.indexOf(lastClicked)
        const b = dates.indexOf(date)
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a]
          for (let i = lo; i <= hi; i++) next.add(dates[i])
          return next
        }
      }
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
    setLastClicked(date)
  }, [dates, lastClicked])

  const selectDate = useCallback(
    (date: string) => {
      onSelectDate?.(date)
    },
    [onSelectDate],
  )

  const renderRow = useCallback(
    (row: [string, JournalEntry], _index: number, style: CSSProperties) => {
      const [date, entry] = row
      return (
        <div style={style} key={date}>
          <JournalRow
            date={date}
            entry={entry}
            selected={selected.has(date)}
            isActive={selectedDate === date}
            onToggle={toggle}
            onSelect={selectDate}
          />
        </div>
      )
    },
    [selected, selectedDate, toggle, selectDate],
  )

  const selectedList = Array.from(selected)

  const bulkMove = () => {
    if (!selectedList.length) return
    const customs = loadJournalTree().folders.filter((f) => f.kind === 'custom')
    let target = customs[0]
    if (!target) target = createFolder('새 폴더')
    else {
      const name = window.prompt(
        `이동할 폴더 이름:\n${customs.map((f) => f.name).join(', ')}`,
        target.name,
      )
      if (!name) return
      target = customs.find((f) => f.name === name) ?? target
    }
    bulkMoveJournals(selectedList, target.id)
    bulkPatchJournalMeta(selectedList, { folder_id: target.id })
    setSelected(new Set())
    onJournalsChange?.()
  }

  const bulkDelete = () => {
    if (!selectedList.length) return
    if (!window.confirm(`${selectedList.length}개 일지를 삭제할까요?`)) return
    deleteJournals(selectedList)
    setSelected(new Set())
    onJournalsChange?.()
  }

  const bulkTag = () => {
    if (!selectedList.length) return
    const t = window.prompt('추가할 태그')
    if (!t?.trim()) return
    const all = loadJournals()
    for (const d of selectedList) {
      const e = all[d]
      if (!e) continue
      bulkPatchJournalMeta([d], { tags: Array.from(new Set([...(e.tags ?? []), t.trim()])) })
    }
    onJournalsChange?.()
  }

  const bulkExport = () => {
    if (!selectedList.length) return
    downloadText(
      exportJournalsMarkdown(selectedList, journals),
      `journals-${new Date().toISOString().slice(0, 10)}.md`,
    )
  }

  return (
    <Card className={cn('flex flex-col rounded-2xl border border-gray-100 dark:border-gray-800', className)}>
      <div className="space-y-2 border-b border-gray-50 p-3 dark:border-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">일지 목록</h3>
          <span className="text-[10px] text-muted-foreground">{rows.length}건</span>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="검색 (내용·태그·날짜)"
          className="h-8 text-xs"
          aria-label="일지 검색"
        />
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 w-auto text-[11px]" aria-label="시작일" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 w-auto text-[11px]" aria-label="종료일" />
          {(from || to || tag || folderFilterId) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                setFrom('')
                setTo('')
                setTag(null)
              }}
            >
              필터 초기화
            </Button>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 24).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? null : t)}
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px]',
                  tag === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
        {selectedList.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="w-full text-[10px] text-muted-foreground">{selectedList.length}개 선택</span>
            <Button type="button" variant="outline" size="sm" className="h-6 px-1.5 text-[10px]" onClick={bulkMove}>
              <FolderInput className="mr-0.5 h-3 w-3" /> 이동
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-6 px-1.5 text-[10px]" onClick={bulkTag}>
              <Tag className="mr-0.5 h-3 w-3" /> 태그
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-6 px-1.5 text-[10px]" onClick={bulkExport}>
              <Download className="mr-0.5 h-3 w-3" /> 내보내기
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-6 px-1.5 text-[10px] text-destructive" onClick={bulkDelete}>
              <Trash2 className="mr-0.5 h-3 w-3" /> 삭제
            </Button>
          </div>
        )}
      </div>

      <div className="h-[min(28rem,60vh)]">
        <VirtualList
          items={rows}
          height={448}
          itemHeight={64}
          threshold={36}
          getItemKey={([date]) => date}
          renderItem={renderRow}
          empty={
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">일지가 없습니다</p>
          }
        />
      </div>
    </Card>
  )
}
