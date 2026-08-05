/**
 * P56 — 태스크 시간 추적 (시작/중지/완료 · 집계)
 */
'use client'

import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'

export type TimeEntry = {
  id: string
  taskId: string
  startedAt: string
  endedAt?: string
  durationMs: number
}

type Store = {
  entries: TimeEntry[]
  activeTaskId: string | null
  activeStartedAt: string | null
}

const STORAGE_KEY = 'folio_time_tracking_v1'

function empty(): Store {
  return { entries: [], activeTaskId: null, activeStartedAt: null }
}

export function loadTimeStore(): Store {
  const raw = getLocalJson<Store | null>(STORAGE_KEY, null)
  if (!raw || !Array.isArray(raw.entries)) return empty()
  return {
    entries: raw.entries,
    activeTaskId: raw.activeTaskId ?? null,
    activeStartedAt: raw.activeStartedAt ?? null,
  }
}

function save(store: Store) {
  setLocalJson(STORAGE_KEY, store)
  flushLocalJson(STORAGE_KEY)
}

function nowIso() {
  return new Date().toISOString()
}

/** 다른 타이머가 돌면 자동 정지 후 시작 */
export function startTimer(taskId: string): Store {
  let store = loadTimeStore()
  if (store.activeTaskId && store.activeStartedAt) {
    store = stopTimer(store.activeTaskId)
  }
  store = {
    ...store,
    activeTaskId: taskId,
    activeStartedAt: nowIso(),
  }
  save(store)
  return store
}

export function stopTimer(taskId?: string): Store {
  const store = loadTimeStore()
  const id = taskId ?? store.activeTaskId
  if (!id || store.activeTaskId !== id || !store.activeStartedAt) {
    return store
  }
  const started = new Date(store.activeStartedAt).getTime()
  const ended = Date.now()
  const durationMs = Math.max(0, ended - started)
  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    taskId: id,
    startedAt: store.activeStartedAt,
    endedAt: nowIso(),
    durationMs,
  }
  const next: Store = {
    entries: [...store.entries, entry],
    activeTaskId: null,
    activeStartedAt: null,
  }
  save(next)
  return next
}

/** 완료 = 정지 + (선택) done 처리는 UI에서 */
export function completeTimer(taskId: string): Store {
  return stopTimer(taskId)
}

export function getActiveElapsedMs(store?: Store, now = Date.now()): number {
  const s = store ?? loadTimeStore()
  if (!s.activeStartedAt) return 0
  return Math.max(0, now - new Date(s.activeStartedAt).getTime())
}

export function getTaskTotalMs(taskId: string, store?: Store, now = Date.now()): number {
  const s = store ?? loadTimeStore()
  const closed = s.entries
    .filter((e) => e.taskId === taskId)
    .reduce((sum, e) => sum + e.durationMs, 0)
  const live =
    s.activeTaskId === taskId && s.activeStartedAt ? getActiveElapsedMs(s, now) : 0
  return closed + live
}

export type Period = 'day' | 'week' | 'month'

function startOfPeriod(period: Period, ref = new Date()): Date {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  if (period === 'week') {
    const day = d.getDay()
    const diff = (day + 6) % 7 // Monday start
    d.setDate(d.getDate() - diff)
  } else if (period === 'month') {
    d.setDate(1)
  }
  return d
}

/** 기간 내 완료 세션 합계 (+ 활성 세션이 기간에 포함되면 live) */
export function aggregateMs(period: Period, store?: Store, now = Date.now()): number {
  const s = store ?? loadTimeStore()
  const from = startOfPeriod(period, new Date(now)).getTime()
  let total = 0
  for (const e of s.entries) {
    const t = new Date(e.startedAt).getTime()
    if (t >= from) total += e.durationMs
  }
  if (s.activeStartedAt) {
    const t = new Date(s.activeStartedAt).getTime()
    if (t >= from) total += getActiveElapsedMs(s, now)
  }
  return total
}

export function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function isTimerRunning(taskId: string, store?: Store): boolean {
  const s = store ?? loadTimeStore()
  return s.activeTaskId === taskId && Boolean(s.activeStartedAt)
}
