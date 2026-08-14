import type { JournalEntry } from '@/lib/journal'

export type DailyJourneyPhase = 'plan' | 'capture' | 'review'

export function dailyJourneyPhase(date = new Date()): DailyJourneyPhase {
  const hour = date.getHours()
  if (hour < 11) return 'plan'
  if (hour < 18) return 'capture'
  return 'review'
}

export type MemoryMoment = {
  entryKey: string
  entry: JournalEntry
  label: '어제' | '일주일 전' | '한 달 전' | '지난 기록'
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function createJournalEntryKey(date: string, now = Date.now()): string {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${now}-${Math.random().toString(36).slice(2, 10)}`
  return `${date}--${suffix}`
}

export function journalTitle(content: string, fallback = '제목 없는 기록'): string {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
  return firstLine?.replace(/^#+\s*/, '').slice(0, 80) || fallback
}

export function journalExcerpt(content: string, maxLength = 120): string {
  const plain = content
    .replace(/^#+\s*/gm, '')
    .replace(/[-*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= maxLength) return plain
  return `${plain.slice(0, maxLength).trimEnd()}…`
}

function shiftedDateKey(base: Date, days: number): string {
  const shifted = new Date(base)
  shifted.setHours(12, 0, 0, 0)
  shifted.setDate(shifted.getDate() - days)
  return localDateKey(shifted)
}

export function selectMemoryMoments(
  journals: Record<string, JournalEntry>,
  now = new Date(),
  limit = 3,
): MemoryMoment[] {
  const entries = Object.entries(journals).filter(([, entry]) => entry.content.trim())
  const selected = new Set<string>()
  const moments: MemoryMoment[] = []
  const anchors: Array<{ days: number; label: MemoryMoment['label'] }> = [
    { days: 1, label: '어제' },
    { days: 7, label: '일주일 전' },
    { days: 30, label: '한 달 전' },
  ]

  for (const anchor of anchors) {
    const date = shiftedDateKey(now, anchor.days)
    const matches = entries
      .filter(([entryKey, entry]) => entry.date === date && !selected.has(entryKey))
      .sort((a, b) => (b[1].createdAt ?? b[1].updatedAt).localeCompare(a[1].createdAt ?? a[1].updatedAt))
    const match = matches[0]
    if (!match) continue
    selected.add(match[0])
    moments.push({ entryKey: match[0], entry: match[1], label: anchor.label })
  }

  if (moments.length < limit) {
    const today = localDateKey(now)
    const fallback = entries
      .filter(([entryKey, entry]) => entry.date < today && !selected.has(entryKey))
      .sort((a, b) => {
        const byDate = b[1].date.localeCompare(a[1].date)
        return byDate || (b[1].createdAt ?? b[1].updatedAt).localeCompare(a[1].createdAt ?? a[1].updatedAt)
      })

    for (const [entryKey, entry] of fallback) {
      selected.add(entryKey)
      moments.push({ entryKey, entry, label: '지난 기록' })
      if (moments.length >= limit) break
    }
  }

  return moments.slice(0, limit)
}
