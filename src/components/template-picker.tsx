/**
 * P56 — 템플릿 선택 + 커스텀 추가/삭제
 */
'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/i18n-provider'
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  type FolioTemplate,
  type TemplateKind,
} from '@/lib/templates'

export function TemplatePicker({
  kind,
  onApply,
  className,
}: {
  kind: TemplateKind
  onApply: (tpl: FolioTemplate) => void
  className?: string
}) {
  const { t } = useI18n()
  const [templates, setTemplates] = useState(() => listTemplates(kind))

  const reload = () => setTemplates(listTemplates(kind))

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">{t('templates.label')}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px]"
          onClick={() => {
            const name = window.prompt(t('templates.newName'))
            if (!name?.trim()) return
            const body = window.prompt(t('templates.newBody'), '') ?? ''
            createTemplate({ kind, name: name.trim(), body })
            reload()
          }}
        >
          <Plus className="mr-0.5 h-3 w-3" />
          {t('templates.add')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {templates.map((tpl) => (
          <div key={tpl.id} className="inline-flex items-center gap-0.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={() => onApply(tpl)}
            >
              {tpl.name}
              {tpl.builtin ? '' : ' *'}
            </Button>
            {!tpl.builtin ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                aria-label={t('common.delete')}
                onClick={() => {
                  deleteTemplate(tpl.id)
                  reload()
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
