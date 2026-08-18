import { beforeEach, describe, expect, it } from 'vitest'
import { buildDailyExecutionSummary, isDailyReviewComplete, loadDailyReview, saveDailyReview } from '@/lib/daily-review'
import type { Task } from '@/lib/board'

describe('daily shutdown review', () => {
  beforeEach(() => localStorage.clear())

  it('saves a draft and completes it explicitly', () => {
    const draft = saveDailyReview('2026-08-14', { win: '출처 모델 완성', learned: '', tomorrow: '검색 평가 작성' })
    expect(isDailyReviewComplete(draft)).toBe(false)
    expect(loadDailyReview('2026-08-14')?.tomorrow).toBe('검색 평가 작성')

    const done = saveDailyReview('2026-08-14', draft, true)
    expect(isDailyReviewComplete(done)).toBe(true)
    expect(done.completedAt).toBeTruthy()
  })

  it('summarizes and stores the confirmed top three outcome', () => {
    const base = { description: '', priority: 'medium' as const, tags: [], createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z' }
    const tasks: Task[] = [
      { ...base, id: 'done', title: '완료', status: 'done' },
      { ...base, id: 'open', title: '미완료', status: 'in_progress' },
      { ...base, id: 'outside', title: '계획 밖 완료', status: 'done' },
    ]
    const execution = buildDailyExecutionSummary('2026-08-18', tasks, {
      date: '2026-08-18', taskIds: ['done', 'open'], confirmedAt: '2026-08-18T01:00:00.000Z', updatedAt: '2026-08-18T01:00:00.000Z',
    })
    expect(execution).toEqual({ planned: 2, completed: 1, open: 1, completedTaskIds: ['done'], openTaskIds: ['open'] })
    saveDailyReview('2026-08-18', { win: '한 가지 완료', learned: '', tomorrow: '미완료 이어가기', execution }, true)
    expect(loadDailyReview('2026-08-18')?.execution).toEqual(execution)
  })
})
