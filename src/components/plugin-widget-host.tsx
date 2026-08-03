'use client'

/**
 * P51 — 활성화된 플러그인 위젯 호스트 + 설정 UI
 */
import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getEnabledWidgets,
  setWidgetSettings,
  subscribePlugins,
  type PluginWidgetLayout,
} from '@/lib/plugin-system'
import { PLUGIN_WIDGET_COMPONENTS } from '@/plugins/widget-components'
import { cn } from '@/lib/utils'

export function PluginWidgetHost({ className }: { className?: string }) {
  const [widgets, setWidgets] = useState(() => getEnabledWidgets())
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => setWidgets(getEnabledWidgets())
    queueMicrotask(refresh)
    return subscribePlugins(refresh)
  }, [])

  if (widgets.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      <p className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        플러그인 위젯
      </p>
      {widgets
        .filter((w) => (w.layout?.slot ?? 'sidebar') === 'sidebar')
        .map((w) => {
          const Comp = PLUGIN_WIDGET_COMPONENTS[w.componentKey]
          if (!Comp) {
            return (
              <div
                key={w.id}
                className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground"
              >
                위젯 컴포넌트 없음: {w.componentKey}
              </div>
            )
          }
          const width = w.layout?.width ?? 'md'
          return (
            <div key={w.id} className="relative">
              <div className="absolute right-2 top-2 z-10">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  aria-label={`${w.title} 설정`}
                  onClick={() => setEditId(editId === w.id ? null : w.id)}
                >
                  <Settings2 className="size-3" />
                </Button>
              </div>
              <Comp
                className={cn(
                  width === 'sm' && 'max-w-[200px]',
                  width === 'lg' && 'w-full',
                  width === 'full' && 'w-full',
                )}
              />
              {editId === w.id ? (
                <WidgetSettingsForm
                  widgetId={w.id}
                  width={w.layout?.width}
                  order={w.layout?.order}
                  dataSource={w.settings.dataSource ?? w.dataSource}
                  onClose={() => setEditId(null)}
                />
              ) : null}
            </div>
          )
        })}
    </div>
  )
}

function WidgetSettingsForm({
  widgetId,
  width,
  order,
  dataSource,
  onClose,
}: {
  widgetId: string
  width?: PluginWidgetLayout['width']
  order?: number
  dataSource?: string
  onClose: () => void
}) {
  const [w, setW] = useState(width ?? 'md')
  const [o, setO] = useState(String(order ?? 100))
  const [ds, setDs] = useState(dataSource ?? 'custom')

  return (
    <div className="mt-1 space-y-2 rounded-lg border border-border bg-muted/30 p-2 text-[11px]">
      <label className="flex items-center justify-between gap-2">
        크기
        <select
          className="h-7 rounded border border-border bg-background px-1"
          value={w}
          onChange={(e) => setW((e.target.value as PluginWidgetLayout['width']) ?? 'md')}
        >
          <option value="sm">sm</option>
          <option value="md">md</option>
          <option value="lg">lg</option>
          <option value="full">full</option>
        </select>
      </label>
      <label className="flex items-center justify-between gap-2">
        순서
        <input
          className="h-7 w-16 rounded border border-border bg-background px-1"
          value={o}
          onChange={(e) => setO(e.target.value)}
        />
      </label>
      <label className="flex items-center justify-between gap-2">
        데이터 소스
        <select
          className="h-7 rounded border border-border bg-background px-1"
          value={ds}
          onChange={(e) => setDs(e.target.value)}
        >
          <option value="journal">journal</option>
          <option value="board">board</option>
          <option value="docs">docs</option>
          <option value="beacon">beacon</option>
          <option value="custom">custom</option>
        </select>
      </label>
      <div className="flex justify-end gap-1">
        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onClose}>
          닫기
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7"
          onClick={() => {
            setWidgetSettings(widgetId, {
              width: w,
              order: Number(o) || 100,
              dataSource: ds,
            })
            onClose()
          }}
        >
          저장
        </Button>
      </div>
    </div>
  )
}
