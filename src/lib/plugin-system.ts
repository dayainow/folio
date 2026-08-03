/**
 * P51 — Folio 플러그인 시스템 (등록 · lifecycle · 활성화)
 */
'use client'

export type PluginEntity = 'journal' | 'doc' | 'task'

export type PluginFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'rich-text'

export type PluginLifecycleHook =
  | 'onLoad'
  | 'onUnload'
  | 'onEnable'
  | 'onDisable'
  | 'onInstall'
  | 'onUpdate'

export type PluginWidgetLayout = {
  width?: 'sm' | 'md' | 'lg' | 'full'
  order?: number
  /** 사이드바 슬롯 */
  slot?: 'sidebar' | 'panel'
}

export type PluginWidgetContribution = {
  id: string
  title: string
  description?: string
  layout?: PluginWidgetLayout
  /** 데이터 소스 힌트 (위젯 설정 UI) */
  dataSource?: 'journal' | 'board' | 'docs' | 'beacon' | 'custom'
  /** React 컴포넌트 키 — host가 맵핑 */
  componentKey: string
}

export type PluginFieldContribution = {
  id: string
  entity: PluginEntity
  key: string
  label: string
  type: PluginFieldType
  options?: string[]
  group?: string
  /** 조건부 표시: 다른 필드 key === value */
  showWhen?: { field: string; equals: string | number | boolean }
  required?: boolean
  order?: number
}

/** package.json `folio` 블록과 동일한 매니페스트 */
export type PluginManifest = {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  /** npm 스타일 의존성 (다른 플러그인 id → semver range 간단 해석) */
  dependencies?: Record<string, string>
  permissions?: Array<'storage' | 'network' | 'notify'>
  sandbox?: 'none' | 'worker' | 'iframe'
  contributes?: {
    widgets?: PluginWidgetContribution[]
    fields?: PluginFieldContribution[]
  }
}

export type RegisteredPlugin = PluginManifest & {
  enabled: boolean
  installedAt: string
  updatedAt: string
  source: 'builtin' | 'marketplace' | 'local'
}

type HookHandler = (pluginId: string) => void | Promise<void>

const STATE_KEY = 'folio_plugins_state'
const EVENT = 'folio-plugins'

type PluginStateFile = {
  enabled: Record<string, boolean>
  installed: RegisteredPlugin[]
  widgetSettings: Record<
    string,
    { width?: PluginWidgetLayout['width']; order?: number; dataSource?: string }
  >
}

const registry = new Map<string, RegisteredPlugin>()
const hooks = new Map<PluginLifecycleHook, Map<string, HookHandler>>()
const componentKeys = new Map<string, string>() // widgetId → componentKey

function emptyState(): PluginStateFile {
  return { enabled: {}, installed: [], widgetSettings: {} }
}

function readState(): PluginStateFile {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as PluginStateFile
    return {
      enabled: parsed.enabled ?? {},
      installed: Array.isArray(parsed.installed) ? parsed.installed : [],
      widgetSettings: parsed.widgetSettings ?? {},
    }
  } catch {
    return emptyState()
  }
}

function writeState(state: PluginStateFile): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* quota */
  }
}

async function runHook(hook: PluginLifecycleHook, pluginId: string): Promise<void> {
  const byPlugin = hooks.get(hook)
  const handler = byPlugin?.get(pluginId)
  if (!handler) return
  await handler(pluginId)
}

/** lifecycle 훅 등록 */
export function onPluginHook(
  pluginId: string,
  hook: PluginLifecycleHook,
  handler: HookHandler,
): () => void {
  if (!hooks.has(hook)) hooks.set(hook, new Map())
  hooks.get(hook)!.set(pluginId, handler)
  return () => {
    hooks.get(hook)?.delete(pluginId)
  }
}

/** 플러그인 등록 (builtin bootstrap / install) */
export function registerPlugin(
  manifest: PluginManifest,
  opts?: { source?: RegisteredPlugin['source']; enabled?: boolean },
): RegisteredPlugin {
  const state = readState()
  const existing = registry.get(manifest.id) ?? state.installed.find((p) => p.id === manifest.id)
  const now = new Date().toISOString()
  const enabled =
    opts?.enabled ??
    state.enabled[manifest.id] ??
    existing?.enabled ??
    true

  const registered: RegisteredPlugin = {
    ...manifest,
    enabled,
    installedAt: existing?.installedAt ?? now,
    updatedAt: now,
    source: opts?.source ?? existing?.source ?? 'builtin',
  }

  registry.set(manifest.id, registered)

  for (const w of manifest.contributes?.widgets ?? []) {
    componentKeys.set(w.id, w.componentKey)
  }

  const installed = state.installed.filter((p) => p.id !== manifest.id)
  installed.push(registered)
  state.installed = installed
  state.enabled[manifest.id] = enabled
  writeState(state)

  void runHook('onLoad', manifest.id)
  if (enabled) void runHook('onEnable', manifest.id)

  return registered
}

export function unregisterPlugin(id: string): boolean {
  const p = registry.get(id) ?? readState().installed.find((x) => x.id === id)
  if (!p) return false
  void runHook('onUnload', id)
  registry.delete(id)
  for (const w of p.contributes?.widgets ?? []) {
    componentKeys.delete(w.id)
  }
  const state = readState()
  state.installed = state.installed.filter((x) => x.id !== id)
  delete state.enabled[id]
  writeState(state)
  return true
}

export function setPluginEnabled(id: string, enabled: boolean): RegisteredPlugin | null {
  const state = readState()
  const p = registry.get(id) ?? state.installed.find((x) => x.id === id)
  if (!p) return null

  const next = { ...p, enabled, updatedAt: new Date().toISOString() }
  registry.set(id, next)
  state.enabled[id] = enabled
  state.installed = state.installed.map((x) => (x.id === id ? next : x))
  writeState(state)

  void runHook(enabled ? 'onEnable' : 'onDisable', id)
  return next
}

export function listPlugins(): RegisteredPlugin[] {
  const state = readState()
  const map = new Map<string, RegisteredPlugin>()
  for (const p of state.installed) map.set(p.id, p)
  for (const [id, p] of registry) map.set(id, p)
  // sync enabled from state
  return [...map.values()]
    .map((p) => ({
      ...p,
      enabled: state.enabled[p.id] ?? p.enabled,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getPlugin(id: string): RegisteredPlugin | undefined {
  return listPlugins().find((p) => p.id === id)
}

export function getEnabledWidgets(): Array<
  PluginWidgetContribution & { pluginId: string; settings: PluginStateFile['widgetSettings'][string] }
> {
  const state = readState()
  const out: Array<
    PluginWidgetContribution & {
      pluginId: string
      settings: PluginStateFile['widgetSettings'][string]
    }
  > = []
  for (const p of listPlugins()) {
    if (!p.enabled) continue
    for (const w of p.contributes?.widgets ?? []) {
      const settings = state.widgetSettings[w.id] ?? {}
      out.push({
        ...w,
        pluginId: p.id,
        settings,
        layout: {
          ...w.layout,
          width: settings.width ?? w.layout?.width,
          order: settings.order ?? w.layout?.order ?? 100,
        },
      })
    }
  }
  return out.sort((a, b) => (a.layout?.order ?? 100) - (b.layout?.order ?? 100))
}

export function getEnabledFields(entity?: PluginEntity): Array<
  PluginFieldContribution & { pluginId: string }
> {
  const out: Array<PluginFieldContribution & { pluginId: string }> = []
  for (const p of listPlugins()) {
    if (!p.enabled) continue
    for (const f of p.contributes?.fields ?? []) {
      if (entity && f.entity !== entity) continue
      out.push({ ...f, pluginId: p.id })
    }
  }
  return out.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

export function getWidgetComponentKey(widgetId: string): string | undefined {
  return componentKeys.get(widgetId)
}

export function setWidgetSettings(
  widgetId: string,
  settings: Partial<PluginStateFile['widgetSettings'][string]>,
): void {
  const state = readState()
  state.widgetSettings[widgetId] = {
    ...state.widgetSettings[widgetId],
    ...settings,
  }
  writeState(state)
}

export function getWidgetSettings(
  widgetId: string,
): PluginStateFile['widgetSettings'][string] {
  return readState().widgetSettings[widgetId] ?? {}
}

/** 간단 semver 비교: a >= b */
export function semverGte(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map((x) => Number(x) || 0)
  const pb = b.replace(/^v/, '').split('.').map((x) => Number(x) || 0)
  for (let i = 0; i < 3; i += 1) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return true
}

/** 의존성 해석 — 미충족 플러그인 id 목록 */
export function resolvePluginDependencies(manifest: PluginManifest): {
  ok: boolean
  missing: string[]
} {
  const missing: string[] = []
  const deps = manifest.dependencies ?? {}
  const installed = listPlugins()
  for (const [depId, range] of Object.entries(deps)) {
    const min = range.replace(/^[\^~>=\s]+/, '')
    const found = installed.find((p) => p.id === depId && p.enabled)
    if (!found || !semverGte(found.version, min)) {
      missing.push(`${depId}@${range}`)
    }
  }
  return { ok: missing.length === 0, missing }
}

export function subscribePlugins(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const on = () => listener()
  window.addEventListener(EVENT, on)
  window.addEventListener('storage', (e) => {
    if (e.key === STATE_KEY) on()
  })
  return () => window.removeEventListener(EVENT, on)
}

/** 테스트용 — 레지스트리/스토리지 초기화 */
export function __resetPluginSystemForTests(): void {
  registry.clear()
  hooks.clear()
  componentKeys.clear()
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STATE_KEY)
  }
}
