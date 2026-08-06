'use client'

/**
 * P63 — 리포트 · 고급 PDF · 템플릿
 */
import { useEffect, useId, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  FileBarChart2,
  Loader2,
  Mail,
  Printer,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { loadDocsWithFallback, loadCategories, type DocEntry } from '@/lib/docs'
import { loadJournalsWithFallback, type JournalEntry } from '@/lib/journal'
import { loadTasksWithFallback, type Task } from '@/lib/board'
import { journalToHtml, tasksToHtml, docToHtml } from '@/lib/export-rich'
import {
  exportJournalDayPdf,
  exportJournalWeekPdf,
  exportJournalMonthPdf,
  exportDocPdfAdvanced,
  exportDocsByCategoryPdf,
  exportBoardPdfAdvanced,
  buildPrintableHtml,
  openPrintPreview,
  downloadPdf,
  type PdfLayoutOptions,
  type PaperSize,
  type BoardPdfFilter,
} from '@/lib/export-advanced'
import {
  ALL_REPORT_SECTIONS,
  SECTION_LABELS,
  buildReport,
  defaultTemplate,
  deleteReportTemplate,
  downloadReport,
  emailReport,
  loadReportTemplates,
  upsertReportTemplate,
  type ReportKind,
  type ReportSectionId,
  type ReportTemplate,
} from '@/lib/reports'

type Tab = 'pdf' | 'report' | 'template'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function ReportsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId()
  const [tab, setTab] = useState<Tab>('report')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [docs, setDocs] = useState<DocEntry[]>([])
  const [journals, setJournals] = useState<Record<string, JournalEntry>>({})
  const [tasks, setTasks] = useState<Task[]>([])

  const [paper, setPaper] = useState<PaperSize>('a4')
  const [marginMm, setMarginMm] = useState(15)
  const [cover, setCover] = useState(true)
  const [toc, setToc] = useState(true)
  const [pageNumbers, setPageNumbers] = useState(true)

  const [anchor, setAnchor] = useState(todayStr)
  const [docId, setDocId] = useState('')
  const [category, setCategory] = useState('')
  const [boardStatus, setBoardStatus] = useState<BoardPdfFilter['status']>('all')

  const [reportKind, setReportKind] = useState<ReportKind>('weekly')
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [tplId, setTplId] = useState('')
  const [draft, setDraft] = useState<ReportTemplate>(() => defaultTemplate('weekly'))

  const categories = useMemo(() => loadCategories(docs), [docs])

  const layout: PdfLayoutOptions = useMemo(
    () => ({ paper, marginMm, cover, toc, pageNumbers }),
    [paper, marginMm, cover, toc, pageNumbers],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const [d, j, t] = await Promise.all([
        loadDocsWithFallback(),
        loadJournalsWithFallback(),
        loadTasksWithFallback(),
      ])
      if (cancelled) return
      setDocs(d)
      setJournals(j)
      setTasks(t)
      setDocId((p) => p || d[0]?.id || '')
      setCategory((p) => p || loadCategories(d)[0] || '')
      setAnchor((p) => p || Object.keys(j).sort().reverse()[0] || todayStr())
      const tpls = loadReportTemplates()
      setTemplates(tpls)
      const match = tpls.find((x) => x.kind === 'weekly') ?? tpls[0]
      if (match) {
        setTplId(match.id)
        setDraft(match)
        setReportKind(match.kind)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg('완료')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '오류')
    } finally {
      setBusy(false)
    }
  }

  const selectedDoc = docs.find((d) => d.id === docId)
  const selectedJournal = journals[anchor]

  const moveSection = (id: ReportSectionId, dir: -1 | 1) => {
    setDraft((prev) => {
      const sections = [...prev.sections]
      const i = sections.indexOf(id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= sections.length) return prev
      ;[sections[i], sections[j]] = [sections[j]!, sections[i]!]
      return { ...prev, sections }
    })
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
    >
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 id={titleId} className="text-sm font-semibold">
              리포트 · PDF
            </h2>
            <p className="text-[11px] text-muted-foreground">주간/월간 리포트 · 고급 PDF · 인쇄</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-1 border-b px-3 pt-2">
          {(
            [
              ['report', '리포트'],
              ['pdf', 'PDF'],
              ['template', '템플릿'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                'rounded-t-md px-3 py-1.5 text-[11px]',
                tab === id ? 'bg-muted font-medium' : 'text-muted-foreground',
              )}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3 text-sm">
          {tab === 'pdf' && (
            <>
              <section className="space-y-2 rounded-xl border p-3">
                <p className="text-[11px] font-medium">템플릿 · 용지</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[11px]">
                    용지
                    <select
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      value={paper}
                      onChange={(e) => setPaper(e.target.value as PaperSize)}
                    >
                      <option value="a4">A4</option>
                      <option value="letter">Letter</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px]">
                    여백(mm)
                    <Input
                      type="number"
                      min={8}
                      max={40}
                      className="h-8 text-xs"
                      value={marginMm}
                      onChange={(e) => setMarginMm(Number(e.target.value) || 15)}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-3 text-[11px]">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} />
                    표지
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={toc} onChange={(e) => setToc(e.target.checked)} />
                    목차
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={pageNumbers}
                      onChange={(e) => setPageNumbers(e.target.checked)}
                    />
                    쪽 번호
                  </label>
                </div>
              </section>

              <section className="space-y-2 rounded-xl border p-3">
                <p className="text-[11px] font-medium">일지 PDF</p>
                <label className="flex flex-col gap-1 text-[11px]">
                  기준일
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={anchor}
                    onChange={(e) => setAnchor(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={busy || !selectedJournal}
                    onClick={() =>
                      void run(async () => {
                        if (!selectedJournal) return
                        const blob = await exportJournalDayPdf(selectedJournal, layout)
                        downloadPdf(blob, `journal-${selectedJournal.date}`)
                      })
                    }
                  >
                    일별
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const blob = await exportJournalWeekPdf(journals, anchor, layout)
                        downloadPdf(blob, `journal-week-${anchor}`)
                      })
                    }
                  >
                    주별
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const blob = await exportJournalMonthPdf(journals, anchor, layout)
                        downloadPdf(blob, `journal-month-${anchor.slice(0, 7)}`)
                      })
                    }
                  >
                    월별
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs"
                    disabled={busy || !selectedJournal}
                    onClick={() => {
                      if (!selectedJournal) return
                      const html = buildPrintableHtml(
                        `Journal ${selectedJournal.date}`,
                        journalToHtml(selectedJournal).replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, ''),
                        paper,
                      )
                      openPrintPreview(html)
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    인쇄
                  </Button>
                </div>
              </section>

              <section className="space-y-2 rounded-xl border p-3">
                <p className="text-[11px] font-medium">문서 PDF</p>
                <label className="flex flex-col gap-1 text-[11px]">
                  개별
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={docId}
                    onChange={(e) => setDocId(e.target.value)}
                  >
                    {docs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px]">
                  카테고리
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={busy || !selectedDoc}
                    onClick={() =>
                      void run(async () => {
                        if (!selectedDoc) return
                        const blob = await exportDocPdfAdvanced(selectedDoc, layout)
                        downloadPdf(blob, selectedDoc.title || 'doc')
                      })
                    }
                  >
                    개별 PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={busy || !category}
                    onClick={() =>
                      void run(async () => {
                        const blob = await exportDocsByCategoryPdf(docs, category, layout)
                        downloadPdf(blob, `docs-${category}`)
                      })
                    }
                  >
                    카테고리 PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs"
                    disabled={!selectedDoc}
                    onClick={() => {
                      if (!selectedDoc) return
                      const inner = docToHtml(selectedDoc)
                        .replace(/^[\s\S]*<body>/, '')
                        .replace(/<\/body>[\s\S]*$/, '')
                      openPrintPreview(buildPrintableHtml(selectedDoc.title, inner, paper))
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    인쇄
                  </Button>
                </div>
              </section>

              <section className="space-y-2 rounded-xl border p-3">
                <p className="text-[11px] font-medium">보드 PDF</p>
                <label className="flex flex-col gap-1 text-[11px]">
                  상태 필터
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={boardStatus}
                    onChange={(e) => setBoardStatus(e.target.value as BoardPdfFilter['status'])}
                  >
                    <option value="all">전체 칸반</option>
                    <option value="backlog">backlog</option>
                    <option value="in_progress">in_progress</option>
                    <option value="review">review</option>
                    <option value="done">done</option>
                  </select>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const blob = await exportBoardPdfAdvanced(
                          tasks,
                          { status: boardStatus },
                          layout,
                        )
                        downloadPdf(blob, `board-${boardStatus ?? 'all'}`)
                      })
                    }
                  >
                    PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs"
                    onClick={() => {
                      const filtered =
                        boardStatus && boardStatus !== 'all'
                          ? tasks.filter((t) => t.status === boardStatus)
                          : tasks
                      const inner = tasksToHtml(filtered)
                        .replace(/^[\s\S]*<body>/, '')
                        .replace(/<\/body>[\s\S]*$/, '')
                      openPrintPreview(buildPrintableHtml('Board', inner, paper))
                    }}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    인쇄
                  </Button>
                </div>
              </section>
            </>
          )}

          {tab === 'report' && (
            <>
              <section className="space-y-2 rounded-xl border p-3">
                <p className="text-[11px] font-medium">자동 리포트</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[11px]">
                    종류
                    <select
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      value={reportKind}
                      onChange={(e) => {
                        const kind = e.target.value as ReportKind
                        setReportKind(kind)
                        const match = templates.find((t) => t.kind === kind)
                        if (match) {
                          setTplId(match.id)
                          setDraft(match)
                        } else {
                          const d = defaultTemplate(kind)
                          setDraft(d)
                          setTplId(d.id)
                        }
                      }}
                    >
                      <option value="weekly">주간</option>
                      <option value="monthly">월간</option>
                      <option value="project">프로젝트</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px]">
                    기준일
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={anchor}
                      onChange={(e) => setAnchor(e.target.value)}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-[11px]">
                  템플릿
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={tplId}
                    onChange={(e) => {
                      const id = e.target.value
                      setTplId(id)
                      const found = templates.find((t) => t.id === id)
                      if (found) {
                        setDraft(found)
                        setReportKind(found.kind)
                      }
                    }}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.kind})
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[10px] text-muted-foreground">
                  주간: 일지+태스크+Gate · 월간: 통계·트렌드·성과 포함 (템플릿에서 조정)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(['md', 'html', 'pdf'] as const).map((fmt) => (
                    <Button
                      key={fmt}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs uppercase"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const bundle = await buildReport(reportKind, draft, anchor)
                          await downloadReport(bundle, fmt, layout)
                        })
                      }
                    >
                      {fmt}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const bundle = await buildReport(reportKind, draft, anchor)
                        openPrintPreview(
                          buildPrintableHtml(bundle.title, bundle.htmlBody, paper),
                        )
                      })
                    }
                  >
                    <Printer className="h-3.5 w-3.5" />
                    인쇄
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1 text-xs"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const bundle = await buildReport(reportKind, draft, anchor)
                        const r = await emailReport(bundle)
                        if (!r.ok) throw new Error(r.reason || 'email_failed')
                        if (r.skipped) setMsg(`이메일 스킵: ${r.reason ?? 'outbox'}`)
                      })
                    }
                  >
                    <Mail className="h-3.5 w-3.5" />
                    이메일
                  </Button>
                </div>
              </section>
            </>
          )}

          {tab === 'template' && (
            <section className="space-y-2 rounded-xl border p-3">
              <p className="text-[11px] font-medium">리포트 커스터마이징</p>
              <label className="flex flex-col gap-1 text-[11px]">
                이름
                <Input
                  className="h-8 text-xs"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px]">
                종류
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={draft.kind}
                  onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as ReportKind }))}
                >
                  <option value="weekly">주간</option>
                  <option value="monthly">월간</option>
                  <option value="project">프로젝트</option>
                </select>
              </label>
              <ul className="space-y-1">
                {draft.sections.map((id) => (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px]"
                  >
                    <input
                      type="checkbox"
                      checked={draft.include[id] !== false}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          include: { ...d.include, [id]: e.target.checked },
                        }))
                      }
                    />
                    <span className="flex-1">{SECTION_LABELS[id]}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      aria-label="위로"
                      onClick={() => moveSection(id, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      aria-label="아래로"
                      onClick={() => moveSection(id, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={busy}
                  onClick={() => {
                    const next = upsertReportTemplate(draft)
                    setTemplates(next)
                    setTplId(draft.id)
                    setMsg('템플릿 저장됨')
                  }}
                >
                  <Save className="h-3.5 w-3.5" />
                  저장
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    const d = defaultTemplate(draft.kind, `${draft.kind} 새 템플릿`)
                    // ensure all sections present
                    d.sections = [...ALL_REPORT_SECTIONS]
                    setDraft(d)
                    setTplId(d.id)
                  }}
                >
                  새 템플릿
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs text-destructive"
                  disabled={templates.length <= 1}
                  onClick={() => {
                    const next = deleteReportTemplate(draft.id)
                    setTemplates(next)
                    const first = next[0] ?? defaultTemplate('weekly')
                    setDraft(first)
                    setTplId(first.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </Button>
              </div>
            </section>
          )}

          {(busy || msg) && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function ReportsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <FileBarChart2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">리포트</span>
      </Button>
      <ReportsPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
