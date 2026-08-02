'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  addComment,
  deleteComment,
  listComments,
  setCommentResolved,
  subscribeComments,
  type DocComment,
} from '@/lib/comments'
import { getOrCreateGuestId } from '@/lib/presence'
import { CheckCircle2, Circle, MessageSquarePlus, Trash2 } from 'lucide-react'

export type DocCommentsPanelProps = {
  targetKind: 'doc' | 'journal'
  targetId: string
  user?: { id: string; name: string; email?: string | null } | null
  mentionSuggestions?: string[]
}

export function DocCommentsPanel({
  targetKind,
  targetId,
  user,
  mentionSuggestions = [],
}: DocCommentsPanelProps) {
  const [items, setItems] = useState<DocComment[]>(() =>
    listComments({ kind: targetKind, id: targetId }),
  )
  const [body, setBody] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const refresh = useCallback(() => {
    setItems(listComments({ kind: targetKind, id: targetId }))
  }, [targetKind, targetId])

  useEffect(() => {
    return subscribeComments(refresh)
  }, [refresh])

  // target 변경 시 목록 재로드 (외부 이벤트 구독과 분리)
  useEffect(() => {
    const id = window.setTimeout(() => {
      setItems(listComments({ kind: targetKind, id: targetId }))
    }, 0)
    return () => window.clearTimeout(id)
  }, [targetKind, targetId])

  const visible = useMemo(
    () => items.filter((c) => (showResolved ? true : !c.resolved)),
    [items, showResolved],
  )

  const authorId = user?.id ?? getOrCreateGuestId()
  const authorName = user?.name || user?.email?.split('@')[0] || '게스트'

  const submit = () => {
    if (!body.trim()) return
    addComment({
      target: { kind: targetKind, id: targetId },
      body,
      authorId,
      authorName,
    })
    setBody('')
    refresh()
  }

  const insertMention = (token: string) => {
    setBody((prev) => {
      const needsSpace = prev.length > 0 && !/\s$/.test(prev)
      return `${prev}${needsSpace ? ' ' : ''}@${token} `
    })
  }

  return (
    <section className="rounded-xl border border-gray-100 dark:border-gray-800 bg-card p-3" aria-label="주석">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
          주석
          <Badge variant="secondary" className="text-[10px]">
            {items.filter((c) => !c.resolved).length}
          </Badge>
        </div>
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
        placeholder="피드백을 남기세요. @이름 으로 멘션"
        className="min-h-[72px] resize-none text-xs"
        aria-label="주석 입력"
      />
      {mentionSuggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {mentionSuggestions.slice(0, 6).map((m) => (
            <button
              key={m}
              type="button"
              className="rounded-md border border-gray-100 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
              onClick={() => insertMention(m)}
            >
              @{m}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <Button type="button" size="sm" className="h-7 text-xs" onClick={submit} disabled={!body.trim()}>
          등록
        </Button>
      </div>

      <ul className="mt-3 space-y-2">
        {visible.length === 0 && (
          <li className="text-[11px] text-muted-foreground">아직 주석이 없습니다.</li>
        )}
        {visible.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-gray-50 dark:border-gray-800 bg-muted/20 p-2 text-xs"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-medium">{c.authorName}</span>
              <span className="tabular-nums text-[10px] text-muted-foreground">
                {c.createdAt.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{c.body}</p>
            {c.mentions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {c.mentions.map((m) => (
                  <Badge key={m} variant="outline" className="text-[9px]">
                    @{m}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-1.5 flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px]"
                onClick={() => {
                  setCommentResolved(c.id, !c.resolved)
                  refresh()
                }}
              >
                {c.resolved ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3 text-teal-600" /> 해결됨
                  </>
                ) : (
                  <>
                    <Circle className="mr-1 h-3 w-3" /> 미해결
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px] text-red-500"
                onClick={() => {
                  deleteComment(c.id)
                  refresh()
                }}
                aria-label="주석 삭제"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
