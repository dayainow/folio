/**
 * P47 — local / cloud(cache) / beacon 데이터 무결성 검증
 */
'use client'

import {
  getStorageMode,
  isBeaconAvailable,
  loadBeaconCache,
  type StorageDataType,
} from '@/lib/storage'

export type IntegritySource = 'local' | 'cloud-cache' | 'beacon'

export type IntegrityCheckItem = {
  type: StorageDataType
  source: IntegritySource
  present: boolean
  checksum: string | null
  size: number
}

export type IntegrityReport = {
  checkedAt: string
  mode: ReturnType<typeof getStorageMode>
  items: IntegrityCheckItem[]
  /** 소스 간 checksum 불일치 */
  mismatches: Array<{
    type: StorageDataType
    sources: IntegritySource[]
    checksums: Partial<Record<IntegritySource, string | null>>
    suggestion: string
  }>
  ok: boolean
}

const LOCAL_KEYS: Record<StorageDataType, string> = {
  journal: 'workspace_journals',
  docs: 'workspace_docs',
  board: 'workspace_tasks',
}

const CLOUD_CACHE_KEYS: Record<StorageDataType, string> = {
  journal: 'supabase:journals',
  docs: 'supabase:docs',
  board: 'supabase:boards',
}

/** FNV-1a 32-bit — 빠른 클라이언트 checksum */
export function checksumString(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (`00000000${(h >>> 0).toString(16)}`).slice(-8)
}

export function checksumData(data: unknown): string {
  try {
    return checksumString(stableStringify(data))
  } catch {
    return checksumString(String(data))
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function readLocalRaw(type: StorageDataType): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(LOCAL_KEYS[type])
  } catch {
    return null
  }
}

function readCloudCacheRaw(type: StorageDataType): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(CLOUD_CACHE_KEYS[type])
  } catch {
    return null
  }
}

function parseMaybeJson(raw: string | null): unknown {
  if (raw == null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

/**
 * localStorage / Supabase 캐시 / Beacon 캐시 checksum 비교
 */
export async function verifyStorageIntegrity(
  types: StorageDataType[] = ['journal', 'docs', 'board'],
): Promise<IntegrityReport> {
  const mode = getStorageMode()
  const items: IntegrityCheckItem[] = []
  const byType = new Map<
    StorageDataType,
    Partial<Record<IntegritySource, string | null>>
  >()

  let beaconOk = false
  try {
    beaconOk = await isBeaconAvailable()
  } catch {
    beaconOk = false
  }

  for (const type of types) {
    const localRaw = readLocalRaw(type)
    const localData = parseMaybeJson(localRaw)
    const localCs = localRaw != null ? checksumData(localData) : null
    items.push({
      type,
      source: 'local',
      present: localRaw != null,
      checksum: localCs,
      size: localRaw?.length ?? 0,
    })

    const cloudRaw = readCloudCacheRaw(type)
    const cloudData = parseMaybeJson(cloudRaw)
    const cloudCs = cloudRaw != null ? checksumData(cloudData) : null
    items.push({
      type,
      source: 'cloud-cache',
      present: cloudRaw != null,
      checksum: cloudCs,
      size: cloudRaw?.length ?? 0,
    })

    let beaconCs: string | null = null
    let beaconPresent = false
    let beaconSize = 0
    if (beaconOk) {
      try {
        const data = await loadBeaconCache<unknown>(type)
        if (data != null) {
          beaconPresent = true
          const raw = JSON.stringify(data)
          beaconSize = raw.length
          beaconCs = checksumData(data)
        }
      } catch {
        beaconPresent = false
      }
    }
    items.push({
      type,
      source: 'beacon',
      present: beaconPresent,
      checksum: beaconCs,
      size: beaconSize,
    })

    byType.set(type, {
      local: localCs,
      'cloud-cache': cloudCs,
      beacon: beaconCs,
    })
  }

  const mismatches: IntegrityReport['mismatches'] = []
  for (const [type, checksums] of byType) {
    const present = (Object.entries(checksums) as [IntegritySource, string | null | undefined][])
      .filter(([, cs]) => cs != null)
      .map(([src, cs]) => ({ src, cs: cs as string }))
    if (present.length < 2) continue
    const unique = new Set(present.map((p) => p.cs))
    if (unique.size <= 1) continue
    const sources = present.map((p) => p.src)
    mismatches.push({
      type,
      sources,
      checksums,
      suggestion: suggestRecovery(type, mode, checksums),
    })
  }

  return {
    checkedAt: new Date().toISOString(),
    mode,
    items,
    mismatches,
    ok: mismatches.length === 0,
  }
}

function suggestRecovery(
  type: StorageDataType,
  mode: ReturnType<typeof getStorageMode>,
  checksums: Partial<Record<IntegritySource, string | null>>,
): string {
  const label =
    type === 'journal' ? '일지' : type === 'docs' ? '문서' : '일정'
  if (mode === 'beacon' && checksums.beacon && checksums.local && checksums.beacon !== checksums.local) {
    return `${label}: Beacon ↔ 로컬 불일치. 저장 모드를 Beacon으로 유지한 채 다시 저장하거나, 로컬 내보내기 후 Beacon 캐시를 덮어쓰세요.`
  }
  if (mode === 'cloud' && checksums['cloud-cache'] && checksums.local && checksums['cloud-cache'] !== checksums.local) {
    return `${label}: 클라우드 캐시 ↔ 로컬 불일치. 로그인 후 다시 동기화하거나 로컬을 기준으로 저장하세요.`
  }
  return `${label}: 소스 간 데이터가 다릅니다. 내보내기(백업) 후 신뢰할 소스를 기준으로 다시 저장하세요.`
}

/** 복구 제안 문구만 */
export function formatIntegritySuggestions(report: IntegrityReport): string[] {
  if (report.ok) return ['모든 소스 checksum이 일치하거나 비교할 소스가 부족합니다.']
  return report.mismatches.map((m) => m.suggestion)
}
