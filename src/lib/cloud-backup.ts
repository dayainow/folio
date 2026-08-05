/**
 * P60 — Supabase Storage 첨부 + 자동 백업 스케줄 + 충돌 해결
 */
'use client'

import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'
import { loadDataset, mergeDatasets, persistDataset, type ConflictStrategy } from '@/lib/data-migration'
import { exportDatasetJson } from '@/lib/data-migration'

const BACKUP_CFG_KEY = 'folio_backup_schedule_v1'
const BACKUP_LOG_KEY = 'folio_backup_log_v1'

export type BackupSchedule = {
  enabled: boolean
  /** 시간 단위 interval */
  intervalHours: number
  lastRunAt: string | null
  conflictStrategy: ConflictStrategy
}

export type BackupLogEntry = {
  at: string
  ok: boolean
  mode: 'local' | 'storage'
  message?: string
  bytes?: number
}

function defaultSchedule(): BackupSchedule {
  return {
    enabled: false,
    intervalHours: 24,
    lastRunAt: null,
    conflictStrategy: 'merge',
  }
}

export function getBackupSchedule(): BackupSchedule {
  return { ...defaultSchedule(), ...getLocalJson<Partial<BackupSchedule>>(BACKUP_CFG_KEY, {}) }
}

export function setBackupSchedule(next: Partial<BackupSchedule>) {
  const cur = getBackupSchedule()
  const merged = { ...cur, ...next }
  setLocalJson(BACKUP_CFG_KEY, merged)
  flushLocalJson(BACKUP_CFG_KEY)
  return merged
}

export function listBackupLogs(): BackupLogEntry[] {
  const list = getLocalJson<BackupLogEntry[]>(BACKUP_LOG_KEY, [])
  return Array.isArray(list) ? list : []
}

function pushLog(entry: BackupLogEntry) {
  const list = [entry, ...listBackupLogs()].slice(0, 40)
  setLocalJson(BACKUP_LOG_KEY, list)
  flushLocalJson(BACKUP_LOG_KEY)
}

/** 이미지/첨부를 Supabase Storage에 업로드 (미설정 시 data URL 유지) */
export async function uploadAttachment(
  file: File | Blob,
  pathHint: string,
): Promise<{ url: string; mode: 'storage' | 'data-url' }> {
  try {
    const { createBrowserSupabaseClient } = await import('@/lib/supabase')
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('not_authenticated')

    const ext = pathHint.includes('.') ? pathHint.split('.').pop() : 'bin'
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('folio-attachments').upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
    if (error) throw error
    const { data } = supabase.storage.from('folio-attachments').getPublicUrl(path)
    return { url: data.publicUrl, mode: 'storage' }
  } catch {
    const blob = file instanceof Blob ? file : new Blob([file])
    const dataUrl = await blobToDataUrl(blob)
    return { url: dataUrl, mode: 'data-url' }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** 로컬 JSON 백업 + (가능 시) Storage 업로드 */
export async function runCloudBackup(): Promise<BackupLogEntry> {
  const blob = exportDatasetJson()
  const bytes = blob.size
  const stamp = new Date().toISOString()

  try {
    const { createBrowserSupabaseClient } = await import('@/lib/supabase')
    const supabase = createBrowserSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const path = `${user.id}/backups/folio-backup-${stamp.slice(0, 10)}-${Date.now()}.json`
      const { error } = await supabase.storage.from('folio-backups').upload(path, blob, {
        contentType: 'application/json',
        upsert: true,
      })
      if (!error) {
        const entry: BackupLogEntry = {
          at: stamp,
          ok: true,
          mode: 'storage',
          bytes,
          message: path,
        }
        pushLog(entry)
        setBackupSchedule({ lastRunAt: stamp })
        return entry
      }
    }
  } catch {
    /* fall through local */
  }

  // 로컬 다운로드 트리거 (스케줄러가 브라우저에 있을 때)
  try {
    const { downloadBlob } = await import('@/lib/export')
    downloadBlob(blob, `folio-backup-${stamp.slice(0, 10)}.json`)
  } catch {
    /* ignore */
  }
  const entry: BackupLogEntry = {
    at: stamp,
    ok: true,
    mode: 'local',
    bytes,
    message: 'local download',
  }
  pushLog(entry)
  setBackupSchedule({ lastRunAt: stamp })
  return entry
}

export function shouldRunScheduledBackup(now = Date.now()): boolean {
  const cfg = getBackupSchedule()
  if (!cfg.enabled) return false
  if (!cfg.lastRunAt) return true
  const last = Date.parse(cfg.lastRunAt)
  if (!Number.isFinite(last)) return true
  return now - last >= cfg.intervalHours * 3600_000
}

/** 가져온 백업 JSON과 현재 데이터 충돌 해결 */
export async function resolveBackupConflict(
  incomingJson: string,
  strategy?: ConflictStrategy,
): Promise<{ ok: boolean; message: string }> {
  const cfg = getBackupSchedule()
  const mode = strategy ?? cfg.conflictStrategy
  try {
    const { parseDatasetJson } = await import('@/lib/data-migration')
    const incoming = parseDatasetJson(incomingJson)
    const current = loadDataset()
    const merged = mergeDatasets(current, incoming, mode)
    persistDataset(merged)
    return { ok: true, message: `충돌 해결: ${mode}` }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'resolve_failed',
    }
  }
}

/** 앱 포그라운드에서 스케줄 틱 */
export function startBackupScheduler(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const tick = () => {
    if (shouldRunScheduledBackup()) {
      void runCloudBackup()
    }
  }
  tick()
  const id = window.setInterval(tick, 15 * 60_000)
  return () => window.clearInterval(id)
}
