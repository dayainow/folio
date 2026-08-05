'use client'

/**
 * P60 — 공개 공유 / 임베드 뷰
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, Lock, Loader2 } from 'lucide-react'

type SharePayload = {
  title: string
  type: string
  html: string
  markdown: string
  views: number
  downloads: number
  expiresAt: string | null
}

export default function SharePage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const [embed, setEmbed] = useState(false)

  const [password, setPassword] = useState('')
  const [needPassword, setNeedPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SharePayload | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      setEmbed(new URLSearchParams(window.location.search).get('embed') === '1')
    })
  }, [])

  const load = async (pwd?: string) => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (pwd) q.set('password', pwd)
      const res = await fetch(`/api/share/${encodeURIComponent(token)}?${q}`)
      if (res.status === 401) {
        setNeedPassword(true)
        setData(null)
        return
      }
      if (res.status === 410) {
        setError('이 공유 링크는 만료되었습니다.')
        return
      }
      if (res.status === 403) {
        setError('암호가 올바르지 않습니다.')
        setNeedPassword(true)
        return
      }
      if (!res.ok) {
        setError('공유를 찾을 수 없습니다.')
        return
      }
      const json = (await res.json()) as SharePayload
      setData(json)
      setNeedPassword(false)
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token only
  }, [token])

  const download = async () => {
    const q = new URLSearchParams({ download: '1' })
    if (password) q.set('password', password)
    const res = await fetch(`/api/share/${encodeURIComponent(token)}?${q}`)
    if (!res.ok) {
      setError('다운로드 실패')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data?.title || 'folio'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={embed ? 'min-h-screen bg-background p-3' : 'min-h-screen bg-background'}>
      {!embed ? (
        <header className="border-b border-border/80 px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
            <Link href="/" className="text-lg font-bold tracking-[-0.07em]">
              Folio
            </Link>
            <span className="text-xs text-muted-foreground">읽기 전용 공유</span>
          </div>
        </header>
      ) : null}

      <main className={`mx-auto max-w-3xl px-4 py-6 ${embed ? 'py-2' : ''}`}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 불러오는 중…
          </div>
        ) : null}

        {needPassword && !data ? (
          <div className="mx-auto max-w-sm space-y-3 rounded-xl border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Lock className="size-4" /> 암호가 필요합니다
            </p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="공유 암호"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void load(password)
              }}
            />
            <Button type="button" className="w-full" onClick={() => void load(password)}>
              열기
            </Button>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        ) : null}

        {error && !needPassword ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        {data ? (
          <div className="space-y-4">
            {!embed ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-xl font-semibold">{data.title}</h1>
                  <p className="text-[11px] text-muted-foreground">
                    {data.type} · 조회 {data.views} · 다운로드 {data.downloads}
                    {data.expiresAt ? ` · 만료 ${data.expiresAt.slice(0, 10)}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void download()}
                >
                  <Download className="size-3.5" /> Markdown
                </Button>
              </div>
            ) : null}
            <article
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: data.html.includes('<body') ? extractBody(data.html) : data.html,
              }}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}

function extractBody(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (!m?.[1]) return html
  return m[1].replace(/<footer[\s\S]*?<\/footer>/i, '')
}
