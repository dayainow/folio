'use client'

/**
 * P54 — 설정: 데이터 마이그레이션 패널
 * 버전 업/롤백 · SQLite/JSON · 충돌 전략 · 진행률 · 검증 리포트
 */
import { useCallback, useId, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  Database,
  FileJson,
  History,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  LATEST_SCHEMA_VERSION,
  MIGRATIONS,
  buildMigrationReport,
  downloadDatasetJson,
  downloadDatasetSqlite,
  downloadMigrationReport,
  getCurrentSchemaVersion,
  importAndApply,
  importDatasetSqlite,
  listMigrationLogs,
  loadDataset,
  migrateToLatest,
  parseDatasetJson,
  rollbackOne,
  rollbackToSnapshot,
  validateDataset,
  type ConflictStrategy,
  type MigrationProgress,
  type ValidationReport,
} from '@/lib/migrate'

function ProgressBar({ progress }: { progress: MigrationProgress }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">{progress.label || progress.phase}</span>
        <span className="tabular-nums">{Math.round(progress.ratio * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-200',
            progress.phase === 'error' ? 'bg-destructive' : 'bg-teal-600',
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress.ratio * 100))}%` }}
        />
      </div>
    </div>
  )
}

function ReportBlock({ title, report }: { title: string; report: ValidationReport | null }) {
  if (!report) return null
  return (
    <div className="rounded-lg border border-gray-100 p-2.5 text-[11px] dark:border-gray-800">
      <p className="mb-1 font-medium">
        {title}{' '}
        <span className={report.ok ? 'text-emerald-600' : 'text-destructive'}>
          {report.ok ? 'OK' : 'FAIL'}
        </span>
      </p>
      <p className="text-muted-foreground tabular-nums">
        v{report.schemaVersion} · j{report.counts.journals} · d{report.counts.docs} · t
        {report.counts.tasks} · p{report.counts.projects}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">Σ {report.checksum}</p>
      {report.issues.length > 0 ? (
        <ul className="mt-1 list-disc pl-4 text-destructive">
          {report.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function DataMigrationPanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<MigrationProgress>({
    phase: 'idle',
    ratio: 0,
    label: '대기',
  })
  const [schemaVersion, setSchemaVersion] = useState(() =>
    typeof window !== 'undefined' ? getCurrentSchemaVersion() : 0,
  )
  const [strategy, setStrategy] = useState<ConflictStrategy>('merge')
  const [before, setBefore] = useState<ValidationReport | null>(null)
  const [after, setAfter] = useState<ValidationReport | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [logs, setLogs] = useState(() =>
    typeof window !== 'undefined' ? listMigrationLogs() : [],
  )

  const refresh = useCallback(() => {
    setSchemaVersion(getCurrentSchemaVersion())
    setLogs(listMigrationLogs())
    setBefore(validateDataset(loadDataset()))
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      refresh()
    } catch (err) {
      setProgress({
        phase: 'error',
        ratio: 1,
        label: err instanceof Error ? err.message : '오류',
      })
      setMessage(err instanceof Error ? err.message : '오류')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby={titleId}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-100 bg-background shadow-xl dark:border-gray-800 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div>
            <h2 id={titleId} className="text-sm font-semibold">
              데이터 마이그레이션
            </h2>
            <p className="text-[11px] text-muted-foreground">
              스키마 v{schemaVersion} / 최신 v{LATEST_SCHEMA_VERSION} · P54
            </p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-3">
          <ProgressBar progress={progress} />

          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={busy || schemaVersion >= LATEST_SCHEMA_VERSION}
              onClick={() =>
                void run(async () => {
                  const r = await migrateToLatest(setProgress)
                  setBefore(r.reportBefore)
                  setAfter(r.reportAfter)
                  setMessage(r.message ?? (r.ok ? '마이그레이션 완료' : '실패'))
                  if (r.ok) {
                    downloadMigrationReport(
                      buildMigrationReport({
                        before: r.reportBefore,
                        after: r.reportAfter,
                        from: r.from,
                        to: r.to,
                        ok: r.ok,
                        message: r.message,
                      }),
                    )
                  }
                })
              }
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}
              최신으로 마이그레이션
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={busy || schemaVersion <= 0}
              onClick={() =>
                void run(async () => {
                  const r = await rollbackOne(setProgress)
                  setBefore(r.reportBefore)
                  setAfter(r.reportAfter)
                  setMessage(r.message ?? (r.ok ? '한 단계 롤백' : '롤백 실패'))
                })
              }
            >
              <RotateCcw className="size-3.5" />
              롤백
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await rollbackToSnapshot(setProgress)
                  setMessage(r.message ?? (r.ok ? '스냅샷 복원' : '스냅샷 없음'))
                })
              }
            >
              <History className="size-3.5" />
              스냅샷 복원
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs"
              disabled={busy}
              onClick={() => {
                const r = validateDataset(loadDataset())
                setBefore(r)
                setMessage(r.ok ? '무결성 OK' : '무결성 이슈')
                setProgress({ phase: 'done', ratio: 1, label: '검증 완료' })
              }}
            >
              <ShieldCheck className="size-3.5" />
              검증
            </Button>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">등록된 마이그레이션</p>
            <ul className="space-y-1">
              {MIGRATIONS.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    'rounded-md border px-2.5 py-1.5 text-[11px] dark:border-gray-800',
                    schemaVersion >= m.id
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30'
                      : 'border-gray-100',
                  )}
                >
                  <span className="font-medium">v{m.id} · {m.name}</span>
                  <span className="mt-0.5 block text-muted-foreground">{m.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
            <p className="text-[11px] font-medium">내보내기 / 가져오기</p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy}
                onClick={() => downloadDatasetJson()}
              >
                <FileJson className="size-3.5" />
                JSON
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await downloadDatasetSqlite(undefined, setProgress)
                  })
                }
              >
                <ArrowDownToLine className="size-3.5" />
                SQLite
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-3.5" />
                가져오기
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.sqlite,.db,application/json,application/x-sqlite3"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  void run(async () => {
                    setProgress({ phase: 'import', ratio: 0.1, label: '파일 읽기…' })
                    const buf = await file.arrayBuffer()
                    const incoming =
                      file.name.endsWith('.json') || file.type.includes('json')
                        ? parseDatasetJson(new TextDecoder().decode(buf))
                        : await importDatasetSqlite(buf)
                    const r = await importAndApply(incoming, strategy, setProgress)
                    setBefore(r.reportBefore)
                    setAfter(r.reportAfter)
                    setMessage(r.message ?? (r.ok ? '가져오기 완료' : '가져오기 실패'))
                    if (r.ok) {
                      downloadMigrationReport(
                        buildMigrationReport({
                          before: r.reportBefore,
                          after: r.reportAfter,
                          from: r.reportBefore.schemaVersion,
                          to: r.reportAfter.schemaVersion,
                          ok: r.ok,
                          message: r.message,
                        }),
                      )
                    }
                  })
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              충돌 전략
              <select
                className="h-7 rounded-md border border-gray-200 bg-background px-2 text-xs dark:border-gray-700"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as ConflictStrategy)}
              >
                <option value="merge">병합 (최신 우선)</option>
                <option value="overwrite">덮어쓰기</option>
                <option value="skip">건너뛰기 (기존 유지)</option>
              </select>
            </label>
            <p className="text-[10px] text-muted-foreground">
              JSON/CSV/ZIP 전체 내보내기는 기존 내보내기 메뉴를 사용하고, 여기서는 스키마 데이터셋 JSON·SQLite 덤프를 다룹니다.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <ReportBlock title="이전" report={before} />
            <ReportBlock title="이후" report={after} />
          </div>

          {message ? (
            <p className="rounded-md bg-muted/50 px-2.5 py-2 text-[11px]">{message}</p>
          ) : null}

          {logs.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">최근 로그</p>
              <ul className="max-h-28 space-y-1 overflow-y-auto text-[10px] text-muted-foreground">
                {logs.slice(0, 8).map((l, i) => (
                  <li key={`${l.at}-${i}`} className="truncate font-mono">
                    {l.at.slice(0, 19)} · v{l.fromVersion}→{l.toVersion} · {l.ok ? 'ok' : 'fail'}
                    {l.message ? ` · ${l.message}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function DataMigrationButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2 text-[11px]"
        onClick={() => setOpen(true)}
      >
        <Database className="h-3.5 w-3.5" />
        마이그레이션
      </Button>
      <DataMigrationPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
