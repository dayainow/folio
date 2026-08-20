'use client'

/**
 * P44/P57 — 하단 네비 · 문맥 행동 · 동기화 뱃지 · 햅틱
 */
import { useEffect, useState } from 'react'
import { BookOpen, FileText, Kanban, PenLine, Save, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n-provider'
import { hapticTap } from '@/lib/haptics'
import { countSyncQueue } from '@/lib/offline-db'

export type MobileTab = 'assistant' | 'projects' | 'journal' | 'docs' | 'board' | 'process'

const SIDE_ITEMS: Array<{
  value: MobileTab
  labelKey: string
  icon: typeof BookOpen
}> = [
  { value: 'assistant', labelKey: 'nav.assistant', icon: Sparkles },
  { value: 'journal', labelKey: 'nav.journal', icon: BookOpen },
  { value: 'docs', labelKey: 'nav.docs', icon: FileText },
  { value: 'board', labelKey: 'nav.board', icon: Kanban },
]

/** P42/P44/P57 — 하단 네비 + 화면에 맞는 중앙 행동 */
export function MobileNav({
  value,
  onChange,
  onWrite,
  onSave,
  onNew,
  hidden,
  pendingSync,
}: {
  value: MobileTab
  onChange: (tab: MobileTab) => void
  onWrite?: () => void
  onSave?: () => void
  onNew?: () => void
  hidden?: boolean
  /** 외부에서 주입하지 않으면 큐 카운트 구독 */
  pendingSync?: number
}) {
  const { t } = useI18n()
  const left = SIDE_ITEMS.slice(0, 2)
  const right = SIDE_ITEMS.slice(2)
  const [pendingLocal, setPendingLocal] = useState(0)
  const pending = typeof pendingSync === 'number' ? pendingSync : pendingLocal

  useEffect(() => {
    if (typeof pendingSync === 'number') return
    const refresh = () => {
      void countSyncQueue()
        .then(setPendingLocal)
        .catch(() => setPendingLocal(0))
    }
    const handle = window.setTimeout(refresh, 0)
    window.addEventListener('folio-sync-queue', refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.clearTimeout(handle)
      window.removeEventListener('folio-sync-queue', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [pendingSync])

  if (hidden) return null

  const select = (tab: MobileTab) => {
    hapticTap()
    onChange(tab)
  }

  const centerAction = value === 'journal' && onSave
    ? {
        label: t('common.quickSave'),
        icon: Save,
        run: onSave,
      }
    : value === 'docs' && onNew
      ? {
          label: t('common.new'),
          icon: Plus,
          run: onNew,
        }
      : {
          label: t('common.writeAria'),
          icon: PenLine,
          run: onWrite ?? (() => onChange('journal')),
        }
  const CenterActionIcon = centerAction.icon

  return (
    <nav
      aria-label={t('nav.mobileMain')}
      className="folio-mobile-nav fixed inset-x-3 bottom-[calc(0.65rem+env(safe-area-inset-bottom))] z-50 rounded-[1.4rem] border bg-background/90 shadow-lg backdrop-blur-xl md:hidden"
    >
      {pending > 0 ? (
        <p className="border-b px-3 py-1 text-center text-[10px] text-amber-700 dark:text-amber-400" role="status">
          오프라인 변경 {pending}건 동기화 대기
        </p>
      ) : null}
      <ul className="mx-auto grid h-16 max-w-6xl grid-cols-5 items-center px-1.5">
        {left.map((item) => {
          const Icon = item.icon
          const active = value === item.value
          return (
            <li key={item.value}>
              <button
                type="button"
                onClick={() => select(item.value)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-12 w-full min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors active:scale-[0.97]',
                  active ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} aria-hidden />
                <span>{t(item.labelKey)}</span>
              </button>
            </li>
          )
        })}

        <li className="relative flex h-12 justify-center">
          <button
            type="button"
            onClick={() => {
              hapticTap()
              centerAction.run()
            }}
            aria-label={centerAction.label}
            className="absolute -top-3 flex size-14 min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-[5px] ring-background transition-transform active:scale-95"
          >
            <CenterActionIcon className="size-5" aria-hidden />
          </button>
        </li>

        {right.map((item) => {
          const Icon = item.icon
          const active = value === item.value
          return (
            <li key={item.value}>
              <button
                type="button"
                onClick={() => select(item.value)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-12 w-full min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors active:scale-[0.97]',
                  active ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} aria-hidden />
                <span>{t(item.labelKey)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
