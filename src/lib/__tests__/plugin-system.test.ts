/**
 * P51 — 플러그인 시스템 · 마켓 · 커스텀 필드 · 샌드박스 테스트
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetPluginSystemForTests,
  getEnabledFields,
  getEnabledWidgets,
  listPlugins,
  onPluginHook,
  registerPlugin,
  resolvePluginDependencies,
  semverGte,
  setPluginEnabled,
  setWidgetSettings,
  unregisterPlugin,
} from '@/lib/plugin-system'
import {
  installFromMarketplace,
  searchMarketplace,
  uninstallPlugin,
  updatePlugin,
  MARKETPLACE_CATALOG,
} from '@/lib/plugin-marketplace'
import {
  __resetCustomFieldsForTests,
  getFieldValues,
  isFieldVisible,
  listFieldDefs,
  setFieldValue,
  upsertLocalFieldDef,
} from '@/lib/custom-fields'
import { runSandboxed } from '@/lib/plugin-sandbox'
import { __resetBootstrapFlagForTests, bootstrapBuiltinPlugins } from '@/plugins'

describe('plugin-system', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetPluginSystemForTests()
    __resetCustomFieldsForTests()
    __resetBootstrapFlagForTests()
  })

  it('registers enables disables and unloads plugins', async () => {
    const events: string[] = []
    onPluginHook('demo', 'onLoad', () => {
      events.push('load')
    })
    onPluginHook('demo', 'onEnable', () => {
      events.push('enable')
    })
    onPluginHook('demo', 'onDisable', () => {
      events.push('disable')
    })
    onPluginHook('demo', 'onUnload', () => {
      events.push('unload')
    })

    registerPlugin(
      {
        id: 'demo',
        name: 'Demo',
        version: '1.0.0',
        contributes: {
          widgets: [
            {
              id: 'demo-w',
              title: 'Demo W',
              componentKey: 'CountdownWidget',
              layout: { order: 1 },
            },
          ],
        },
      },
      { enabled: true },
    )

    expect(listPlugins()).toHaveLength(1)
    expect(getEnabledWidgets()).toHaveLength(1)

    setPluginEnabled('demo', false)
    expect(getEnabledWidgets()).toHaveLength(0)

    unregisterPlugin('demo')
    expect(listPlugins()).toHaveLength(0)
    expect(events).toContain('load')
    expect(events).toContain('enable')
    expect(events).toContain('disable')
    expect(events).toContain('unload')
  })

  it('resolves semver and dependencies', () => {
    expect(semverGte('1.2.0', '1.1.0')).toBe(true)
    expect(semverGte('1.0.0', '1.1.0')).toBe(false)
    registerPlugin({ id: 'base', name: 'Base', version: '1.0.0' }, { enabled: true })
    const ok = resolvePluginDependencies({
      id: 'child',
      name: 'Child',
      version: '1.0.0',
      dependencies: { base: '^1.0.0' },
    })
    expect(ok.ok).toBe(true)
    const bad = resolvePluginDependencies({
      id: 'child2',
      name: 'Child2',
      version: '1.0.0',
      dependencies: { missing: '^1.0.0' },
    })
    expect(bad.ok).toBe(false)
    expect(bad.missing[0]).toContain('missing')
  })

  it('persists widget settings', () => {
    registerPlugin({
      id: 'w',
      name: 'W',
      version: '1.0.0',
      contributes: {
        widgets: [{ id: 'wid', title: 'W', componentKey: 'MoodWidget', layout: { order: 10 } }],
      },
    })
    setWidgetSettings('wid', { width: 'lg', order: 2 })
    const w = getEnabledWidgets().find((x) => x.id === 'wid')
    expect(w?.layout?.width).toBe('lg')
    expect(w?.layout?.order).toBe(2)
  })
})

describe('marketplace', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetPluginSystemForTests()
    __resetBootstrapFlagForTests()
  })

  it('searches and installs from catalog', () => {
    const hits = searchMarketplace('mood')
    expect(hits.some((h) => h.id === 'mood-tracker')).toBe(true)
    expect(MARKETPLACE_CATALOG.length).toBeGreaterThan(2)

    const r = installFromMarketplace('countdown')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.plugin.id).toBe('countdown')
      expect(getEnabledWidgets().some((w) => w.id === 'countdown-widget')).toBe(true)
      expect(getEnabledFields('task').some((f) => f.key === 'deadline')).toBe(true)
    }

    const again = updatePlugin('countdown')
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.updated).toBe(false)

    expect(uninstallPlugin('countdown')).toBe(true)
    expect(listPlugins().find((p) => p.id === 'countdown')).toBeUndefined()
  })

  it('bootstraps featured builtins once', () => {
    bootstrapBuiltinPlugins()
    bootstrapBuiltinPlugins()
    const featured = MARKETPLACE_CATALOG.filter((e) => e.featured)
    for (const f of featured) {
      expect(listPlugins().some((p) => p.id === f.id)).toBe(true)
    }
  })
})

describe('custom-fields', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetPluginSystemForTests()
    __resetCustomFieldsForTests()
  })

  it('stores values and evaluates showWhen', () => {
    upsertLocalFieldDef({
      id: 'u1',
      entity: 'journal',
      key: 'mood',
      label: '기분',
      type: 'select',
      options: ['좋음', '힘듦'],
    })
    upsertLocalFieldDef({
      id: 'u2',
      entity: 'journal',
      key: 'mood_note',
      label: '메모',
      type: 'text',
      showWhen: { field: 'mood', equals: '힘듦' },
    })

    setFieldValue('journal', '2026-08-04', 'mood', '힘듦')
    const values = getFieldValues('journal', '2026-08-04')
    const defs = listFieldDefs('journal')
    const note = defs.find((d) => d.key === 'mood_note')!
    expect(isFieldVisible(note, values)).toBe(true)
    expect(isFieldVisible(note, { mood: '좋음' })).toBe(false)
  })
})

describe('sandbox', () => {
  it('runs none mode sync', async () => {
    const r = await runSandboxed('none', 'function run(input){ return input * 2 }', 21)
    expect(r.ok).toBe(true)
    expect(r.result).toBe(42)
  })
})
