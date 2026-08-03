/**
 * P51 — 내부 플러그인 마켓플레이스 (레지스트리 · 설치 · 업데이트)
 */
'use client'

import {
  getPlugin,
  listPlugins,
  registerPlugin,
  resolvePluginDependencies,
  setPluginEnabled,
  unregisterPlugin,
  type PluginManifest,
  type RegisteredPlugin,
} from '@/lib/plugin-system'

export type MarketplaceEntry = PluginManifest & {
  tags?: string[]
  downloads?: number
  featured?: boolean
  changelog?: string
  /** 예제/문서 경로 */
  docsPath?: string
}

/** 내장 카탈로그 — docs/plugins 예제와 동기 */
export const MARKETPLACE_CATALOG: MarketplaceEntry[] = [
  {
    id: 'countdown',
    name: 'Countdown',
    version: '1.1.0',
    description: '목표일까지 남은 일수를 사이드바 위젯으로 표시',
    author: 'folio',
    tags: ['widget', 'productivity'],
    featured: true,
    downloads: 120,
    docsPath: 'docs/plugins/countdown',
    sandbox: 'none',
    contributes: {
      widgets: [
        {
          id: 'countdown-widget',
          title: '카운트다운',
          componentKey: 'CountdownWidget',
          layout: { width: 'md', order: 40, slot: 'sidebar' },
          dataSource: 'custom',
        },
      ],
      fields: [
        {
          id: 'countdown-deadline',
          entity: 'task',
          key: 'deadline',
          label: '마감일',
          type: 'date',
          group: '일정',
          order: 10,
        },
      ],
    },
  },
  {
    id: 'mood-tracker',
    name: 'Mood Tracker',
    version: '1.0.0',
    description: '일지에 기분(select) 커스텀 필드 + 요약 위젯',
    author: 'folio',
    tags: ['journal', 'fields'],
    featured: true,
    downloads: 86,
    docsPath: 'docs/plugins/mood-tracker',
    sandbox: 'none',
    contributes: {
      widgets: [
        {
          id: 'mood-widget',
          title: '오늘의 기분',
          componentKey: 'MoodWidget',
          layout: { width: 'sm', order: 50, slot: 'sidebar' },
          dataSource: 'journal',
        },
      ],
      fields: [
        {
          id: 'mood-field',
          entity: 'journal',
          key: 'mood',
          label: '기분',
          type: 'select',
          options: ['😊 좋음', '😐 보통', '😔 힘듦'],
          group: '웰빙',
          order: 5,
        },
        {
          id: 'mood-note',
          entity: 'journal',
          key: 'mood_note',
          label: '기분 메모',
          type: 'text',
          group: '웰빙',
          showWhen: { field: 'mood', equals: '😔 힘듦' },
          order: 6,
        },
      ],
    },
  },
  {
    id: 'estimate-points',
    name: 'Estimate Points',
    version: '1.0.2',
    description: '보드 카드에 스토리 포인트(number) 필드 추가',
    author: 'folio',
    tags: ['board', 'fields'],
    downloads: 64,
    docsPath: 'docs/plugins/estimate-points',
    sandbox: 'none',
    dependencies: {},
    contributes: {
      fields: [
        {
          id: 'story-points',
          entity: 'task',
          key: 'story_points',
          label: '스토리 포인트',
          type: 'number',
          group: '추정',
          order: 20,
        },
      ],
    },
  },
  {
    id: 'sandbox-echo',
    name: 'Sandbox Echo',
    version: '1.0.0',
    description: 'Web Worker 샌드박스 데모 (입력 에코)',
    author: 'folio',
    tags: ['sandbox', 'demo'],
    downloads: 12,
    docsPath: 'docs/plugins/sandbox-echo',
    sandbox: 'worker',
    contributes: {
      widgets: [
        {
          id: 'sandbox-echo-widget',
          title: 'Sandbox Echo',
          componentKey: 'SandboxEchoWidget',
          layout: { width: 'md', order: 90, slot: 'sidebar' },
          dataSource: 'custom',
        },
      ],
    },
  },
]

export function searchMarketplace(query: string, tag?: string): MarketplaceEntry[] {
  const q = query.trim().toLowerCase()
  return MARKETPLACE_CATALOG.filter((e) => {
    if (tag && !(e.tags ?? []).includes(tag)) return false
    if (!q) return true
    return (
      e.id.includes(q) ||
      e.name.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.tags ?? []).some((t) => t.includes(q))
    )
  }).sort((a, b) => Number(b.featured) - Number(a.featured) || (b.downloads ?? 0) - (a.downloads ?? 0))
}

export function getMarketplaceEntry(id: string): MarketplaceEntry | undefined {
  return MARKETPLACE_CATALOG.find((e) => e.id === id)
}

export type InstallResult =
  | { ok: true; plugin: RegisteredPlugin; updated: boolean }
  | { ok: false; reason: string; missing?: string[] }

/** 카탈로그에서 설치 또는 버전 업데이트 */
export function installFromMarketplace(id: string): InstallResult {
  const entry = getMarketplaceEntry(id)
  if (!entry) return { ok: false, reason: 'not_found' }

  const deps = resolvePluginDependencies(entry)
  if (!deps.ok) return { ok: false, reason: 'unmet_dependencies', missing: deps.missing }

  const existing = getPlugin(id)
  const updated = Boolean(existing && existing.version !== entry.version)

  const { tags, downloads, featured, changelog, docsPath, ...manifest } = entry
  void tags
  void downloads
  void featured
  void changelog
  void docsPath
  const plugin = registerPlugin(manifest, {
    source: 'marketplace',
    enabled: existing?.enabled ?? true,
  })

  return { ok: true, plugin, updated }
}

export function uninstallPlugin(id: string): boolean {
  // builtin도 비활성화만 하고 싶을 수 있음 — 완전 제거
  return unregisterPlugin(id)
}

export function updatePlugin(id: string): InstallResult {
  const entry = getMarketplaceEntry(id)
  if (!entry) return { ok: false, reason: 'not_found' }
  const current = getPlugin(id)
  if (!current) return installFromMarketplace(id)
  if (current.version === entry.version) {
    return { ok: true, plugin: current, updated: false }
  }
  return installFromMarketplace(id)
}

export function listInstalledWithUpdates(): Array<{
  plugin: RegisteredPlugin
  latest?: string
  updateAvailable: boolean
}> {
  return listPlugins().map((plugin) => {
    const entry = getMarketplaceEntry(plugin.id)
    const latest = entry?.version
    return {
      plugin,
      latest,
      updateAvailable: Boolean(latest && latest !== plugin.version),
    }
  })
}

export { setPluginEnabled, listPlugins }
