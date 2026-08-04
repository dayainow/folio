/**
 * P54 — v1 baseline: 스키마 버전 태깅 (데이터 형상은 유지)
 */
import type { Migration } from '@/migrations/types'

export const migration001Baseline: Migration = {
  id: 1,
  name: 'baseline',
  description: '스키마 버전 필드를 도입하고 데이터셋을 v1로 태깅',
  up: (data) => ({
    ...data,
    schemaVersion: 1,
  }),
  down: (data) => ({
    ...data,
    schemaVersion: 0,
  }),
}
