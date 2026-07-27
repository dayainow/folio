'use client'

import { requireAuthUser } from '@/lib/supabase'
import {
  loadJournals,
  saveJournalSupabase,
} from '@/lib/journal'
import {
  loadDocs,
  saveDocSupabase,
} from '@/lib/docs'
import {
  loadTasks,
  saveTasksSupabase,
} from '@/lib/board'

const migratedKey = (userId: string) => `folio_cloud_migrated_${userId}`

/**
 * 로그인 직후 1회: 브라우저 localStorage(게스트) 데이터를
 * 현재 사용자 user_id로 Supabase에 업로드한다.
 */
export async function migrateLocalDataOnLogin(): Promise<{
  migrated: boolean
  journals: number
  docs: number
  tasks: number
}> {
  const { userId, supabase } = await requireAuthUser()
  if (typeof window === 'undefined') {
    return { migrated: false, journals: 0, docs: 0, tasks: 0 }
  }

  if (localStorage.getItem(migratedKey(userId))) {
    return { migrated: false, journals: 0, docs: 0, tasks: 0 }
  }

  // DB에 소유자 없는(guest) 행이 있으면 현재 사용자로 인수
  await Promise.all([
    supabase.from('journals').update({ user_id: userId }).is('user_id', null),
    supabase.from('docs').update({ user_id: userId }).is('user_id', null),
    supabase.from('boards').update({ user_id: userId }).is('user_id', null),
  ])

  const journals = loadJournals()
  const docs = loadDocs()
  const tasks = loadTasks()

  let journalCount = 0
  for (const entry of Object.values(journals)) {
    await saveJournalSupabase(entry.date, entry.content, entry.tags)
    journalCount += 1
  }

  let docCount = 0
  for (const doc of docs) {
    await saveDocSupabase(doc)
    docCount += 1
  }

  if (tasks.length > 0) {
    await saveTasksSupabase(tasks)
  }

  localStorage.setItem(migratedKey(userId), new Date().toISOString())

  return {
    migrated: true,
    journals: journalCount,
    docs: docCount,
    tasks: tasks.length,
  }
}
