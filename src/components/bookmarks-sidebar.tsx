/**
 * P56 — 북마크 빠른 접근 (사이드바)
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bookmark, FolderPlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/i18n-provider'
import {
  createFolder,
  deleteFolder,
  loadBookmarks,
  removeBookmark,
  type Bookmark as Bm,
} from '@/lib/bookmarks'
import { cn } from '@/lib/utils'

export type BookmarkNavigate = {
  kind: Bm['kind']
  targetId: string
}

export function BookmarksSidebar({
  onNavigate,
  className,
}: {
  onNavigate?: (payload: BookmarkNavigate) => void
  className?: string
}) {
  const { t } = useI18n()
  const [folders, setFolders] = useState(() => loadBookmarks().folders)
  const [items, setItems] = useState(() => loadBookmarks().items)
  const [folderId, setFolderId] = useState('default')

  const refresh = useCallback(() => {
    const store = loadBookmarks()
    setFolders(store.folders)
    setItems(store.items)
  }, [])

  useEffect(() => {
    const onStorage = () => refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener('folio:bookmarks', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('folio:bookmarks', onStorage)
    }
  }, [refresh])

  const visible = items.filter((b) => (b.folderId ?? 'default') === folderId)

  return (
    <section
      className={cn(
        'rounded-xl border border-gray-100 dark:border-gray-800 bg-card p-3',
        className,
      )}
      aria-label={t('bookmarks.title')}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Bookmark className="h-3.5 w-3.5" aria-hidden />
          {t('bookmarks.title')}
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={t('bookmarks.addFolder')}
          onClick={() => {
            const name = window.prompt(t('bookmarks.folderName'))
            if (!name?.trim()) return
            createFolder(name.trim())
            window.dispatchEvent(new Event('folio:bookmarks'))
            refresh()
          }}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[10px]',
              folderId === f.id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
            onClick={() => setFolderId(f.id)}
            onContextMenu={(e) => {
              if (f.id === 'default') return
              e.preventDefault()
              if (window.confirm(t('bookmarks.deleteFolderConfirm'))) {
                deleteFolder(f.id)
                setFolderId('default')
                window.dispatchEvent(new Event('folio:bookmarks'))
                refresh()
              }
            }}
          >
            {f.name}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{t('bookmarks.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {visible.slice(0, 12).map((b) => (
            <li key={b.id} className="flex items-center gap-1">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-[11px] hover:underline"
                onClick={() => onNavigate?.({ kind: b.kind, targetId: b.targetId })}
              >
                <span className="mr-1 text-[9px] uppercase text-muted-foreground">
                  {b.kind === 'journal' ? 'J' : b.kind === 'doc' ? 'D' : 'T'}
                </span>
                {b.title}
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                aria-label={t('common.delete')}
                onClick={() => {
                  removeBookmark(b.id)
                  window.dispatchEvent(new Event('folio:bookmarks'))
                  refresh()
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 북마크 변경 알림 (같은 탭) */
export function notifyBookmarksChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('folio:bookmarks'))
  }
}
