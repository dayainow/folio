import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'

export type DailyReview = {
  date: string
  win: string
  learned: string
  tomorrow: string
  completedAt?: string
  updatedAt: string
}

const STORAGE_KEY = 'folio_daily_reviews_v1'

export function loadDailyReviews(): Record<string, DailyReview> {
  return getLocalJson<Record<string, DailyReview>>(STORAGE_KEY, {})
}

export function loadDailyReview(date: string): DailyReview | null {
  return loadDailyReviews()[date] ?? null
}

export function saveDailyReview(
  date: string,
  input: Pick<DailyReview, 'win' | 'learned' | 'tomorrow'>,
  complete = false,
): DailyReview {
  const reviews = loadDailyReviews()
  const previous = reviews[date]
  const now = new Date().toISOString()
  const review: DailyReview = {
    date,
    win: input.win.trim(),
    learned: input.learned.trim(),
    tomorrow: input.tomorrow.trim(),
    updatedAt: now,
    completedAt: complete ? previous?.completedAt ?? now : previous?.completedAt,
  }
  reviews[date] = review
  setLocalJson(STORAGE_KEY, reviews)
  flushLocalJson(STORAGE_KEY)
  return review
}

export function isDailyReviewComplete(review: DailyReview | null): boolean {
  return Boolean(review?.completedAt && (review.win || review.learned || review.tomorrow))
}
