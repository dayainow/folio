'use client'

/**
 * P67 — AI 도구 패널 (자동완성 · 편집 · 분석 · 의미검색)
 */
import { useCallback, useId, useMemo, useState } from 'react'
import { Sparkles, Loader2, X, Wand2, Search, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { csrfHeaders } from '@/lib/csrf'
import { loadJournals } from '@/lib/journal'
import { loadDocs } from '@/lib/docs'
import { loadTasks } from '@/lib/board'
import {
  recommendRelated,
  semanticSearchLocal,
  type SemanticDoc,
  type SemanticHit,
} from '@/lib/ai-semantic'
import { cn } from '@/lib/utils'

type Tab = 'assist' | 'edit' | 'search' | 'analyze'

function collectDocs(): SemanticDoc[] {
  const journals = loadJournals()
  const docs = loadDocs()
  const tasks = loadTasks()
  const out: SemanticDoc[] = []
  for (const [date, e] of Object.entries(journals)) {
    out.push({
      id: `j:${date}`,
      source: 'journal',
      title: date,
      text: e.content ?? '',
      updatedAt: e.updatedAt,
      tags: e.tags,
    })
  }
  for (const d of docs) {
    out.push({
      id: `d:${d.id}`,
      source: 'doc',
      title: d.title,
      text: d.content ?? '',
      updatedAt: d.updatedAt,
      tags: d.category ? [d.category] : [],
    })
  }
  for (const t of tasks) {
    out.push({
      id: `t:${t.id}`,
      source: 'task',
      title: t.title,
      text: t.description ?? '',
      updatedAt: t.updatedAt,
      tags: t.tags,
    })
  }
  return out
}

export function AiToolsButton({
  getSelection,
  onInsert,
  className,
}: {
  getSelection?: () => string
  onInsert?: (text: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('h-7 gap-1.5 rounded-full px-2.5 text-[11px]', className)}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5 text-violet-600" />
        AI
      </Button>
      {open ? (
        <AiToolsPanel
          id={panelId}
          getSelection={getSelection}
          onInsert={onInsert}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

export function AiToolsPanel({
  id,
  onClose,
  getSelection,
  onInsert,
}: {
  id?: string
  onClose: () => void
  getSelection?: () => string
  onInsert?: (text: string) => void
}) {
  const [tab, setTab] = useState<Tab>('assist')
  const [busy, setBusy] = useState(false)
  const [text, setText] = useState('')
  const [output, setOutput] = useState('')
  const [meta, setMeta] = useState('')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SemanticHit[]>([])
  const [targetLang, setTargetLang] = useState('en')

  const corpus = useMemo(() => collectDocs(), [])

  const runComplete = useCallback(
    async (task: 'autocomplete' | 'tags' | 'sentence' | 'summarize' | 'keywords') => {
      setBusy(true)
      setOutput('')
      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
          body: JSON.stringify({ kind: 'complete', task, text }),
        })
        const data = await res.json()
        setOutput(String(data.suggestion ?? ''))
        setMeta(`${data.source}${data.provider ? ` · ${data.provider}` : ''}`)
        if (Array.isArray(data.tags) && data.tags.length) {
          setOutput((prev: string) => prev || data.tags.map((t: string) => `#${t.replace(/^#/, '')}`).join(' '))
        }
      } catch (e) {
        setOutput(e instanceof Error ? e.message : '실패')
      } finally {
        setBusy(false)
      }
    },
    [text],
  )

  const runEdit = useCallback(
    async (action: 'summarize' | 'expand' | 'rewrite' | 'grammar' | 'translate') => {
      setBusy(true)
      const selection = (getSelection?.() || text).trim()
      if (!selection) {
        setBusy(false)
        setOutput('선택된 텍스트가 없습니다.')
        return
      }
      try {
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
          body: JSON.stringify({
            kind: 'edit',
            action,
            selection,
            targetLang: action === 'translate' ? targetLang : undefined,
          }),
        })
        const data = await res.json()
        setOutput(String(data.result ?? ''))
        setMeta(`${data.source}${data.provider ? ` · ${data.provider}` : ''}`)
      } catch (e) {
        setOutput(e instanceof Error ? e.message : '실패')
      } finally {
        setBusy(false)
      }
    },
    [getSelection, text, targetLang],
  )

  const runSearch = useCallback(() => {
    const q = query.trim()
    if (!q) return
    const local = semanticSearchLocal(q, corpus, 16)
    setHits(local)
    setOutput(
      local.length
        ? `"${q}" 의미 검색 ${local.length}건 (로컬 임베딩 · 관련성 순)`
        : '결과 없음',
    )
    setMeta('local-embedding')
  }, [query, corpus])

  const runRelated = useCallback(() => {
    const seed = (getSelection?.() || text || query).trim()
    if (!seed) return
    const local = recommendRelated(seed, corpus, undefined, 8)
    setHits(local)
    setOutput(local.length ? `관련 추천 ${local.length}건` : '관련 항목 없음')
    setMeta('related')
  }, [getSelection, text, query, corpus])

  const runAnalyze = useCallback(async () => {
    setBusy(true)
    try {
      const journals = Object.entries(loadJournals())
        .slice(0, 20)
        .map(([date, e]) => ({ date, content: e.content ?? '', tags: e.tags }))
      const docs = loadDocs()
        .slice(0, 15)
        .map((d) => ({ title: d.title, content: d.content ?? '', category: d.category }))
      const tasks = loadTasks().slice(0, 40)
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ kind: 'analyze', journals, docs, tasks }),
      })
      const data = await res.json()
      setOutput(
        [
          `감정: ${data.sentiment} (${Number(data.sentimentScore ?? 0).toFixed(2)})`,
          `키워드: ${(data.keywords ?? []).join(', ') || '—'}`,
          `트렌드:\n${(data.trends ?? []).map((t: string) => `- ${t}`).join('\n') || '—'}`,
          '',
          data.projectSummary ?? '',
        ].join('\n'),
      )
      setMeta(`${data.source}${data.provider ? ` · ${data.provider}` : ''}`)
    } catch (e) {
      setOutput(e instanceof Error ? e.message : '실패')
    } finally {
      setBusy(false)
    }
  }, [])

  const tabs: Array<{ id: Tab; label: string; icon: typeof Wand2 }> = [
    { id: 'assist', label: '작성', icon: Wand2 },
    { id: 'edit', label: '편집', icon: Sparkles },
    { id: 'search', label: '의미검색', icon: Search },
    { id: 'analyze', label: '분석', icon: BarChart3 },
  ]

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="AI 도구"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <div>
            <h2 className="text-sm font-semibold">AI 도구</h2>
            <p className="text-[11px] text-muted-foreground">자동완성 · 편집 · 의미검색 · 분석 (P67)</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="ml-auto size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex gap-1 border-b border-border px-3 py-2">
          {tabs.map((t) => (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={tab === t.id ? 'default' : 'ghost'}
              className="h-7 gap-1 px-2 text-[11px]"
              onClick={() => setTab(t.id)}
            >
              <t.icon className="h-3 w-3" />
              {t.label}
            </Button>
          ))}
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {(tab === 'assist' || tab === 'edit') && (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={tab === 'edit' ? '편집할 텍스트 (또는 에디터 선택 영역)' : '작성 중인 텍스트'}
              className="min-h-[100px] text-sm"
            />
          )}

          {tab === 'assist' && (
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => void runComplete('autocomplete')}>
                문장 제안
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => void runComplete('sentence')}>
                문장 완성
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => void runComplete('tags')}>
                태그 추천
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => void runComplete('summarize')}>
                요약
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => void runComplete('keywords')}>
                키워드
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" disabled={busy} onClick={runRelated}>
                관련 추천
              </Button>
            </div>
          )}

          {tab === 'edit' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => void runEdit('summarize')}>
                  선택 요약
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => void runEdit('expand')}>
                  확장
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => void runEdit('rewrite')}>
                  재작성
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => void runEdit('grammar')}>
                  문법/스타일
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="h-7 rounded-md border border-input bg-background px-2 text-[11px]"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  aria-label="번역 언어"
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                </select>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy} onClick={() => void runEdit('translate')}>
                  번역
                </Button>
              </div>
            </div>
          )}

          {tab === 'search' && (
            <div className="space-y-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="자연어로 질문… 예: 지난주 배포 이슈"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') runSearch()
                }}
              />
              <Button type="button" size="sm" className="h-7 text-[11px]" onClick={runSearch}>
                의미 검색
              </Button>
            </div>
          )}

          {tab === 'analyze' && (
            <Button type="button" size="sm" className="h-7 gap-1 text-[11px]" disabled={busy} onClick={() => void runAnalyze()}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
              감정 · 키워드 · 진행 요약
            </Button>
          )}

          {busy && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 생성 중…
            </p>
          )}

          {output && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta || 'result'}</span>
                {onInsert && output ? (
                  <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => onInsert(output)}>
                    삽입
                  </Button>
                ) : null}
              </div>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed">{output}</pre>
            </div>
          )}

          {hits.length > 0 && (
            <ul className="space-y-1.5">
              {hits.map((h) => (
                <li key={h.id} className="rounded-lg border border-border/60 px-2.5 py-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{h.title}</span>
                    <span className="tabular-nums text-muted-foreground">{h.score.toFixed(2)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{h.preview}</p>
                  <span className="text-[10px] text-muted-foreground">{h.source}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
