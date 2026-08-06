'use client'

/**
 * P65 — 테마 / 접근성 설정 패널
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  Copy,
  Download,
  Monitor,
  Moon,
  Palette,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { announceToScreenReader } from '@/lib/a11y'
import {
  getHighContrast,
  getStoredThemePreference,
  loadAppearance,
  saveAppearance,
  setHighContrast,
  setStoredThemePreference,
  type AppearancePrefs,
  type FontScale,
  type ReduceMotionPref,
  type ThemePreference,
} from '@/lib/theme'
import {
  applyThemePreset,
  createThemePreset,
  deleteThemePreset,
  exportPresetJson,
  importPresetJson,
  listThemePresets,
  type ThemePreset,
} from '@/lib/theme-presets'
import { cn } from '@/lib/utils'

function PrefButton({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  label: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      className="h-9 gap-1.5 text-xs"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function ThemeSettingsPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pref, setPref] = useState<ThemePreference>('light')
  const [contrast, setContrast] = useState(false)
  const [appearance, setAppearance] = useState<AppearancePrefs>(() => loadAppearance())
  const [presets, setPresets] = useState<ThemePreset[]>([])
  const [name, setName] = useState('내 테마')
  const [primary, setPrimary] = useState('#0f766e')
  const [accent, setAccent] = useState('#14b8a6')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      setPref(getStoredThemePreference())
      setContrast(getHighContrast())
      setAppearance(loadAppearance())
      setPresets(listThemePresets())
    }, 0)
    return () => window.clearTimeout(t)
  }, [open])

  if (!open) return null

  const updateAppearance = (patch: Partial<AppearancePrefs>) => {
    const next = { ...appearance, ...patch }
    setAppearance(next)
    saveAppearance(next)
  }

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 id={titleId} className="text-sm font-semibold">
              테마 · 접근성
            </h2>
            <p className="text-[11px] text-muted-foreground">Light / Dark / System · 고대비 · 프리셋</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-3 text-sm">
          <section className="space-y-2" aria-labelledby="theme-mode-label">
            <p id="theme-mode-label" className="text-[11px] font-medium text-muted-foreground">
              테마
            </p>
            <div className="flex flex-wrap gap-1.5">
              <PrefButton
                active={pref === 'light'}
                label="라이트"
                onClick={() => {
                  setStoredThemePreference('light')
                  setPref('light')
                  announceToScreenReader('라이트 테마')
                }}
              >
                <Sun className="h-3.5 w-3.5" /> 라이트
              </PrefButton>
              <PrefButton
                active={pref === 'dark'}
                label="다크"
                onClick={() => {
                  setStoredThemePreference('dark')
                  setPref('dark')
                  announceToScreenReader('다크 테마')
                }}
              >
                <Moon className="h-3.5 w-3.5" /> 다크
              </PrefButton>
              <PrefButton
                active={pref === 'system'}
                label="시스템"
                onClick={() => {
                  setStoredThemePreference('system')
                  setPref('system')
                  announceToScreenReader('시스템 테마')
                }}
              >
                <Monitor className="h-3.5 w-3.5" /> 시스템
              </PrefButton>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={contrast}
                onChange={(e) => {
                  setHighContrast(e.target.checked)
                  setContrast(e.target.checked)
                  announceToScreenReader(e.target.checked ? '고대비 켜짐' : '고대비 꺼짐')
                }}
              />
              고대비 (WCAG AAA 지향 · 굵은 포커스)
            </label>
          </section>

          <section className="space-y-2 rounded-xl border p-3" aria-labelledby="a11y-label">
            <p id="a11y-label" className="text-[11px] font-medium">
              접근성
            </p>
            <label className="flex flex-col gap-1 text-[11px]">
              글자 크기
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={appearance.fontScale}
                onChange={(e) => updateAppearance({ fontScale: e.target.value as FontScale })}
              >
                <option value="sm">작게</option>
                <option value="md">보통</option>
                <option value="lg">크게</option>
                <option value="xl">더 크게</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={appearance.boldText}
                onChange={(e) => updateAppearance({ boldText: e.target.checked })}
              />
              굵은 텍스트 강조
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={appearance.strongFocus}
                onChange={(e) => updateAppearance({ strongFocus: e.target.checked })}
              />
              포커스 표시기 강화
            </label>
            <label className="flex flex-col gap-1 text-[11px]">
              모션
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={appearance.reduceMotion}
                onChange={(e) =>
                  updateAppearance({ reduceMotion: e.target.value as ReduceMotionPref })
                }
              >
                <option value="system">시스템 (prefers-reduced-motion)</option>
                <option value="reduce">항상 모션 감소</option>
                <option value="no-preference">애니메이션 허용</option>
              </select>
            </label>
          </section>

          <section className="space-y-2 rounded-xl border p-3" aria-labelledby="preset-label">
            <p id="preset-label" className="text-[11px] font-medium">
              커스텀 테마 프리셋
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px]">
                이름
                <Input className="h-8 text-xs" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[11px]">
                Primary
                <Input type="color" className="h-8 p-1" value={primary} onChange={(e) => setPrimary(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-[11px]">
                Accent
                <Input type="color" className="h-8 p-1" value={accent} onChange={(e) => setAccent(e.target.value)} />
              </label>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                const p = createThemePreset({
                  name,
                  primary,
                  accent,
                  fontScale: appearance.fontScale,
                })
                applyThemePreset(p)
                setPresets(listThemePresets())
                setAppearance(loadAppearance())
                setMsg(`저장 · 적용: ${p.name}`)
              }}
            >
              <Palette className="h-3.5 w-3.5" />
              저장 후 적용
            </Button>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {presets.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px]',
                    appearance.activePresetId === p.id && 'ring-2 ring-ring',
                  )}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border"
                    style={{ background: p.primary }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-medium"
                    onClick={() => {
                      applyThemePreset(p)
                      setAppearance(loadAppearance())
                      setMsg(`적용: ${p.name}`)
                    }}
                  >
                    {p.name}
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`${p.name} 내보내기`}
                    onClick={async () => {
                      const json = exportPresetJson(p)
                      try {
                        await navigator.clipboard.writeText(json)
                        setMsg('클립보드에 복사됨')
                      } catch {
                        const blob = new Blob([json], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `folio-theme-${p.name}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                        setMsg('JSON 다운로드')
                      }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`${p.name} 다운로드`}
                    onClick={() => {
                      const json = exportPresetJson(p)
                      const blob = new Blob([json], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `folio-theme-${p.name}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {!p.id.startsWith('builtin-') && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      aria-label={`${p.name} 삭제`}
                      onClick={() => {
                        setPresets(deleteThemePreset(p.id))
                        setAppearance(loadAppearance())
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                가져오기
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => {
                  applyThemePreset(null)
                  setAppearance(loadAppearance())
                  setMsg('커스텀 해제')
                }}
              >
                프리셋 해제
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const text = await file.text()
                    const p = importPresetJson(text)
                    applyThemePreset(p)
                    setPresets(listThemePresets())
                    setAppearance(loadAppearance())
                    setMsg(`가져옴: ${p.name}`)
                  } catch {
                    setMsg('가져오기 실패')
                  }
                  e.target.value = ''
                }}
              />
            </div>
          </section>

          {msg && <p className="text-[11px] text-muted-foreground">{msg}</p>}
        </div>
      </div>
    </div>
  )
}

export function ThemeSettingsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('folio:open-theme-settings', onOpen)
    return () => window.removeEventListener('folio:open-theme-settings', onOpen)
  }, [])
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={cn('h-7 gap-1 px-2 text-[11px]', className)}
        onClick={() => setOpen(true)}
      >
        <Palette className="size-3.5" aria-hidden />
        테마
      </Button>
      <ThemeSettingsPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
