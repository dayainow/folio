'use client'

import { BookOpen, FileText, Kanban, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MobileTab = 'journal' | 'docs' | 'board' | 'process'

const ITEMS: Array<{ value: MobileTab; label: string; icon: typeof BookOpen }> = [
  { value: 'journal', label: '일지', icon: BookOpen },
  { value: 'docs', label: '문서', icon: FileText },
  { value: 'board', label: '일정', icon: Kanban },
  { value: 'process', label: '프로세스', icon: Activity },
]

export function MobileNav({
  value,
  onChange,
}: {
  value: MobileTab
  onChange: (tab: MobileTab) => void
}) {
  return (
    <nav
      aria-label="모바일 주요 패널"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-gray-100 dark:border-gray-800 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4 h-14 max-w-6xl mx-auto">
        {ITEMS.map((item) => {
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
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
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
