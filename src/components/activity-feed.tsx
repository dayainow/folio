'use client'

/**
 * P41 — 활동 스트림 피드 (사용자/문서/시간 필터)
 */
import { useEffect, useState } from 'react'
import {
  listActivity,
  subscribeActivity,
  type ActivityEvent,
  type ActivityType,
} from '@/lib/activity-stream'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<ActivityType, string> = {
  save: '저장',
  edit: '편집',
  comment: '주석',
  task_done: '완료',
  presence: '접속',
  other: '기타',
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function applyFilters(
  events: ActivityEvent[],
  actor: string,
  target: string,
  sinceCutoff: string | undefined,
  limit: number,
): ActivityEvent[] {
  const q = actor.trim().toLowerCase()
  const tid = target.trim()
  return events
    .filter((e) => {
      if (sinceCutoff && e.createdAt < sinceCutoff) return false
      if (tid && e.targetId !== tid) return false
      if (!q) return true
      return e.actorId.toLowerCase().includes(q) || e.actorName.toLowerCase().includes(q)
    })
    .slice(0, limit)
}

export function ActivityFeed({
  className,
  limit = 50,
  compact = false,
}: {
  className?: string
  limit?: number
  compact?: boolean
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [actor, setActor] = useState('')
  const [target, setTarget] = useState('')
  const [hours, setHours] = useState<'all' | '1' | '24' | '168'>('24')
  const [sinceCutoff, setSinceCutoff] = useState<string | undefined>(() =>
    new Date(Date.now() - 24 * 3600_000).toISOString(),
  )

  useEffect(() => subscribeActivity(setEvents), [])

  const source = events.length > 0 ? events : listActivity({ limit: 80 })
  const filtered = applyFilters(source, actor, target, sinceCutoff, limit)

  const selectHours = (v: 'all' | '1' | '24' | '168') => {
    setHours(v)
    if (v === 'all') {
      setSinceCutoff(undefined)
      return
    }
    // 클릭 시점 기준 시간창 (이벤트 핸들러)
    // eslint-disable-next-line react-hooks/purity -- user gesture wall-clock
    const cutoff = Date.now() - Number(v) * 3600_000
    setSinceCutoff(new Date(cutoff).toISOString())
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {!compact ? (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          활동 스트림
        </h3>
      ) : (
        <div className="text-xs font-semibold">활동 스트림</div>
      )}

      {!compact ? (
        <div className="grid grid-cols-1 gap-2">
          <Input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="사용자 필터"
            className="h-8 text-xs"
          />
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="문서/일지 ID 필터"
            className="h-8 text-xs"
          />
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['1', '1시간'],
                ['24', '24시간'],
                ['168', '7일'],
                ['all', '전체'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px]',
                  hours === v
                    ? 'border-foreground/30 bg-foreground/5 font-medium'
                    : 'border-transparent text-muted-foreground hover:bg-muted/50',
                )}
                onClick={() => selectHours(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['24', '24h'],
              ['168', '7d'],
              ['all', '전체'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px]',
                hours === v
                  ? 'border-foreground/30 bg-foreground/5 font-medium'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50',
              )}
              onClick={() => selectHours(v)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <ul
        className={cn(
          'flex flex-col gap-2 overflow-y-auto',
          compact ? 'max-h-48' : 'max-h-[45vh]',
        )}
      >
        {filtered.length === 0 ? (
          <li className="text-xs text-muted-foreground">활동이 없습니다.</li>
        ) : (
          filtered.map((e) => (
            <li key={e.id} className="rounded-md border border-border/50 px-2.5 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                  {TYPE_LABEL[e.type] ?? e.type}
                </span>
                <time className="text-[10px] text-muted-foreground" dateTime={e.createdAt}>
                  {formatTime(e.createdAt)}
                </time>
              </div>
              <p className="mt-0.5 text-[13px] leading-snug">
                <span className="font-medium">{e.actorName}</span>
                <span className="text-muted-foreground"> — {e.summary}</span>
              </p>
              {!compact && (e.targetKind || e.targetId) ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {e.targetKind}
                  {e.targetId ? ` · ${e.targetId}` : ''}
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
