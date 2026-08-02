'use client'

/**
 * P45 — 문서/보드 세부 ACL 패널
 */
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  listResourceAcl,
  removeResourceAcl,
  setResourceAcl,
  subscribeResourceAcl,
  type ResourceAccess,
  type ResourceAclEntry,
  type ResourceKind,
} from '@/lib/resource-acl'
import { Shield } from 'lucide-react'

export function ResourceAclPanel({
  kind,
  resourceId,
  className,
}: {
  kind: ResourceKind
  resourceId: string
  className?: string
}) {
  const [rows, setRows] = useState<ResourceAclEntry[]>([])
  const [subject, setSubject] = useState('')
  const [access, setAccess] = useState<ResourceAccess>('edit')

  const refresh = useCallback(() => {
    setRows(listResourceAcl(kind, resourceId))
  }, [kind, resourceId])

  useEffect(() => subscribeResourceAcl(refresh), [refresh])
  useEffect(() => {
    const id = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(id)
  }, [refresh])

  const add = () => {
    const s = subject.trim()
    if (!s) return
    setResourceAcl({ kind, resourceId, subject: s, access })
    setSubject('')
    refresh()
  }

  return (
    <section className={className} aria-label="세부 권한">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
        <Shield className="h-3.5 w-3.5" aria-hidden />
        세부 권한
      </div>
      <div className="flex flex-col gap-1.5 sm:flex-row">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="email · userId · guest · team:…"
          className="h-8 text-xs"
        />
        <select
          value={access}
          onChange={(e) => setAccess(e.target.value as ResourceAccess)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
          aria-label="권한"
        >
          <option value="view">view</option>
          <option value="comment">comment</option>
          <option value="edit">edit</option>
          <option value="admin">admin</option>
        </select>
        <Button type="button" size="sm" className="h-8 text-xs" onClick={add} disabled={!subject.trim()}>
          추가
        </Button>
      </div>
      <ul className="mt-2 space-y-1">
        {rows.length === 0 ? (
          <li className="text-[11px] text-muted-foreground">세부 권한이 없습니다.</li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1 text-[11px]"
            >
              <span className="truncate">
                <span className="font-medium">{r.subject}</span>
                <span className="text-muted-foreground"> · {r.access}</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px]"
                onClick={() => {
                  removeResourceAcl(r.id)
                  refresh()
                }}
              >
                삭제
              </Button>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
