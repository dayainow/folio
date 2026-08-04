/**
 * P54 — 버전 마이그레이션 정의 타입
 */
import type { JournalEntry } from '@/lib/journal'
import type { DocEntry } from '@/lib/docs'
import type { Task } from '@/lib/board'

export type FolioDataset = {
  schemaVersion: number
  journals: Record<string, JournalEntry>
  docs: DocEntry[]
  tasks: Task[]
}

export type Migration = {
  /** 단조 증가 정수 버전 (1부터) */
  id: number
  name: string
  description: string
  up: (data: FolioDataset) => FolioDataset | Promise<FolioDataset>
  down: (data: FolioDataset) => FolioDataset | Promise<FolioDataset>
}

export type ConflictStrategy = 'merge' | 'overwrite' | 'skip'

export type MigrationProgress = {
  phase: 'idle' | 'validate' | 'snapshot' | 'migrate' | 'import' | 'export' | 'done' | 'error'
  ratio: number
  label: string
}

export type ValidationReport = {
  at: string
  ok: boolean
  schemaVersion: number
  counts: { journals: number; docs: number; tasks: number }
  checksum: string
  issues: string[]
}

export type MigrationLogEntry = {
  at: string
  fromVersion: number
  toVersion: number
  direction: 'up' | 'down'
  migrations: number[]
  checksumBefore: string
  checksumAfter: string
  ok: boolean
  message?: string
}
