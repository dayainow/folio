/**
 * P51 — 커스텀 필드 (문서/일지/보드)
 */
'use client'

import {
  getEnabledFields,
  type PluginEntity,
  type PluginFieldContribution,
  type PluginFieldType,
} from '@/lib/plugin-system'

export type CustomFieldValue = string | number | boolean | string[] | null

export type CustomFieldValues = Record<string, CustomFieldValue>

const VALUES_KEY = 'folio_custom_field_values'
const DEFS_KEY = 'folio_custom_field_defs'
const EVENT = 'folio-custom-fields'

export type LocalFieldDef = {
  id: string
  entity: PluginEntity
  key: string
  label: string
  type: PluginFieldType
  options?: string[]
  group?: string
  showWhen?: { field: string; equals: string | number | boolean }
  required?: boolean
  order?: number
  source: 'user' | 'plugin'
  pluginId?: string
}

type ValuesStore = Record<string, CustomFieldValues> // `${entity}:${recordId}` → values

function readValues(): ValuesStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(VALUES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ValuesStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeValues(store: ValuesStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VALUES_KEY, JSON.stringify(store))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* ignore */
  }
}

function readLocalDefs(): LocalFieldDef[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DEFS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LocalFieldDef[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalDefs(defs: LocalFieldDef[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DEFS_KEY, JSON.stringify(defs))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* ignore */
  }
}

function recordKey(entity: PluginEntity, recordId: string): string {
  return `${entity}:${recordId}`
}

/** 플러그인 + 사용자 정의 필드 병합 */
export function listFieldDefs(entity: PluginEntity): LocalFieldDef[] {
  const fromPlugins: LocalFieldDef[] = getEnabledFields(entity).map((f) => ({
    id: f.id,
    entity: f.entity,
    key: f.key,
    label: f.label,
    type: f.type,
    options: f.options,
    group: f.group,
    showWhen: f.showWhen,
    required: f.required,
    order: f.order,
    source: 'plugin' as const,
    pluginId: f.pluginId,
  }))
  const local = readLocalDefs().filter((d) => d.entity === entity)
  const byKey = new Map<string, LocalFieldDef>()
  for (const d of [...fromPlugins, ...local]) {
    byKey.set(d.key, d)
  }
  return [...byKey.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

export function upsertLocalFieldDef(def: Omit<LocalFieldDef, 'source'> & { source?: 'user' }): LocalFieldDef {
  const next: LocalFieldDef = { ...def, source: 'user' }
  const all = readLocalDefs().filter((d) => !(d.entity === def.entity && d.key === def.key))
  all.push(next)
  writeLocalDefs(all)
  return next
}

export function removeLocalFieldDef(entity: PluginEntity, key: string): void {
  writeLocalDefs(readLocalDefs().filter((d) => !(d.entity === entity && d.key === key)))
}

export function getFieldValues(entity: PluginEntity, recordId: string): CustomFieldValues {
  return { ...(readValues()[recordKey(entity, recordId)] ?? {}) }
}

export function setFieldValue(
  entity: PluginEntity,
  recordId: string,
  key: string,
  value: CustomFieldValue,
): CustomFieldValues {
  const store = readValues()
  const rk = recordKey(entity, recordId)
  const cur = { ...(store[rk] ?? {}) }
  if (value === null || value === undefined || value === '') {
    delete cur[key]
  } else {
    cur[key] = value
  }
  store[rk] = cur
  writeValues(store)
  return cur
}

export function setFieldValues(
  entity: PluginEntity,
  recordId: string,
  values: CustomFieldValues,
): CustomFieldValues {
  const store = readValues()
  store[recordKey(entity, recordId)] = { ...values }
  writeValues(store)
  return values
}

/** 조건부 표시 평가 */
export function isFieldVisible(def: LocalFieldDef | PluginFieldContribution, values: CustomFieldValues): boolean {
  if (!def.showWhen) return true
  const current = values[def.showWhen.field]
  return current === def.showWhen.equals
}

/** 그룹별로 묶기 */
export function groupFieldDefs(defs: LocalFieldDef[]): Array<{ group: string; fields: LocalFieldDef[] }> {
  const map = new Map<string, LocalFieldDef[]>()
  for (const d of defs) {
    const g = d.group?.trim() || '기본'
    const list = map.get(g) ?? []
    list.push(d)
    map.set(g, list)
  }
  return [...map.entries()].map(([group, fields]) => ({ group, fields }))
}

export function subscribeCustomFields(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const on = () => listener()
  window.addEventListener(EVENT, on)
  return () => window.removeEventListener(EVENT, on)
}

export function __resetCustomFieldsForTests(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(VALUES_KEY)
  localStorage.removeItem(DEFS_KEY)
}
