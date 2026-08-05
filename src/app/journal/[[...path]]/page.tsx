import { redirect } from 'next/navigation'
import { parseJournalPath } from '@/lib/journal-path'

/**
 * P58 — /journal/{folderSlug}/{YYYY-MM-DD} → 홈 일지 탭 딥링크
 */
export default async function JournalPathPage({
  params,
}: {
  params: Promise<{ path?: string[] }>
}) {
  const { path = [] } = await params
  const { folderSlug, date } = parseJournalPath(path)
  const q = new URLSearchParams()
  q.set('tab', 'journal')
  if (date) q.set('date', date)
  if (folderSlug) q.set('folder', folderSlug)
  redirect(`/?${q.toString()}`)
}
