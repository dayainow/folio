'use client'

import { useEffect, useState } from 'react'
import { getUser } from '@/lib/supabase'

export type CollabIdentity = {
  id: string
  name: string
  email?: string | null
} | null

/** Supabase 로그인 사용자 — 없으면 null (게스트 Presence 사용) */
export function useCollabUser(): CollabIdentity {
  const [user, setUser] = useState<CollabIdentity>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const u = await getUser()
        if (cancelled || !u) return
        setUser({
          id: u.id,
          name: (u.user_metadata?.full_name as string | undefined) || u.email?.split('@')[0] || '사용자',
          email: u.email,
        })
      } catch {
        /* offline / no supabase */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return user
}
