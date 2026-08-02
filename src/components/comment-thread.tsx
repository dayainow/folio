'use client'

/**
 * P41 — 주석 스레드 (@멘션 · 해결/미해결)
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, MessageSquarePlus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  addComment,
  deleteComment,
  listComments,
  setCommentResolved,
  subscribeComments,
  type CommentTarget,
  type DocComment,
} from '@/lib/comments'
import { cn } from '@/lib/utils'

export function CommentThread({
  target,
  authorId,
  authorName,
  className,
}: {
  target: CommentTarget
  authorId: string
  authorName: string
  className?: string
}) {
  const [items, setItems] = useState<DocComment[]>(() => listComments(target))
  const [body, setBody] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const refresh = useCallback(() => {
    setItems(listComments(target))
  }, [target])

  useEffect(() => subscribeComments(refresh), [refresh])

  useEffect(() => {
    const id = window.setTimeout(() => setItems(listComments(target)), 0)
    return () => window.clearTimeout(id)
  }, [target])

  const visible = showResolved ? items : items.filter((c) => !c.resolved)

  const submit = () => {
    if (!body.trim()) return
    addComment({ target, body, authorId, authorName })
    setBody('')
    refresh()
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
          주석
        </h3>
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded border-gray-300"
          />
          해결 포함
        </label>
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="@멘션 포함 피드백"
        className="min-h-[72px] resize-none text-xs"
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" className="h-7 text-xs" onClick={submit} disabled={!body.trim()}>
          등록
        </Button>
      </div>

      <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
        {visible.length === 0 ? (
          <li className="text-xs text-muted-foreground">주석이 없습니다.</li>
        ) : (
          visible.map((c) => (
            <li key={c.id} className="rounded-md border border-border/60 px-2.5 py-2 text-sm">
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{c.authorName}</span>
                <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-snug">{c.body}</p>
              <div className="mt-2 flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => {
                    setCommentResolved(c.id, !c.resolved)
                    refresh()
                  }}
                >
                  {c.resolved ? (
                    <>
                      <RotateCcw className="mr-1 h-3 w-3" /> 재오픈
                    </>
                  ) : (
                    <>
                      <Check className="mr-1 h-3 w-3" /> 해결
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-red-500"
                  onClick={() => {
                    deleteComment(c.id)
                    refresh()
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
