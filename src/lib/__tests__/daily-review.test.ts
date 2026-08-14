import { beforeEach, describe, expect, it } from 'vitest'
import { isDailyReviewComplete, loadDailyReview, saveDailyReview } from '@/lib/daily-review'

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
})
