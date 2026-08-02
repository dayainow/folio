'use client'

import { BookOpen, FileText, Kanban, Activity, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MobileTab = 'journal' | 'docs' | 'board' | 'process'

const SIDE_ITEMS: Array<{ value: MobileTab; label: string; icon: typeof BookOpen }> = [
  { value: 'journal', label: '일지', icon: BookOpen },
  { value: 'docs', label: '문서', icon: FileText },
  { value: 'board', label: '일정', icon: Kanban },
  { value: 'process', label: '프로세스', icon: Activity },
]

/** P42 — 하단 네비 + 중앙 글쓰기 바로가기 */
export function MobileNav({
  value,
  onChange,
  onWrite,
}: {
  value: MobileTab
  onChange: (tab: MobileTab) => void
  /** 글쓰기 FAB — 미지정 시 journal 탭으로 이동 */
  onWrite?: () => void
}) {
  const left = SIDE_ITEMS.slice(0, 2)
  const right = SIDE_ITEMS.slice(2)

  return (
    <nav
      aria-label="모바일 주요 패널"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-gray-100 dark:border-gray-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid h-16 max-w-6xl grid-cols-5 items-end px-1">
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
                  'flex h-14 w-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} aria-hidden />
                <span>{item.label}</span>
              </button>
            </li>
          )
        })}

        <li className="relative flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (onWrite) onWrite()
              else onChange('journal')
            }}
            aria-label="글쓰기"
            className="absolute -top-5 flex h-14 w-14 min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-4 ring-background transition-transform active:scale-95"
          >
            <PenLine className="h-5 w-5" aria-hidden />
            <span className="text-[9px] font-semibold leading-none">쓰기</span>
          </button>
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
                  'flex h-14 w-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} aria-hidden />
                <span>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
