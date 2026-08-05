'use client'

/**
 * P60 — 내보내기/공유 고도화 패널
 */
import { useEffect, useId, useMemo, useState } from 'react'
import {
  Cloud,
  Copy,
  Download,
  FileCode2,
  FileText,
  Link2,
  Loader2,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { loadDocsWithFallback, type DocEntry } from '@/lib/docs'
import { loadJournalsWithFallback, type JournalEntry } from '@/lib/journal'
import { loadTasksWithFallback } from '@/lib/board'
import {
  docToHtml,
  docToMarkdownRich,
  downloadHtml,
  downloadPdf,
  exportBoardPdf,
  exportDocPdf,
  exportJournalPdf,
  journalToHtml,
  journalToMarkdownRich,
  tasksToHtml,
  tasksToMarkdownRich,
} from '@/lib/export-rich'
import { downloadText, safeFilename } from '@/lib/export'
import {
  buildEmbedCode,
  createShareLink,
  listShareLinks,
  revokeShareLink,
  type ShareLinkRecord,
} from '@/lib/share-links'
import {
  getBackupSchedule,
  listBackupLogs,
  resolveBackupConflict,
  runCloudBackup,
  setBackupSchedule,
  startBackupScheduler,
  type BackupSchedule,
} from '@/lib/cloud-backup'

export function ExportSharePanel({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [journals, setJournals] = useState<Record<string, JournalEntry>>({})
  const [docId, setDocId] = useState('')
  const [journalDate, setJournalDate] = useState('')
  const [password, setPassword] = useState('')
  const [expiresDays, setExpiresDays] = useState('7')
  const [lastUrl, setLastUrl] = useState<string | null>(null)
  const [lastEmbed, setLastEmbed] = useState<string | null>(null)
  const [links, setLinks] = useState<ShareLinkRecord[]>([])
  const [schedule, setSchedule] = useState<BackupSchedule>(() => getBackupSchedule())
  const [logs, setLogs] = useState(() => listBackupLogs())

  const journalDates = useMemo(
    () => Object.keys(journals).sort((a, b) => b.localeCompare(a)),
    [journals],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      const [d, j] = await Promise.all([
        loadDocsWithFallback(),
        loadJournalsWithFallback(),
      ])
      if (cancelled) return
      setDocs(d)
      setJournals(j)
      setDocId((prev) => prev || d[0]?.id || '')
      setJournalDate((prev) => prev || Object.keys(j).sort().reverse()[0] || '')
      setLinks(listShareLinks())
      setSchedule(getBackupSchedule())
      setLogs(listBackupLogs())
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => startBackupScheduler(), [])

  if (!open) return null

  const selectedDoc = docs.find((d) => d.id === docId)
  const selectedJournal = journalDate ? journals[journalDate] : undefined

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '오류')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-labelledby={titleId}>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="닫기" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-background shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 id={titleId} className="text-sm font-semibold">
              내보내기 · 공유
            </h2>
            <p className="text-[11px] text-muted-foreground">P60 · PDF/HTML · 공유 링크 · 백업</p>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-3 text-sm">
          <section className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">대상</p>
            <label className="flex flex-col gap-1 text-[11px]">
              문서
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
              일지
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={journalDate}
                onChange={(e) => setJournalDate(e.target.value)}
              >
                {journalDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="space-y-2 rounded-xl border p-3">
            <p className="text-[11px] font-medium">내보내기</p>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy || !selectedDoc}
                onClick={() =>
                  void run(async () => {
                    if (!selectedDoc) return
                    downloadText(docToMarkdownRich(selectedDoc), `${safeFilename(selectedDoc.title)}.md`)
                    setMsg('문서 Markdown(frontmatter) 저장')
                  })
                }
              >
                <FileText className="size-3.5" /> MD
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy || !selectedDoc}
                onClick={() =>
                  void run(async () => {
                    if (!selectedDoc) return
                    downloadHtml(docToHtml(selectedDoc), `${safeFilename(selectedDoc.title)}.html`)
                    setMsg('문서 HTML 저장')
                  })
                }
              >
                <FileCode2 className="size-3.5" /> HTML
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy || !selectedDoc}
                onClick={() =>
                  void run(async () => {
                    if (!selectedDoc) return
                    const blob = await exportDocPdf(selectedDoc)
                    downloadPdf(blob, selectedDoc.title)
                    setMsg('문서 PDF 저장')
                  })
                }
              >
                <Download className="size-3.5" /> PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy || !selectedJournal}
                onClick={() =>
                  void run(async () => {
                    if (!selectedJournal) return
                    downloadText(
                      journalToMarkdownRich(selectedJournal),
                      `journal-${selectedJournal.date}.md`,
                    )
                    downloadHtml(
                      journalToHtml(selectedJournal),
                      `journal-${selectedJournal.date}.html`,
                    )
                    const blob = await exportJournalPdf(selectedJournal)
                    downloadPdf(blob, `journal-${selectedJournal.date}`)
                    setMsg('일지 MD/HTML/PDF 저장')
                  })
                }
              >
                일지 3종
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const tasks = await loadTasksWithFallback()
                    downloadText(tasksToMarkdownRich(tasks), 'board.md')
                    downloadHtml(tasksToHtml(tasks), 'board.html')
                    const blob = await exportBoardPdf(tasks)
                    downloadPdf(blob, 'board')
                    setMsg('보드 MD/HTML/PDF 저장')
                  })
                }
              >
                보드 3종
              </Button>
            </div>
          </section>

          <section className="space-y-2 rounded-xl border p-3">
            <p className="text-[11px] font-medium">공유 링크</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11px]">
                암호 (선택)
                <Input
                  type="password"
                  className="mt-1 h-8"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="없으면 공개"
                />
              </label>
              <label className="text-[11px]">
                만료 (일)
                <Input
                  className="mt-1 h-8"
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                  placeholder="7"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={busy || !selectedDoc}
                onClick={() =>
                  void run(async () => {
                    if (!selectedDoc) return
                    const days = Number(expiresDays)
                    const expiresAt =
                      Number.isFinite(days) && days > 0
                        ? new Date(Date.now() + days * 86400_000).toISOString()
                        : null
                    const created = await createShareLink({
                      password: password || undefined,
                      expiresAt,
                      snapshot: {
                        type: 'doc',
                        title: selectedDoc.title,
                        html: docToHtml(selectedDoc),
                        markdown: docToMarkdownRich(selectedDoc),
                        meta: { id: selectedDoc.id },
                      },
                    })
                    setLastUrl(created.url)
                    setLastEmbed(created.embedCode)
                    setLinks(listShareLinks())
                    setMsg('문서 공유 링크 생성')
                  })
                }
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
                문서 공유
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={busy || !selectedJournal}
                onClick={() =>
                  void run(async () => {
                    if (!selectedJournal) return
                    const days = Number(expiresDays)
                    const expiresAt =
                      Number.isFinite(days) && days > 0
                        ? new Date(Date.now() + days * 86400_000).toISOString()
                        : null
                    const created = await createShareLink({
                      password: password || undefined,
                      expiresAt,
                      snapshot: {
                        type: 'journal',
                        title: `Journal ${selectedJournal.date}`,
                        html: journalToHtml(selectedJournal),
                        markdown: journalToMarkdownRich(selectedJournal),
                        meta: { date: selectedJournal.date },
                      },
                    })
                    setLastUrl(created.url)
                    setLastEmbed(created.embedCode)
                    setLinks(listShareLinks())
                    setMsg('일지 공유 링크 생성')
                  })
                }
              >
                <Link2 className="size-3.5" /> 일지 공유
              </Button>
            </div>
            {lastUrl ? (
              <div className="space-y-1 rounded-md bg-muted/40 p-2 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <a className="truncate underline" href={lastUrl} target="_blank" rel="noreferrer">
                    {lastUrl}
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => void navigator.clipboard.writeText(lastUrl)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
                {lastEmbed ? (
                  <pre className="max-h-20 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 font-mono text-[10px]">
                    {lastEmbed}
                  </pre>
                ) : null}
              </div>
            ) : null}
            {links.length > 0 ? (
              <ul className="max-h-28 space-y-1 overflow-y-auto text-[10px] text-muted-foreground">
                {links.slice(0, 8).map((l) => (
                  <li key={l.token} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {l.title} · 조회 {l.views} · DL {l.downloads}
                    </span>
                    <button
                      type="button"
                      className="text-destructive"
                      aria-label="공유 삭제"
                      onClick={() =>
                        void run(async () => {
                          await revokeShareLink(l.token)
                          setLinks(listShareLinks())
                        })
                      }
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="space-y-2 rounded-xl border p-3">
            <p className="text-[11px] font-medium">클라우드 백업</p>
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={(e) => {
                  const next = setBackupSchedule({ enabled: e.target.checked })
                  setSchedule(next)
                }}
              />
              자동 백업
            </label>
            <label className="flex items-center gap-2 text-[11px]">
              주기(시간)
              <Input
                className="h-8 w-20"
                value={String(schedule.intervalHours)}
                onChange={(e) => {
                  const n = Number(e.target.value) || 24
                  setSchedule(setBackupSchedule({ intervalHours: n }))
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-[11px]">
              충돌
              <select
                className="h-8 rounded-md border bg-background px-2"
                value={schedule.conflictStrategy}
                onChange={(e) =>
                  setSchedule(
                    setBackupSchedule({
                      conflictStrategy: e.target.value as BackupSchedule['conflictStrategy'],
                    }),
                  )
                }
              >
                <option value="merge">병합</option>
                <option value="overwrite">덮어쓰기</option>
                <option value="skip">건너뛰기</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await runCloudBackup()
                    setLogs(listBackupLogs())
                    setSchedule(getBackupSchedule())
                    setMsg(r.ok ? `백업 OK (${r.mode})` : '백업 실패')
                  })
                }
              >
                <Cloud className="size-3.5" /> 지금 백업
              </Button>
              <label className={cn('inline-flex h-8 cursor-pointer items-center rounded-md border px-2 text-xs')}>
                백업 가져오기
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    void run(async () => {
                      const text = await file.text()
                      const r = await resolveBackupConflict(text)
                      setMsg(r.message)
                    })
                  }}
                />
              </label>
            </div>
            {logs[0] ? (
              <p className="text-[10px] text-muted-foreground">
                최근: {logs[0].at.slice(0, 19)} · {logs[0].mode} · {logs[0].bytes ?? 0}B
              </p>
            ) : null}
          </section>

          {msg ? <p className="rounded-md bg-muted/50 px-2.5 py-2 text-[11px]">{msg}</p> : null}
          <p className="text-[10px] text-muted-foreground">
            iframe 임베드: 공유 생성 후 코드를 외부 사이트에 붙여넣으세요. Storage 버킷
            <code className="mx-1">folio-attachments</code>/<code className="mx-1">folio-backups</code>
            가 있으면 클라우드에 저장됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

export function ExportShareButton() {
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
        <Share2 className="h-3.5 w-3.5" />
        공유·내보내기
      </Button>
      <ExportSharePanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** 임베드 코드만 필요할 때 */
export function copyEmbedForToken(token: string) {
  return buildEmbedCode(token)
}
