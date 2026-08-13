/**
 * P56 — Quick Capture: Cmd/Ctrl+Shift+N 일지 즉시 입력
 */
'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/i18n-provider'
import { useEscapeToClose, useFocusTrap, announceToScreenReader } from '@/lib/a11y'
import { saveJournalWithFallback } from '@/lib/journal'
import { createJournalEntryKey, localDateKey } from '@/lib/personal-assistant'
import { listTemplates, type FolioTemplate } from '@/lib/templates'
import { cn } from '@/lib/utils'

export function QuickCaptureModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved?: (entryKey: string) => void
}) {
  const { t } = useI18n()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const templates = listTemplates('journal')

  const handleClose = useCallback(() => {
    setText('')
    setTemplateId('')
    onClose()
  }, [onClose])

  useEscapeToClose(open, handleClose)
  useFocusTrap(open, panelRef)

  useEffect(() => {
    if (!open) return
    const handle = window.setTimeout(() => textareaRef.current?.focus(), 30)
    return () => window.clearTimeout(handle)
  }, [open])

  const applyTemplate = (tpl: FolioTemplate) => {
    setTemplateId(tpl.id)
    setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${tpl.body}` : tpl.body))
  }

  const save = useCallback(async () => {
    const content = text.trim()
    if (!content || saving) return
    setSaving(true)
    const date = localDateKey()
    try {
      const tpl = templates.find((x) => x.id === templateId)
      const nextTags = Array.from(new Set(tpl?.tags ?? []))
      const entryKey = createJournalEntryKey(date)
      await saveJournalWithFallback(date, content, nextTags, entryKey)
      window.dispatchEvent(new CustomEvent('folio-journals-changed'))
      announceToScreenReader(t('capture.saved'))
      onSaved?.(entryKey)
      setText('')
      setTemplateId('')
      onClose()
    } finally {
      setSaving(false)
    }
  }, [text, saving, templateId, templates, onClose, onSaved, t])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'w-full max-w-lg rounded-xl border border-border bg-background p-4 shadow-xl',
          'outline-none',
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {t('capture.title')}
            </h2>
            <p className="text-[11px] text-muted-foreground">{t('capture.hint')}</p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={handleClose}
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {templates.map((tpl) => (
            <Button
              key={tpl.id}
              type="button"
              size="sm"
              variant={templateId === tpl.id ? 'default' : 'outline'}
              className="h-7 px-2 text-[11px]"
              onClick={() => applyTemplate(tpl)}
            >
              {tpl.name}
            </Button>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={t('capture.placeholder')}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              void save()
            }
          }}
        />

        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!text.trim() || saving}
            onClick={() => void save()}
          >
            {saving ? t('common.loading') : t('capture.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
