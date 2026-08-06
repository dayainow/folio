'use client'

/**
 * P51 — 플러그인 마켓플레이스 / 관리 UI
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import {
  Download,
  Package,
  Puzzle,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { bootstrapBuiltinPlugins } from '@/plugins'
import {
  installFromMarketplace,
  listInstalledWithUpdates,
  searchMarketplace,
  uninstallPlugin,
  updatePlugin,
  type MarketplaceEntry,
} from '@/lib/plugin-marketplace'
import {
  setPluginEnabled,
  subscribePlugins,
  type RegisteredPlugin,
} from '@/lib/plugin-system'
import { upsertLocalFieldDef, removeLocalFieldDef, listFieldDefs } from '@/lib/custom-fields'
import type { PluginEntity, PluginFieldType } from '@/lib/plugin-system'
import { cn } from '@/lib/utils'

export function PluginsButton() {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  useEffect(() => {
    const openPanel = () => setOpen(true)
    window.addEventListener('folio:open-plugins', openPanel)
    return () => window.removeEventListener('folio:open-plugins', openPanel)
  }, [])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 rounded-full border px-2.5 text-[11px] font-medium"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
      >
        <Puzzle className="h-3.5 w-3.5 text-teal-600" />
        플러그인
      </Button>
      {open ? <PluginsPanel id={panelId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export function PluginsPanel({ id, onClose }: { id?: string; onClose: () => void }) {
  const [tab, setTab] = useState<'installed' | 'market' | 'fields'>('market')
  const [query, setQuery] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [installed, setInstalled] = useState(() => listInstalledWithUpdates())

  const refresh = useCallback(() => {
    bootstrapBuiltinPlugins()
    setInstalled(listInstalledWithUpdates())
  }, [])

  useEffect(() => {
    queueMicrotask(refresh)
    return subscribePlugins(refresh)
  }, [refresh])

  const market = useMemo(() => searchMarketplace(query), [query])

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="플러그인"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Package className="h-4 w-4 text-teal-600" />
          <div>
            <h2 className="text-sm font-semibold">플러그인 · 확장</h2>
            <p className="text-[11px] text-muted-foreground">마켓 · 위젯 · 커스텀 필드 · P51</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="ml-auto size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex gap-1 border-b border-border px-3 py-2">
          {(
            [
              ['market', '마켓'],
              ['installed', '설치됨'],
              ['fields', '필드'],
            ] as const
          ).map(([k, label]) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={tab === k ? 'default' : 'ghost'}
              className="h-7 px-2.5 text-[11px]"
              onClick={() => setTab(k)}
            >
              {label}
            </Button>
          ))}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="ml-auto size-7"
            onClick={refresh}
            aria-label="새로고침"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>

        {msg ? (
          <p className="border-b border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            {msg}
          </p>
        ) : null}

        <div className="overflow-y-auto p-4">
          {tab === 'market' ? (
            <MarketTab
              query={query}
              onQuery={setQuery}
              entries={market}
              onInstall={(entry) => {
                const r = installFromMarketplace(entry.id)
                if (!r.ok) {
                  setMsg(
                    r.reason === 'unmet_dependencies'
                      ? `의존성 부족: ${(r.missing ?? []).join(', ')}`
                      : `설치 실패: ${r.reason}`,
                  )
                  return
                }
                setMsg(r.updated ? `${entry.name} 업데이트됨 → ${r.plugin.version}` : `${entry.name} 설치됨`)
                refresh()
              }}
            />
          ) : null}

          {tab === 'installed' ? (
            <InstalledTab
              rows={installed}
              onToggle={(p, enabled) => {
                setPluginEnabled(p.id, enabled)
                refresh()
              }}
              onUpdate={(id) => {
                const r = updatePlugin(id)
                setMsg(r.ok ? (r.updated ? '업데이트 완료' : '이미 최신') : `실패: ${r.reason}`)
                refresh()
              }}
              onUninstall={(id) => {
                uninstallPlugin(id)
                setMsg('제거됨')
                refresh()
              }}
            />
          ) : null}

          {tab === 'fields' ? <FieldsTab onMsg={setMsg} /> : null}
        </div>
      </div>
    </div>
  )
}

function MarketTab({
  query,
  onQuery,
  entries,
  onInstall,
}: {
  query: string
  onQuery: (q: string) => void
  entries: MarketplaceEntry[]
  onInstall: (e: MarketplaceEntry) => void
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
        <Input
          className="h-9 pl-8 text-xs"
          placeholder="플러그인 검색…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border p-3"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold">
                {e.name}{' '}
                <span className="font-normal text-muted-foreground">v{e.version}</span>
                {e.featured ? (
                  <span className="ml-1 rounded bg-teal-50 px-1 text-[10px] text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                    featured
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{e.description}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {(e.tags ?? []).join(' · ')}
                {e.sandbox && e.sandbox !== 'none' ? ` · sandbox:${e.sandbox}` : ''}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-7 shrink-0 gap-1 text-[11px]"
              onClick={() => onInstall(e)}
            >
              <Download className="size-3" />
              설치
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function InstalledTab({
  rows,
  onToggle,
  onUpdate,
  onUninstall,
}: {
  rows: ReturnType<typeof listInstalledWithUpdates>
  onToggle: (p: RegisteredPlugin, enabled: boolean) => void
  onUpdate: (id: string) => void
  onUninstall: (id: string) => void
}) {
  if (rows.length === 0) {
    return <p className="text-[11px] text-muted-foreground">설치된 플러그인이 없습니다. 마켓에서 설치하세요.</p>
  }
  return (
    <ul className="space-y-2">
      {rows.map(({ plugin, latest, updateAvailable }) => (
        <li
          key={plugin.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-xs"
        >
          <div>
            <p className="font-semibold">
              {plugin.name}{' '}
              <span className="font-normal text-muted-foreground">
                v{plugin.version}
                {updateAvailable ? ` → ${latest}` : ''}
              </span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {plugin.source} · {plugin.enabled ? '활성' : '비활성'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => onToggle(plugin, !plugin.enabled)}
            >
              {plugin.enabled ? '비활성' : '활성'}
            </Button>
            {updateAvailable ? (
              <Button
                type="button"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => onUpdate(plugin.id)}
              >
                업데이트
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-destructive"
              onClick={() => onUninstall(plugin.id)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function FieldsTab({ onMsg }: { onMsg: (m: string) => void }) {
  const [entity, setEntity] = useState<PluginEntity>('journal')
  return <FieldsTabInner key={entity} entity={entity} onEntity={setEntity} onMsg={onMsg} />
}

function FieldsTabInner({
  entity,
  onEntity,
  onMsg,
}: {
  entity: PluginEntity
  onEntity: (e: PluginEntity) => void
  onMsg: (m: string) => void
}) {
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<PluginFieldType>('text')
  const [defs, setDefs] = useState(() => listFieldDefs(entity))

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted-foreground">
        사용자 정의 필드를 추가합니다. 플러그인 필드는 설치·활성화 시 자동 병합됩니다.
      </p>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <label className="space-y-1">
          엔티티
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2"
            value={entity}
            onChange={(e) => onEntity(e.target.value as PluginEntity)}
          >
            <option value="journal">journal</option>
            <option value="doc">doc</option>
            <option value="task">task</option>
          </select>
        </label>
        <label className="space-y-1">
          타입
          <select
            className="h-8 w-full rounded-md border border-border bg-background px-2"
            value={type}
            onChange={(e) => setType(e.target.value as PluginFieldType)}
          >
            {(['text', 'number', 'date', 'select', 'multi-select', 'rich-text'] as PluginFieldType[]).map(
              (t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="space-y-1">
          key
          <Input className="h-8" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="space-y-1">
          label
          <Input className="h-8" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-8 text-[11px]"
        onClick={() => {
          if (!key.trim() || !label.trim()) {
            onMsg('key/label 필요')
            return
          }
          upsertLocalFieldDef({
            id: `user-${entity}-${key}`,
            entity,
            key: key.trim(),
            label: label.trim(),
            type,
            options: type === 'select' || type === 'multi-select' ? ['옵션A', '옵션B'] : undefined,
            group: '사용자',
            order: 50,
          })
          setDefs(listFieldDefs(entity))
          onMsg('필드 추가됨')
          setKey('')
          setLabel('')
        }}
      >
        필드 추가
      </Button>
      <ul className="space-y-1 text-[11px]">
        {defs.map((d) => (
          <li
            key={`${d.entity}:${d.key}`}
            className={cn(
              'flex items-center justify-between rounded-lg border border-border px-2 py-1.5',
            )}
          >
            <span>
              <span className="font-medium">{d.label}</span>{' '}
              <span className="text-muted-foreground">
                {d.key} · {d.type} · {d.source}
              </span>
            </span>
            {d.source === 'user' ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-destructive"
                onClick={() => {
                  removeLocalFieldDef(entity, d.key)
                  setDefs(listFieldDefs(entity))
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
