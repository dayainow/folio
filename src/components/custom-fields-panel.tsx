'use client'

/**
 * P51 — 커스텀 필드 편집/표시 패널
 */
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getFieldValues,
  groupFieldDefs,
  isFieldVisible,
  listFieldDefs,
  setFieldValue,
  subscribeCustomFields,
  type CustomFieldValue,
  type LocalFieldDef,
} from '@/lib/custom-fields'
import type { PluginEntity } from '@/lib/plugin-system'
import { cn } from '@/lib/utils'

export function CustomFieldsPanel({
  entity,
  recordId,
  className,
}: {
  entity: PluginEntity
  recordId: string
  className?: string
}) {
  const [defs, setDefs] = useState<LocalFieldDef[]>([])
  const [values, setValues] = useState<Record<string, CustomFieldValue>>({})

  const refresh = useCallback(() => {
    setDefs(listFieldDefs(entity))
    setValues(getFieldValues(entity, recordId))
  }, [entity, recordId])

  useEffect(() => {
    queueMicrotask(refresh)
    return subscribeCustomFields(refresh)
  }, [refresh])

  const groups = groupFieldDefs(defs.filter((d) => isFieldVisible(d, values)))
  if (groups.length === 0) return null

  return (
    <div className={cn('space-y-3 rounded-xl border border-border p-3', className)}>
      <p className="text-xs font-semibold">커스텀 필드</p>
      {groups.map(({ group, fields }) => (
        <div key={group} className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {group}
          </p>
          {fields.map((f) => (
            <FieldInput
              key={f.key}
              def={f}
              value={values[f.key] ?? null}
              onChange={(v) => {
                const next = setFieldValue(entity, recordId, f.key, v)
                setValues(next)
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function FieldInput({
  def,
  value,
  onChange,
}: {
  def: LocalFieldDef
  value: CustomFieldValue
  onChange: (v: CustomFieldValue) => void
}) {
  if (def.type === 'select') {
    return (
      <label className="flex flex-col gap-1 text-[11px]">
        <span>{def.label}</span>
        <select
          className="h-8 rounded-md border border-border bg-background px-2"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">—</option>
          {(def.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (def.type === 'multi-select') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="space-y-1 text-[11px]">
        <span>{def.label}</span>
        <div className="flex flex-wrap gap-1">
          {(def.options ?? []).map((o) => {
            const on = selected.includes(o)
            return (
              <Button
                key={o}
                type="button"
                size="sm"
                variant={on ? 'default' : 'outline'}
                className="h-7 text-[10px]"
                onClick={() => {
                  onChange(on ? selected.filter((x) => x !== o) : [...selected, o])
                }}
              >
                {o}
              </Button>
            )
          })}
        </div>
      </div>
    )
  }

  if (def.type === 'number') {
    return (
      <label className="flex flex-col gap-1 text-[11px]">
        <span>{def.label}</span>
        <Input
          type="number"
          className="h-8"
          value={typeof value === 'number' ? value : value === null ? '' : String(value)}
          onChange={(e) => {
            const n = e.target.value === '' ? null : Number(e.target.value)
            onChange(n !== null && Number.isFinite(n) ? n : null)
          }}
        />
      </label>
    )
  }

  if (def.type === 'date') {
    return (
      <label className="flex flex-col gap-1 text-[11px]">
        <span>{def.label}</span>
        <Input
          type="date"
          className="h-8"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </label>
    )
  }

  if (def.type === 'rich-text') {
    return (
      <label className="flex flex-col gap-1 text-[11px]">
        <span>{def.label}</span>
        <textarea
          className="min-h-[72px] rounded-md border border-border bg-background p-2 text-xs"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </label>
    )
  }

  return (
    <label className="flex flex-col gap-1 text-[11px]">
      <span>{def.label}</span>
      <Input
        className="h-8"
        value={typeof value === 'string' ? value : value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </label>
  )
}
