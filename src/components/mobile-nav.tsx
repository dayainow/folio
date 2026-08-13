'use client'

/**
 * P44/P57 — 하단 네비 + FAB · 동기화 뱃지 · 햅틱 · 활성 인디케이터
 */
import { useEffect, useState } from 'react'
import { BookOpen, FileText, Kanban, PenLine, Save, Plus, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n-provider'
import { hapticTap } from '@/lib/haptics'
import { countSyncQueue } from '@/lib/offline-db'

export type MobileTab = 'assistant' | 'journal' | 'docs' | 'board' | 'process'

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

/** P42/P44/P57 — 하단 네비 + 중앙 FAB 클러스터 */
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

  return (
    <nav
      aria-label={t('nav.mobileMain')}
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-gray-100 dark:border-gray-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      {pending > 0 ? (
        <p className="px-3 pt-1 text-center text-[10px] text-amber-700 dark:text-amber-400" role="status">
          오프라인 변경 {pending}건 동기화 대기
        </p>
      ) : null}
      <ul className="mx-auto grid h-[4.25rem] max-w-6xl grid-cols-5 items-end px-1">
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
                  'relative flex h-14 w-full min-h-[48px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:scale-[0.97]',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-1 h-0.5 w-5 rounded-full bg-foreground"
                  />
                ) : null}
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} aria-hidden />
                <span>{t(item.labelKey)}</span>
              </button>
            </li>
          )
        })}

        <li className="relative flex h-14 justify-center pb-1">
          <div className="absolute -top-7 flex items-end gap-2">
            {onSave && (
              <button
                type="button"
                onClick={() => {
                  hapticTap()
                  onSave()
                }}
                aria-label={t('common.quickSave')}
                className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-gray-200 bg-background text-foreground shadow-md dark:border-gray-700 active:scale-95"
              >
                <Save className="h-5 w-5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                hapticTap()
                if (onWrite) onWrite()
                else select('journal')
              }}
              aria-label={t('common.writeAria')}
              className="flex h-14 w-14 min-h-[48px] min-w-[48px] flex-col items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-4 ring-background transition-transform active:scale-95"
            >
              <PenLine className="h-5 w-5" aria-hidden />
              <span className="text-[9px] font-semibold leading-none">{t('common.write')}</span>
            </button>
            {onNew && (
              <button
                type="button"
                onClick={() => {
                  hapticTap()
                  onNew()
                }}
                aria-label={t('common.new')}
                className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-gray-200 bg-background text-foreground shadow-md dark:border-gray-700 active:scale-95"
              >
                <Plus className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>
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
                  'relative flex h-14 w-full min-h-[48px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors active:scale-[0.97]',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-1 h-0.5 w-5 rounded-full bg-foreground"
                  />
                ) : null}
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
