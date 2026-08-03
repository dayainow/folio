/**
 * P51 — builtin 플러그인 부트스트랩 (카탈로그에서 기본 설치)
 */
'use client'

import { getPlugin, registerPlugin } from '@/lib/plugin-system'
import { MARKETPLACE_CATALOG } from '@/lib/plugin-marketplace'

let bootstrapped = false

/** 앱 시작 시 1회 — featured builtin을 기본 설치(이미 있으면 스킵) */
export function bootstrapBuiltinPlugins(): void {
  if (typeof window === 'undefined') return
  if (bootstrapped) return
  bootstrapped = true

  for (const entry of MARKETPLACE_CATALOG.filter((e) => e.featured)) {
    if (getPlugin(entry.id)) continue
    registerPlugin(
      {
        id: entry.id,
        name: entry.name,
        version: entry.version,
        description: entry.description,
        author: entry.author,
        dependencies: entry.dependencies,
        permissions: entry.permissions,
        sandbox: entry.sandbox,
        contributes: entry.contributes,
      },
      { source: 'builtin', enabled: true },
    )
  }
}

export function __resetBootstrapFlagForTests(): void {
  bootstrapped = false
}
