/**
 * P56 — 템플릿 선택 + 커스텀 추가/삭제
 */
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Sparkles, Trash2 } from 'lucide-react'
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
  const [expanded, setExpanded] = useState(false)

  const reload = () => setTemplates(listTemplates(kind))
  const builtin = templates.filter((template) => template.builtin)
  const custom = templates.filter((template) => !template.builtin)
  const visible = expanded ? templates : [...builtin.slice(0, 5), ...custom]

  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Sparkles className="h-3 w-3" aria-hidden />
          {t('templates.label')}
          <span className="font-normal">{templates.length}개</span>
        </p>
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
        {visible.map((tpl) => (
          <div key={tpl.id} className="inline-flex items-center gap-0.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              title={[tpl.category, ...(tpl.tags ?? [])].filter(Boolean).join(' · ')}
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
        {builtin.length > 5 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[10px] text-muted-foreground"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? '접기' : `더 보기 +${builtin.length - 5}`}
          </Button>
        )}
      </div>
    </div>
  )
}
