/**
 * P54 — 등록된 마이그레이션 목록 (id 오름차순)
 */
import { migration001Baseline } from '@/migrations/001_baseline'
import { migration002NormalizeTags } from '@/migrations/002_normalize_tags'
import { migration003EnsureTimestamps } from '@/migrations/003_ensure_timestamps'
import type { Migration } from '@/migrations/types'

export const MIGRATIONS: Migration[] = [
  migration001Baseline,
  migration002NormalizeTags,
  migration003EnsureTimestamps,
].sort((a, b) => a.id - b.id)

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.id ?? 0

export function getMigration(id: number): Migration | undefined {
  return MIGRATIONS.find((m) => m.id === id)
}

export function migrationsBetween(from: number, to: number): Migration[] {
  if (to > from) {
    return MIGRATIONS.filter((m) => m.id > from && m.id <= to)
  }
  if (to < from) {
    return MIGRATIONS.filter((m) => m.id <= from && m.id > to).sort((a, b) => b.id - a.id)
  }
  return []
}
