'use client'

/**
 * 인앱 가이드 — 탭 · 사이드바 TOC · 마크다운 렌더
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BookOpen, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/components/language-toggle'
import { useI18n } from '@/components/i18n-provider'
import { cn } from '@/lib/utils'
import { extractGuideHeadings, slugifyHeading } from '@/lib/guide-markdown'
import type { Locale } from '@/lib/i18n'

export type GuideDocs = {
  onboarding: string
  features: string
  troubleshooting: string
}

type TabKey = 'onboarding' | 'features' | 'troubleshooting'

const TAB_KEYS: { key: TabKey; labelKey: string }[] = [
  { key: 'onboarding', labelKey: 'guide.onboarding' },
  { key: 'features', labelKey: 'guide.features' },
  { key: 'troubleshooting', labelKey: 'guide.troubleshooting' },
]

const proseClass = [
  'max-w-none text-sm leading-relaxed text-foreground',
  '[&_h1]:mt-0 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight',
  '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-semibold',
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-medium',
  '[&_p]:my-2.5 [&_p]:text-muted-foreground',
  '[&_strong]:text-foreground',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-muted-foreground',
  '[&_li]:my-1',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2',
  '[&_hr]:my-6 [&_hr]:border-border',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]',
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted/60 [&_pre]:p-3 [&_pre]:ring-1 [&_pre]:ring-border',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left',
  '[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:font-medium',
  '[&_td]:border [&_td]:border-border [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:text-muted-foreground',
  'dark:[&_p]:text-muted-foreground',
].join(' ')

function headingId(children: ReactNode): string {
  const text = flattenText(children)
  return slugifyHeading(text)
}

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(flattenText).join('')
  if (typeof node === 'object' && 'props' in node) {
    const props = node.props as { children?: ReactNode }
    return flattenText(props.children)
  }
  return ''
}

export function GuideView({ docs }: { docs: GuideDocs; locale?: Locale }) {
  const { t, locale } = useI18n()
  const [liveDocs, setLiveDocs] = useState(docs)
  const tabs = TAB_KEYS.map((tabItem) => ({
    key: tabItem.key,
    label: t(tabItem.labelKey),
  }))
  const [tab, setTab] = useState<TabKey>('onboarding')
  const [mobileNav, setMobileNav] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const handle = window.setTimeout(() => {
      ;(async () => {
        try {
          const res = await fetch(`/api/guide-docs?locale=${locale}`)
          if (!res.ok || cancelled) return
          const next = (await res.json()) as GuideDocs
          if (!cancelled) setLiveDocs(next)
        } catch {
          /* keep previous */
        }
      })()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [locale])

  const markdown = liveDocs[tab]
  const headings = useMemo(() => extractGuideHeadings(markdown), [markdown])
  const highlightedId =
    activeId && headings.some((h) => h.id === activeId) ? activeId : (headings[0]?.id ?? null)

  const selectTab = (next: TabKey) => {
    setTab(next)
    setActiveId(null)
    setMobileNav(false)
    window.requestAnimationFrame(() => window.scrollTo(0, 0))
  }

  useEffect(() => {
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => Boolean(el))
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 1] },
    )
    for (const el of els) observer.observe(el)
    return () => observer.disconnect()
  }, [headings, markdown])

  const toc = (
    <nav aria-label="목차" className="space-y-0.5">
      {headings.map((h) => (
        <a
          key={h.id}
          href={`#${h.id}`}
          onClick={() => setMobileNav(false)}
          className={cn(
            'block rounded-md py-1.5 text-xs transition-colors',
            h.level === 3 ? 'pl-3 text-[11px]' : 'pl-2 font-medium',
            highlightedId === h.id
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          {h.text}
        </a>
      ))}
      {headings.length === 0 && (
        <p className="px-2 text-xs text-muted-foreground">섹션 없음</p>
      )}
    </nav>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header
        className="sticky top-0 z-50 border-b border-border/80 bg-background/90 px-3 backdrop-blur sm:px-4"
        role="banner"
      >
        <div className="mx-auto flex h-12 max-w-[1100px] items-center gap-2">
          <Link
            href="/"
            className="relative shrink-0 text-lg font-bold tracking-[-0.07em]"
            style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }}
          >
            Folio
            <span
              aria-hidden
              className="absolute -right-1.5 top-0.5 h-1 w-1 rotate-45 rounded-[1px] bg-foreground"
            />
          </Link>
          <span className="hidden text-xs text-muted-foreground sm:inline">{t('nav.guide')}</span>

          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:hidden"
              aria-label={t('nav.guide')}
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <LanguageToggle />
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Folio
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1100px] flex-1 gap-0 lg:gap-8">
        <aside className="hidden w-56 shrink-0 border-r border-border/60 p-4 lg:block">
          <div className="sticky top-16 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              목차
            </div>
            {toc}
          </div>
        </aside>

        <main id="guide-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <div
            role="tablist"
            aria-label={t('nav.guide')}
            className="mb-6 flex flex-wrap gap-1 rounded-xl bg-muted/40 p-1"
          >
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => selectTab(item.key)}
                className={cn(
                  'h-8 rounded-lg px-3 text-xs transition-colors',
                  tab === item.key
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <article className={proseClass}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({ children }) => {
                  const id = headingId(children)
                  return <h2 id={id}>{children}</h2>
                },
                h3: ({ children }) => {
                  const id = headingId(children)
                  return <h3 id={id}>{children}</h3>
                },
                a: ({ href, children }) => {
                  if (href?.startsWith('http')) {
                    return (
                      <a href={href} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    )
                  }
                  // 상대 md 링크는 앱 가이드 탭으로 유도
                  if (href?.includes('ONBOARDING')) {
                    return (
                      <button type="button" className="underline" onClick={() => selectTab('onboarding')}>
                        {children}
                      </button>
                    )
                  }
                  if (href?.includes('FEATURES')) {
                    return (
                      <button type="button" className="underline" onClick={() => selectTab('features')}>
                        {children}
                      </button>
                    )
                  }
                  if (href?.includes('TROUBLESHOOTING')) {
                    return (
                      <button
                        type="button"
                        className="underline"
                        onClick={() => selectTab('troubleshooting')}
                      >
                        {children}
                      </button>
                    )
                  }
                  return <a href={href}>{children}</a>
                },
              }}
            >
              {markdown}
            </ReactMarkdown>
          </article>
        </main>
      </div>

      {mobileNav && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal aria-label="목차">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="닫기"
            onClick={() => setMobileNav(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] overflow-y-auto border-r border-border bg-background p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">목차</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={t('common.close')}
                onClick={() => setMobileNav(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mb-4 flex flex-wrap gap-1">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectTab(item.key)}
                  className={cn(
                    'h-8 rounded-lg px-2.5 text-xs',
                    tab === item.key ? 'bg-muted font-medium' : 'text-muted-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {toc}
          </div>
        </div>
      )}
    </div>
  )
}
