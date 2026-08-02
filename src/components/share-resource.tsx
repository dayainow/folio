'use client'

/**
 * P43 — 문서/보드 팀 공유 설정
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import {
  getActiveTeamId,
  listSharedBoards,
  listSharedDocs,
  shareBoard,
  shareDoc,
  type SharePermission,
} from '@/lib/team'
import { notifyShareInvite } from '@/lib/collab-notify'
import { Share2 } from 'lucide-react'

function subscribeActiveTeam(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('folio-active-team', onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('folio-active-team', onStoreChange)
  }
}

export function ShareResourceButton({
  kind,
  resourceId,
  resourceLabel,
  actorName,
  actorId,
  className,
}: {
  kind: 'doc' | 'board'
  resourceId: string
  resourceLabel: string
  actorName?: string
  actorId?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [permission, setPermission] = useState<SharePermission>('edit')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [current, setCurrent] = useState<SharePermission | null>(null)
  const teamId = useSyncExternalStore(
    subscribeActiveTeam,
    () => getActiveTeamId(),
    () => null,
  )

  useEffect(() => {
    if (!open || !teamId || !resourceId) return
    let cancelled = false
    void (kind === 'doc' ? listSharedDocs(teamId) : listSharedBoards(teamId))
      .then((rows) => {
        if (cancelled) return
        const hit = rows.find((r) =>
          kind === 'doc'
            ? (r as { docId: string }).docId === resourceId
            : (r as { boardId: string }).boardId === resourceId,
        )
        setCurrent(hit?.permission ?? null)
        if (hit) setPermission(hit.permission)
      })
      .catch(() => {
        if (!cancelled) setCurrent(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, teamId, resourceId, kind])

  const share = async () => {
    if (!teamId) {
      setErr('활성 팀을 먼저 선택하세요.')
      return
    }
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      if (kind === 'doc') await shareDoc(resourceId, teamId, permission)
      else await shareBoard(resourceId, teamId, permission)
      setCurrent(permission)
      setMsg(`팀에 ${permission === 'edit' ? '편집' : '보기'} 권한으로 공유됨`)
      void notifyShareInvite({
        resource: kind,
        resourceLabel,
        permission,
        actorName: actorName ?? '팀원',
        actorId,
        teamId,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : '공유 실패')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1 text-xs"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Share2 className="h-3.5 w-3.5" />
        공유
        {current ? (
          <span className="rounded bg-muted px-1 text-[9px] uppercase">{current}</span>
        ) : null}
      </Button>
      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-100 p-2 text-xs dark:border-gray-800">
          <p className="text-muted-foreground">
            활성 팀에게 &ldquo;{resourceLabel}&rdquo; 공유
            {!teamId && <span className="text-red-500"> · 팀 없음</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as SharePermission)}
              className="h-8 rounded-lg border border-gray-200 bg-background px-2 text-xs dark:border-gray-700"
            >
              <option value="view">viewer (보기)</option>
              <option value="edit">editor (편집)</option>
            </select>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={busy || !teamId}
              onClick={() => void share()}
            >
              {busy ? '공유 중…' : '공유 적용'}
            </Button>
          </div>
          {msg && <p className="text-emerald-600 dark:text-emerald-400">{msg}</p>}
          {err && <p className="text-red-600 dark:text-red-400">{err}</p>}
        </div>
      )}
    </div>
  )
}
