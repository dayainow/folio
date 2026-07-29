'use client'

import { useMemo } from 'react'
import {
  diffBeaconProject,
  diffBeaconTimeline,
  type FieldDiff,
  type FolioBeaconSnapshot,
  type TimelineDiffItem,
  type TimelineItem,
} from '@/lib/beacon'
import { cn } from '@/lib/utils'

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function kindTone(kind: FieldDiff['kind'] | TimelineDiffItem['kind']): string {
  switch (kind) {
    case 'added':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
    case 'removed':
      return 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
    case 'modified':
      return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
    default:
      return 'border-gray-100 bg-gray-50 text-muted-foreground dark:border-gray-800 dark:bg-gray-900'
  }
}

function kindLabel(kind: FieldDiff['kind'] | TimelineDiffItem['kind']): string {
  switch (kind) {
    case 'added':
      return '추가'
    case 'removed':
      return '삭제'
    case 'modified':
      return '수정'
    default:
      return '동일'
  }
}

function ProjectFieldDiffs({ diffs }: { diffs: FieldDiff[] }) {
  const meaningful = diffs.filter((d) => d.kind !== 'unchanged')
  if (meaningful.length === 0) {
    return (
      <p className="text-[12px] text-muted-foreground py-2">project.json 변경 없음</p>
    )
  }
  return (
    <ul className="space-y-1.5">
      {meaningful.map((d) => (
        <li
          key={d.field}
          className={cn('rounded-lg border px-2.5 py-2 text-[12px]', kindTone(d.kind))}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{d.field}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {kindLabel(d.kind)}
            </span>
          </div>
          <div className="mt-1 grid gap-0.5 font-mono text-[11px] opacity-90">
            {d.before != null && (
              <span className={d.kind === 'removed' || d.kind === 'modified' ? 'line-through opacity-70' : ''}>
                − {d.before}
              </span>
            )}
            {d.after != null && <span>+ {d.after}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function TimelineDiffList({ items }: { items: TimelineDiffItem[] }) {
  if (items.length === 0) {
    return <p className="text-[12px] text-muted-foreground py-2">Timeline 변경 없음</p>
  }

  const renderItem = (item?: TimelineItem) => {
    if (!item) return null
    return (
      <div className="min-w-0">
        <div className="font-medium leading-snug">{item.title}</div>
        {item.detail && (
          <p className="mt-0.5 text-[11px] opacity-80 line-clamp-2">{item.detail}</p>
        )}
        <p className="mt-0.5 text-[10px] opacity-70">{formatWhen(item.occurredAt)}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      {items.map((d) => (
        <li
          key={`${d.kind}-${d.id}`}
          className={cn('rounded-lg border px-2.5 py-2 text-[12px]', kindTone(d.kind))}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {kindLabel(d.kind)}
            </span>
            <span className="truncate font-mono text-[10px] opacity-70">{d.id}</span>
          </div>
          {d.kind === 'modified' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="opacity-70">{renderItem(d.before)}</div>
              <div>{renderItem(d.after)}</div>
            </div>
          ) : d.kind === 'removed' ? (
            renderItem(d.before)
          ) : (
            renderItem(d.after)
          )}
        </li>
      ))}
    </ul>
  )
}

export function BeaconDiffView({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: FolioBeaconSnapshot | null
  after: FolioBeaconSnapshot | null
  beforeLabel?: string
  afterLabel?: string
}) {
  const projectDiffs = useMemo(
    () => diffBeaconProject(before?.project ?? null, after?.project ?? null),
    [before, after],
  )
  const timelineDiffs = useMemo(
    () => diffBeaconTimeline(before?.timeline ?? [], after?.timeline ?? []),
    [before, after],
  )

  if (!before && !after) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        비교할 스냅샷을 선택하세요.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="rounded-md border border-gray-200 px-2 py-0.5 dark:border-gray-700">
          {beforeLabel ?? before?.id ?? '이전'}
        </span>
        <span aria-hidden>→</span>
        <span className="rounded-md border border-gray-200 px-2 py-0.5 dark:border-gray-700">
          {afterLabel ?? after?.id ?? '이후'}
        </span>
      </div>

      <div>
        <h4 className="text-xs font-semibold tracking-tight mb-2">project.json</h4>
        <ProjectFieldDiffs diffs={projectDiffs} />
      </div>

      <div>
        <h4 className="text-xs font-semibold tracking-tight mb-2">
          Timeline 이력
          {timelineDiffs.length > 0 ? (
            <span className="ml-1.5 font-normal text-muted-foreground">
              ({timelineDiffs.length}건)
            </span>
          ) : null}
        </h4>
        <TimelineDiffList items={timelineDiffs} />
      </div>

      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className={cn('rounded-md border px-2 py-0.5', kindTone('added'))}>추가</span>
        <span className={cn('rounded-md border px-2 py-0.5', kindTone('modified'))}>수정</span>
        <span className={cn('rounded-md border px-2 py-0.5', kindTone('removed'))}>삭제</span>
      </div>
    </div>
  )
}
