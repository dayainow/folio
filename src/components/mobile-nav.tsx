'use client'

/**
 * P44 — 하단 네비 + FAB (저장 / 새 작성) · 터치 48px
 */
import { BookOpen, FileText, Kanban, Activity, PenLine, Save, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n-provider'

export type MobileTab = 'journal' | 'docs' | 'board' | 'process'

const SIDE_ITEMS: Array<{
  value: MobileTab
  labelKey: string
  icon: typeof BookOpen
}> = [
  { value: 'journal', labelKey: 'nav.journal', icon: BookOpen },
  { value: 'docs', labelKey: 'nav.docs', icon: FileText },
  { value: 'board', labelKey: 'nav.board', icon: Kanban },
  { value: 'process', labelKey: 'nav.process', icon: Activity },
]

/** P42/P44 — 하단 네비 + 중앙 FAB 클러스터 */
export function MobileNav({
  value,
  onChange,
  onWrite,
  onSave,
  onNew,
  hidden,
}: {
  value: MobileTab
  onChange: (tab: MobileTab) => void
  /** 글쓰기 — 미지정 시 journal */
  onWrite?: () => void
  /** 빠른 저장 */
  onSave?: () => void
  /** 새 일지/문서 */
  onNew?: () => void
  /** 풀스크린 시 숨김 */
  hidden?: boolean
}) {
  const { t } = useI18n()
  const left = SIDE_ITEMS.slice(0, 2)
  const right = SIDE_ITEMS.slice(2)

  if (hidden) return null

  return (
    <nav
      aria-label={t('nav.mobileMain')}
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-gray-100 dark:border-gray-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid h-[4.25rem] max-w-6xl grid-cols-5 items-end px-1">
        {left.map((item) => {
          const Icon = item.icon
          const active = value === item.value
          return (
            <li key={item.value}>
              <button
                type="button"
                onClick={() => onChange(item.value)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 w-full min-h-[48px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} aria-hidden />
                <span>{t(item.labelKey)}</span>
              </button>
            </li>
          )
        })}

        <li className="relative flex justify-center pb-1">
          <div className="absolute -top-7 flex items-end gap-2">
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                aria-label={t('common.quickSave')}
                className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-full border border-gray-200 bg-background text-foreground shadow-md dark:border-gray-700 active:scale-95"
              >
                <Save className="h-5 w-5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (onWrite) onWrite()
                else onChange('journal')
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
                onClick={onNew}
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
                onClick={() => onChange(item.value)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 w-full min-h-[48px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
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
