'use client'

/**
 * P59 — 문서 버전 이력 사이드바 / 드롭다운 연동
 */
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  createManualDocVersion,
  listDocVersions,
  subscribeDocVersions,
  type DocVersion,
} from '@/lib/doc-versions'
import type { DocEntry } from '@/lib/docs'
import { History, Plus, GitCompare } from 'lucide-react'

const KIND_LABEL: Record<DocVersion['kind'], string> = {
  auto: '자동',
  manual: '수동',
  important: '중요',
  checkpoint: '체크포인트',
}

export function DocVersionsPanel({
  doc,
  currentContent,
  currentTitle,
  onSelectVersion,
  onCompare,
  onRestore,
  className,
}: {
  doc: DocEntry
  currentContent: string
  currentTitle: string
  onSelectVersion?: (v: DocVersion) => void
  onCompare?: (v: DocVersion) => void
  onRestore?: (v: DocVersion) => void
  className?: string
}) {
  const [tick, setTick] = useState(0)
  const [note, setNote] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => subscribeDocVersions(() => setTick((t) => t + 1)), [])

  const versions = useMemo(() => {
    void tick
    return listDocVersions(doc.id)
  }, [doc.id, tick])

  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null

  const createManual = () => {
    const snap = createManualDocVersion(
      {
        ...doc,
        title: currentTitle,
        content: currentContent,
      },
      note.trim() || undefined,
    )
    setNote('')
    if (snap) setSelectedId(snap.id)
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-[12rem] flex-col rounded-xl border border-gray-100 bg-card dark:border-gray-800',
        className,
      )}
      role="region"
      aria-label="문서 버전 이력"
    >
      <div className="flex items-center justify-between gap-1 border-b border-gray-50 px-2 py-1.5 dark:border-gray-800">
        <span className="inline-flex items-center gap-1 text-xs font-semibold">
          <History className="h-3.5 w-3.5" /> 버전 이력
        </span>
        <Badge variant="secondary" className="h-5 text-[10px]">
          {versions.length}
        </Badge>
      </div>

      <div className="space-y-1.5 border-b border-gray-50 px-2 py-1.5 dark:border-gray-800">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모/태그 (수동 버전)"
          className="h-7 text-xs"
        />
        <Button type="button" size="sm" variant="outline" className="h-7 w-full gap-1 text-[11px]" onClick={createManual}>
          <Plus className="h-3 w-3" /> 수동 버전 만들기
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-1 py-1">
        {versions.length === 0 ? (
          <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            저장하면 버전이 쌓입니다.
          </p>
        ) : (
          <ul className="space-y-0.5 pb-2">
            {versions.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/60',
                    selected?.id === v.id && 'bg-muted',
                  )}
                  onClick={() => {
                    setSelectedId(v.id)
                    onSelectVersion?.(v)
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium tabular-nums">{v.label}</span>
                    <Badge variant="outline" className="h-4 px-1 text-[9px]">
                      {KIND_LABEL[v.kind]}
                    </Badge>
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {v.note || v.changeSummary || v.title}
                  </p>
                  <p className="text-[9px] tabular-nums text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      {selected && (
        <div className="flex flex-wrap gap-1 border-t border-gray-50 p-2 dark:border-gray-800">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[10px]"
            onClick={() => onCompare?.(selected)}
          >
            <GitCompare className="h-3 w-3" /> 현재와 비교
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={() => onRestore?.(selected)}
          >
            복원
          </Button>
        </div>
      )}
    </div>
  )
}

/** 헤더용 버전 드롭다운 */
export function DocVersionSelect({
  docId,
  onPick,
  className,
}: {
  docId: string
  onPick: (v: DocVersion) => void
  className?: string
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => subscribeDocVersions(() => setTick((t) => t + 1)), [])
  const versions = useMemo(() => {
    void tick
    return listDocVersions(docId)
  }, [docId, tick])
  const latest = versions[0]

  return (
    <select
      className={cn(
        'h-8 max-w-[7.5rem] truncate rounded-lg border border-gray-200 bg-white px-1.5 text-[11px] dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
      aria-label="문서 버전"
      defaultValue=""
      key={latest?.id ?? 'empty'}
      onChange={(e) => {
        const id = e.target.value
        if (!id) return
        const v = versions.find((x) => x.id === id)
        if (v) onPick(v)
        e.target.value = ''
      }}
    >
      <option value="" disabled>
        {latest ? latest.label : '버전'}
      </option>
      {versions.map((v) => (
        <option key={v.id} value={v.id}>
          {v.label}
          {v.note ? ` · ${v.note}` : ''}
        </option>
      ))}
    </select>
  )
}
