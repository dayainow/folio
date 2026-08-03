'use client'

/**
 * P51 — 플러그인 위젯 React 구현체
 */
import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getFieldValues, subscribeCustomFields } from '@/lib/custom-fields'
import { runInWorkerSandbox } from '@/lib/plugin-sandbox'
import { cn } from '@/lib/utils'

const DEADLINE_KEY = 'folio_plugin_countdown_target'

export function CountdownWidget({ className }: { className?: string }) {
  const [target, setTarget] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(DEADLINE_KEY) ?? ''
  })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const daysLeft = useMemo(() => {
    if (!target) return null
    const t = Date.parse(target)
    if (!Number.isFinite(t)) return null
    return Math.ceil((t - now) / (24 * 60 * 60 * 1000))
  }, [target, now])

  return (
    <div className={cn('space-y-2 rounded-xl border border-border p-3 text-xs', className)}>
      <p className="font-semibold">카운트다운</p>
      <Input
        type="date"
        value={target}
        className="h-8 text-xs"
        onChange={(e) => {
          setTarget(e.target.value)
          try {
            localStorage.setItem(DEADLINE_KEY, e.target.value)
          } catch {
            /* ignore */
          }
        }}
      />
      <p className="tabular-nums text-muted-foreground">
        {daysLeft === null
          ? '목표일을 선택하세요'
          : daysLeft >= 0
            ? `D-${daysLeft}`
            : `${Math.abs(daysLeft)}일 지남`}
      </p>
    </div>
  )
}

export function MoodWidget({ className }: { className?: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const [mood, setMood] = useState(() => {
    const values = getFieldValues('journal', today)
    return typeof values.mood === 'string' ? values.mood : ''
  })

  useEffect(() => {
    return subscribeCustomFields(() => {
      const values = getFieldValues('journal', today)
      setMood(typeof values.mood === 'string' ? values.mood : '')
    })
  }, [today])

  return (
    <div className={cn('rounded-xl border border-border p-3 text-xs', className)}>
      <p className="font-semibold">오늘의 기분</p>
      <p className="mt-1 text-muted-foreground">{mood || '일지에서 기분을 선택하세요'}</p>
    </div>
  )
}

export function SandboxEchoWidget({ className }: { className?: string }) {
  const [input, setInput] = useState('hello folio')
  const [out, setOut] = useState<string>('')
  const [busy, setBusy] = useState(false)

  return (
    <div className={cn('space-y-2 rounded-xl border border-border p-3 text-xs', className)}>
      <p className="font-semibold">Sandbox Echo (Worker)</p>
      <Input
        value={input}
        className="h-8 text-xs"
        onChange={(e) => setInput(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        className="h-7 text-[11px]"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void runInWorkerSandbox(
            'function run(input){ return { echo: String(input), at: Date.now() }; }',
            input,
          ).then((r) => {
            setBusy(false)
            setOut(r.ok ? JSON.stringify(r.result) : `error: ${r.error}`)
          })
        }}
      >
        Worker 실행
      </Button>
      <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px]">{out || '—'}</pre>
    </div>
  )
}

export const PLUGIN_WIDGET_COMPONENTS: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  CountdownWidget,
  MoodWidget,
  SandboxEchoWidget,
}
