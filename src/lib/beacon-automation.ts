'use client'

/**
 * P24 — Beacon 자동화 설정 · Gate/산출물 · Timeline 분석
 */
import type {
  ArtifactItem,
  BeaconProjectJson,
  GateStatus,
  ProcessStageId,
  StageSummary,
  TimelineItem,
} from '@/lib/beacon'

const AUTO_DETECT_KEY = 'folio_beacon_auto_detect'
const AUTO_ARTIFACT_KEY = 'folio_beacon_auto_artifact'
const AUTO_DETECT_EVENT = 'folio-beacon-auto-detect'
const BEACON_CHANGE_EVENT = 'folio-beacon-change'

export type BeaconChangeDetail = {
  message: string
  at: string
}

export type TimelineAnalytics = {
  weekCount: number
  monthCount: number
  byDay: Array<{ date: string; count: number }>
  bySource: Array<{ source: string; count: number }>
  byCategory: Array<{ category: string; count: number }>
}

export type ArtifactCompletion = {
  total: number
  done: number
  percent: number
}

export type GateAutomationResult = {
  stages: StageSummary[]
  autoPassed: ProcessStageId[]
  warnings: string[]
}

function kindToStage(kind: string): ProcessStageId | null {
  const k = kind.toLowerCase()
  if (k.includes('plan') || k.includes('기획')) return 'p0'
  if (k.includes('design') || k.includes('설계')) return 'p1'
  if (k.includes('verif') || k.includes('test') || k.includes('qa') || k.includes('검증')) return 'p3'
  if (k.includes('release') || k.includes('deploy') || k.includes('배포')) return 'p4'
  if (k.includes('doc') || k.includes('note') || k.includes('dev')) return 'p2'
  return 'p2'
}

export function getBeaconAutoDetect(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(AUTO_DETECT_KEY)
    if (raw == null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function setBeaconAutoDetect(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUTO_DETECT_KEY, enabled ? '1' : '0')
    window.dispatchEvent(new CustomEvent(AUTO_DETECT_EVENT, { detail: enabled }))
  } catch {
    /* ignore */
  }
}

export function subscribeBeaconAutoDetect(listener: (enabled: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onCustom = (e: Event) => listener(Boolean((e as CustomEvent<boolean>).detail))
  const onStorage = (e: StorageEvent) => {
    if (e.key === AUTO_DETECT_KEY) listener(e.newValue !== '0')
  }
  window.addEventListener(AUTO_DETECT_EVENT, onCustom)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(AUTO_DETECT_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}

export function getBeaconAutoArtifact(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = localStorage.getItem(AUTO_ARTIFACT_KEY)
    if (raw == null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function setBeaconAutoArtifact(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUTO_ARTIFACT_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function emitBeaconChange(message: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<BeaconChangeDetail>(BEACON_CHANGE_EVENT, {
      detail: { message, at: new Date().toISOString() },
    }),
  )
}

export function subscribeBeaconChange(listener: (detail: BeaconChangeDetail) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<BeaconChangeDetail>).detail
    if (detail) listener(detail)
  }
  window.addEventListener(BEACON_CHANGE_EVENT, handler)
  return () => window.removeEventListener(BEACON_CHANGE_EVENT, handler)
}

export function computeArtifactCompletion(artifacts: ArtifactItem[]): ArtifactCompletion {
  const total = artifacts.length
  const done = artifacts.filter((a) => a.present).length
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}

/** 체크리스트 100% → Gate ready, ready인데 미완료면 경고 */
export function applyGateAutomation(stages: StageSummary[], artifacts: ArtifactItem[]): GateAutomationResult {
  const byStage: Partial<Record<ProcessStageId, { total: number; done: number }>> = {}
  for (const art of artifacts) {
    const stageId = kindToStage(art.kind)
    if (!stageId) continue
    const bucket = byStage[stageId] ?? { total: 0, done: 0 }
    bucket.total += 1
    if (art.present) bucket.done += 1
    byStage[stageId] = bucket
  }

  const overall = computeArtifactCompletion(artifacts)
  const autoPassed: ProcessStageId[] = []
  const warnings: string[] = []

  const next = stages.map((stage) => {
    const bucket = byStage[stage.id]
    const stageComplete = bucket && bucket.total > 0 && bucket.done === bucket.total
    const overallComplete = overall.total > 0 && overall.percent === 100

    if (stage.gateStatus === 'ready' && bucket && bucket.total > 0 && bucket.done < bucket.total) {
      warnings.push(
        `${stage.id.toUpperCase()} Gate는 통과인데 산출물 ${bucket.done}/${bucket.total}만 완료`,
      )
    }

    if ((stageComplete || overallComplete) && stage.gateStatus !== 'ready') {
      autoPassed.push(stage.id)
      return { ...stage, gateStatus: 'ready' as GateStatus, state: stage.state === 'upcoming' ? 'ready' : stage.state }
    }
    return stage
  })

  if (overall.total > 0 && overall.percent < 100) {
    const readyIncomplete = next.filter((s) => s.gateStatus === 'ready')
    if (readyIncomplete.length > 0 && artifacts.some((a) => !a.present)) {
      // already pushed per-stage warnings; add overall note once
      if (!warnings.some((w) => w.includes('전체'))) {
        warnings.push(`전체 산출물 완료율 ${overall.percent}% — Gate와 체크리스트가 어긋날 수 있습니다`)
      }
    }
  }

  return { stages: next, autoPassed, warnings }
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function analyzeTimeline(events: TimelineItem[], days = 28): TimelineAnalytics {
  const now = new Date()
  const weekStart = startOfWeek(now).getTime()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  let weekCount = 0
  let monthCount = 0
  const dayMap = new Map<string, number>()
  const sourceMap = new Map<string, number>()
  const categoryMap = new Map<string, number>()

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dayMap.set(toDateKey(d), 0)
  }

  for (const ev of events) {
    const t = Date.parse(ev.occurredAt)
    if (Number.isNaN(t)) continue
    if (t >= weekStart) weekCount += 1
    if (t >= monthStart) monthCount += 1

    const key = ev.occurredAt.slice(0, 10)
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1)

    const source = ev.source?.trim() || ev.type?.trim() || 'unknown'
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1)
    const category = ev.category?.trim() || 'general'
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1)
  }

  return {
    weekCount,
    monthCount,
    byDay: Array.from(dayMap.entries()).map(([date, count]) => ({ date, count })),
    bySource: Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    byCategory: Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  }
}

export function snapshotFromView(input: {
  id: string
  project: BeaconProjectJson | null
  summaryName?: string
  timeline: TimelineItem[]
}): import('@/lib/beacon').FolioBeaconSnapshot {
  return {
    id: input.id,
    createdAt: new Date().toISOString(),
    source: 'change',
    project: input.project,
    summary: input.project
      ? {
          name: input.summaryName ?? input.project.name ?? 'Beacon',
          initializedAt: input.project.initializedAt,
          currentGate: null,
          currentGateLabel: null,
          progressPercent: 0,
          readyStages: 0,
          totalStages: 5,
          stages: [],
          scannedAt: null,
        }
      : null,
    timeline: input.timeline,
    mtimes: { projectJson: null, beaconDb: null },
  }
}

export { BEACON_CHANGE_EVENT, AUTO_DETECT_KEY }
