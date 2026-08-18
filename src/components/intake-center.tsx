'use client'

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardPaste,
  FileArchive,
  FileText,
  FolderOpen,
  History,
  Inbox,
  RefreshCw,
  GitCompare,
  X,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { saveDocWithFallback, loadDocsWithFallback, type DocEntry } from '@/lib/docs'
import { createDocSnapshot } from '@/lib/doc-versions'
import { DocDiffViewer } from '@/components/doc-diff'
import { loadJournalsWithFallback, saveJournalWithFallback } from '@/lib/journal'
import {
  appendIntakeHistory,
  buildIntakeCandidates,
  canonicalIntakeTags,
  intakeFingerprintsFromTagSets,
  loadIntakeHistory,
  type IntakeCandidate,
  type IntakeHistoryItem,
} from '@/lib/intake'
import { readObsidianMarkdownFiles, uniqueDocTitle } from '@/lib/obsidian'
import { readNotionExport } from '@/lib/notion-import'
import {
  loadImportConnectionAttempts,
  recordImportConnectionAttempt,
  summarizeImportConnection,
  type ImportConnectionAttempt,
} from '@/lib/import-connection'
import { createJournalEntryKey, localDateKey } from '@/lib/personal-assistant'
import { cn } from '@/lib/utils'
import { sourceSystemLabel, type SourceSystem } from '@/lib/provenance'
import {
  appendImportRunHistory,
  createImportRunSummary,
  loadImportRunHistory,
  type ImportRunOutcome,
  type ImportRunSummary,
  retryCandidateFromOutcome,
} from '@/lib/import-run'

export function IntakeCenter({
  onOpenJournal,
  onOpenDoc,
}: {
  onOpenJournal: (entryKey: string, date: string) => void
  onOpenDoc: (docId: string) => void
}) {
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const notionRef = useRef<HTMLInputElement>(null)
  const [candidates, setCandidates] = useState<IntakeCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<IntakeHistoryItem[]>(() => loadIntakeHistory())
  const [pasted, setPasted] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [notionSourceName, setNotionSourceName] = useState('')
  const [notionAttempt, setNotionAttempt] = useState<ImportConnectionAttempt | undefined>(
    () => loadImportConnectionAttempts().notion,
  )
  const [updateModes, setUpdateModes] = useState<Map<string, 'version' | 'new'>>(new Map())
  const [comparison, setComparison] = useState<{ candidate: IntakeCandidate; current: DocEntry } | null>(null)
  const [runSummary, setRunSummary] = useState<ImportRunSummary | null>(null)
  const [runHistory, setRunHistory] = useState<ImportRunSummary[]>(() => loadImportRunHistory())

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selected.has(candidate.fingerprint) && !candidate.duplicate),
    [candidates, selected],
  )
  const routeCounts = useMemo(
    () => ({
      journal: candidates.filter((candidate) => candidate.route === 'journal').length,
      docs: candidates.filter((candidate) => candidate.route === 'docs').length,
      duplicates: candidates.filter((candidate) => candidate.duplicate).length,
      review: candidates.filter((candidate) => candidate.reviewState === 'needs_review').length,
    }),
    [candidates],
  )
  const changeCounts = useMemo(
    () => ({
      new: candidates.filter((candidate) => candidate.changeState === 'new').length,
      changed: candidates.filter((candidate) => candidate.changeState === 'changed').length,
      unchanged: candidates.filter((candidate) => candidate.changeState === 'unchanged').length,
    }),
    [candidates],
  )
  const notionConnection = useMemo(
    () => summarizeImportConnection('notion', history, notionAttempt),
    [history, notionAttempt],
  )

  const prepareFiles = async (files: FileList | File[], sourceSystem: SourceSystem = 'obsidian') => {
    setParsing(true)
    setMessage('')
    setRunSummary(null)
    try {
      const notes = await readObsidianMarkdownFiles(files, 'any')
      const [docs, journals] = await Promise.all([
        loadDocsWithFallback(),
        loadJournalsWithFallback(),
      ])
      const fingerprints = intakeFingerprintsFromTagSets([
        ...docs.map((doc) => doc.tags ?? []),
        ...Object.values(journals).map((entry) => entry.tags ?? []),
      ])
      const next = buildIntakeCandidates(notes, history, new Date(), fingerprints, sourceSystem)
      setCandidates(next)
      setUpdateModes(new Map())
      setSelected(new Set(next.filter((candidate) => candidate.reviewState === 'ready').map((candidate) => candidate.fingerprint)))
      setMessage(next.length ? `${next.length}개 원본을 분석했습니다.` : '가져올 Markdown 파일이 없습니다.')
    } finally {
      setParsing(false)
    }
  }

  const prepareNotion = async (file: File) => {
    setParsing(true)
    setMessage('')
    setRunSummary(null)
    try {
      setNotionSourceName(file.name)
      const [{ notes, databases, attachments }, docs, journals] = await Promise.all([
        readNotionExport(file),
        loadDocsWithFallback(),
        loadJournalsWithFallback(),
      ])
      const fingerprints = intakeFingerprintsFromTagSets([
        ...docs.map((doc) => doc.tags ?? []),
        ...Object.values(journals).map((entry) => entry.tags ?? []),
      ])
      const next = buildIntakeCandidates(notes, history, new Date(), fingerprints, 'notion')
      setCandidates(next)
      setUpdateModes(new Map(
        next
          .filter((candidate) => candidate.changeState === 'changed' && candidate.route === 'docs' && candidate.existingTargetId)
          .map((candidate) => [candidate.fingerprint, 'version' as const]),
      ))
      setSelected(new Set(next.filter((candidate) => candidate.reviewState === 'ready').map((candidate) => candidate.fingerprint)))
      const newCount = next.filter((candidate) => candidate.changeState === 'new').length
      const changedCount = next.filter((candidate) => candidate.changeState === 'changed').length
      const unchangedCount = next.filter((candidate) => candidate.changeState === 'unchanged').length
      setMessage(`Notion 변경분을 확인했습니다. 신규 ${newCount} · 변경 ${changedCount} · 동일 ${unchangedCount}.${databases ? ` 데이터베이스 ${databases}개를 표 문서로 변환했습니다.` : ''}${attachments ? ` 첨부파일 ${attachments}개는 경로만 보존하고 제외했습니다.` : ''}`)
    } catch {
      const error = 'Notion ZIP을 읽지 못했습니다. Markdown & CSV 형식으로 다시 내보내주세요.'
      setNotionAttempt(recordImportConnectionAttempt({ system: 'notion', state: 'error', sourceName: file.name, attemptedAt: new Date().toISOString(), error }))
      setMessage(error)
    } finally {
      setParsing(false)
    }
  }

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) void prepareFiles(event.target.files)
    event.target.value = ''
  }

  const preparePaste = () => {
    if (!pasted.trim()) return
    const file = new File([pasted], `${localDateKey()}-붙여넣기.md`, { type: 'text/markdown' })
    void prepareFiles([file], 'clipboard')
  }

  const importSelected = async () => {
    if (!selectedCandidates.length || importing) return
    setImporting(true)
    setMessage('')
    const imported: IntakeHistoryItem[] = []
    const outcomes: ImportRunOutcome[] = []
    let failed = 0
    let versioned = 0
    try {
      const docs = await loadDocsWithFallback()
      const titles = new Set(docs.map((doc) => doc.title.toLowerCase()))

      for (const candidate of selectedCandidates) {
        try {
          let targetId: string
          if (candidate.route === 'journal') {
            targetId = createJournalEntryKey(candidate.resolvedDate)
            await saveJournalWithFallback(
              candidate.resolvedDate,
              candidate.content,
              canonicalIntakeTags(candidate),
              targetId,
              candidate.provenance,
            )
            outcomes.push({ fingerprint: candidate.fingerprint, title: candidate.title, kind: 'journal', route: 'journal', targetId, date: candidate.resolvedDate })
          } else {
            const updateAsVersion = updateModes.get(candidate.fingerprint) === 'version' && candidate.existingTargetId
            const existing = updateAsVersion ? docs.find((doc) => doc.id === candidate.existingTargetId) : undefined
            if (existing) {
              targetId = existing.id
              createDocSnapshot({ doc: existing, kind: 'checkpoint', note: 'Notion 반영 전', skipIfUnchanged: false })
              const updated: DocEntry = {
                ...existing,
                title: candidate.title || existing.title,
                content: candidate.content,
                category: candidate.category,
                source: candidate.source,
                noteType: candidate.noteType === 'log' ? 'doc' : candidate.noteType,
                tags: canonicalIntakeTags(candidate),
                sourcePath: candidate.relativePath,
                provenance: candidate.provenance,
                updatedAt: new Date().toISOString(),
              }
              await saveDocWithFallback(updated)
              createDocSnapshot({ doc: updated, kind: 'important', note: 'Notion 변경 반영', skipIfUnchanged: false })
              versioned += 1
              const docIndex = docs.findIndex((doc) => doc.id === existing.id)
              if (docIndex >= 0) docs[docIndex] = updated
              outcomes.push({ fingerprint: candidate.fingerprint, title: candidate.title, kind: 'new_version', route: 'docs', targetId })
            } else {
              targetId = crypto.randomUUID()
              const title = uniqueDocTitle(candidate.title || '제목 없는 문서', titles)
              titles.add(title.toLowerCase())
              const createdAt = new Date(`${candidate.resolvedDate}T12:00:00`).toISOString()
              const doc: DocEntry = {
                id: targetId,
                title,
                content: candidate.content,
                category: candidate.category,
                source: candidate.source,
                noteType: candidate.noteType === 'log' ? 'doc' : candidate.noteType,
                tags: canonicalIntakeTags(candidate),
                sourcePath: candidate.relativePath,
                provenance: candidate.provenance,
                createdAt,
                updatedAt: new Date().toISOString(),
              }
              await saveDocWithFallback(doc)
              docs.push(doc)
              outcomes.push({ fingerprint: candidate.fingerprint, title: candidate.title, kind: 'new_document', route: 'docs', targetId })
            }
          }
          imported.push({
            fingerprint: candidate.fingerprint,
            fileName: candidate.fileName,
            relativePath: candidate.relativePath,
            title: candidate.title,
            route: candidate.route,
            targetId,
            date: candidate.resolvedDate,
            importedAt: new Date().toISOString(),
            provenance: candidate.provenance,
          })
        } catch (error) {
          failed += 1
          outcomes.push({
            fingerprint: candidate.fingerprint,
            title: candidate.title,
            kind: 'failed',
            route: candidate.route,
            error: error instanceof Error ? error.message : '저장하지 못했습니다.',
            retryCandidate: candidate,
            retryMode: updateModes.get(candidate.fingerprint) ?? 'new',
          })
        }
      }

      if (imported.length) {
        const nextHistory = appendIntakeHistory(imported)
        setHistory(nextHistory)
        const importedSet = new Set(imported.map((item) => item.fingerprint))
        setCandidates((current) =>
          current.map((candidate) =>
            importedSet.has(candidate.fingerprint) ? { ...candidate, duplicate: true, reviewState: 'duplicate' } : candidate,
          ),
        )
        setSelected(new Set())
        window.dispatchEvent(new CustomEvent('folio-journals-changed'))
        const notionImports = imported.filter((item) => item.provenance?.system === 'notion')
        if (notionImports.length) {
          setNotionAttempt(recordImportConnectionAttempt({
            system: 'notion',
            state: 'ready',
            sourceName: notionSourceName || 'Notion export.zip',
            attemptedAt: notionImports[0].importedAt,
          }))
        }
      }
      setMessage(`${imported.length}개를 반영했습니다.${versioned ? ` 기존 문서 새 버전 ${versioned}개.` : ''}${failed ? ` ${failed}개 실패` : ''}`)
      const summary = createImportRunSummary(
        outcomes,
        candidates.filter((candidate) => candidate.changeState === 'unchanged').length,
        notionSourceName || undefined,
      )
      setRunSummary(summary)
      setRunHistory(appendImportRunHistory(summary))
    } finally {
      setImporting(false)
    }
  }

  const toggleCandidate = (candidate: IntakeCandidate) => {
    if (candidate.duplicate) return
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(candidate.fingerprint)) next.delete(candidate.fingerprint)
      else next.add(candidate.fingerprint)
      return next
    })
  }

  const openComparison = async (candidate: IntakeCandidate) => {
    if (!candidate.existingTargetId) return
    const docs = await loadDocsWithFallback()
    const current = docs.find((doc) => doc.id === candidate.existingTargetId)
    if (current) setComparison({ candidate, current })
    else setMessage('연결된 기존 문서를 찾지 못했습니다. 별도 문서로 가져와주세요.')
  }

  const prepareFailedRetry = async (outcome: ImportRunOutcome) => {
    const stored = retryCandidateFromOutcome(outcome)
    if (!stored) return
    const [docs, journals] = await Promise.all([loadDocsWithFallback(), loadJournalsWithFallback()])
    const fingerprints = intakeFingerprintsFromTagSets([
      ...docs.map((doc) => doc.tags ?? []),
      ...Object.values(journals).map((entry) => entry.tags ?? []),
    ])
    const refreshed = buildIntakeCandidates(
      [stored],
      history,
      new Date(),
      fingerprints,
      stored.provenance.system,
    )[0]
    if (!refreshed || refreshed.duplicate) {
      setMessage(`“${outcome.title}”은 이미 반영되어 재시도하지 않았습니다.`)
      setRunSummary(null)
      return
    }
    setCandidates([refreshed])
    setSelected(new Set([refreshed.fingerprint]))
    setUpdateModes(new Map([[refreshed.fingerprint, outcome.retryMode ?? 'new']]))
    setNotionSourceName(runSummary?.sourceName ?? notionSourceName)
    setRunSummary(null)
    setMessage(`“${outcome.title}” 실패 항목만 다시 준비했습니다. 내용을 확인한 뒤 가져오세요.`)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-violet-900/10 bg-[linear-gradient(135deg,rgba(245,243,255,.96),rgba(255,255,255,.98)_55%,rgba(240,253,250,.92))] p-5 dark:border-violet-300/10 dark:bg-[linear-gradient(135deg,rgba(35,27,55,.85),rgba(12,18,26,.98)_58%,rgba(17,42,39,.8))] sm:p-7">
        <div aria-hidden className="absolute -right-10 -top-12 size-40 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border bg-white/60 px-3 py-1 text-[11px] font-medium text-violet-700 dark:bg-white/5 dark:text-violet-200">
              <Sparkles className="size-3.5" /> Migration-first
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">통합 수집함</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Obsidian과 에이전트가 만든 Markdown을 분석해 일지와 문서로 나눕니다. 기존 기록은 덮어쓰지 않고 언제나 새 원본으로 추가합니다.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[22rem]">
            <Metric label="일지" value={routeCounts.journal} icon={BookOpen} />
            <Metric label="문서" value={routeCounts.docs} icon={FileText} />
            <Metric label={routeCounts.duplicates ? `중복 ${routeCounts.duplicates}` : '검토 필요'} value={routeCounts.review} icon={AlertTriangle} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,.75fr)]">
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 sm:px-6">
            <CardTitle className="flex items-center gap-2"><Inbox className="size-4 text-violet-500" />원본 넣기</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-5 sm:px-6">
            <div
              className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center transition-colors hover:bg-muted/35"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault()
                if (event.dataTransfer.files.length) void prepareFiles(event.dataTransfer.files)
              }}
            >
              <FileArchive className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Markdown 파일이나 볼트 폴더를 놓으세요</p>
              <p className="mt-1 text-xs text-muted-foreground">source · type · created · tags를 읽어 자동 분류합니다.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => filesRef.current?.click()} disabled={parsing}>
                  <Upload className="size-3.5" />파일 선택
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => folderRef.current?.click()} disabled={parsing}>
                  <FolderOpen className="size-3.5" />볼트 폴더
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => notionRef.current?.click()} disabled={parsing}>
                  <FileArchive className="size-3.5" />Notion ZIP
                </Button>
              </div>
              <input ref={filesRef} type="file" accept=".md,text/markdown" multiple className="hidden" onChange={onFiles} />
              <input
                ref={folderRef}
                type="file"
                accept=".md,text/markdown"
                multiple
                className="hidden"
                onChange={onFiles}
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              />
              <input
                ref={notionRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void prepareNotion(file)
                  event.target.value = ''
                }}
              />
            </div>

            <div className="relative flex items-center gap-3"><span className="h-px flex-1 bg-border" /><span className="text-[10px] text-muted-foreground">또는 바로 붙여넣기</span><span className="h-px flex-1 bg-border" /></div>
            <Textarea value={pasted} onChange={(event) => setPasted(event.target.value)} rows={6} placeholder={'---\nsource: manual\ntype: log\ncreated: 2026-08-14\ntags: [folio]\n---\n\n오늘의 기록'} className="font-mono text-xs leading-5" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground" role="status">{message || (parsing ? '원본 분석 중…' : '원본을 먼저 분석한 뒤 가져옵니다.')}</p>
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={preparePaste} disabled={!pasted.trim() || parsing}>
                <ClipboardPaste className="size-3.5" />붙여넣기 분석
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardHeader className="px-5"><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-teal-500" />운영 원칙</CardTitle></CardHeader>
          <CardContent className="space-y-3 px-5 text-sm">
            {[
              ['역할 비중복', 'log는 일지, research·meeting·knowledge는 문서로 분리'],
              ['출처 보존', '원문 시스템·경로·수집 시각·지문·동기화 상태를 기록'],
              ['Append only', '동일 날짜가 있어도 새 항목으로 추가하고 원본을 덮어쓰지 않음'],
              ['중복 방지', '원본 지문을 기록해 같은 파일의 재수집을 차단'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl bg-muted/40 p-3"><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p></div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card role="region" aria-label="Notion 가져오기 상태" className="overflow-hidden border-violet-900/10 py-0 dark:border-violet-300/10">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Notion 가져오기</p>
              <Badge variant={notionConnection.state === 'error' ? 'destructive' : notionConnection.state === 'ready' ? 'default' : 'secondary'}>
                {notionConnection.state === 'error' ? '확인 필요' : notionConnection.state === 'ready' ? '가져옴' : '아직 가져오지 않음'}
              </Badge>
              <span className="text-xs tabular-nums text-muted-foreground">누적 {notionConnection.importedCount}개</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {notionConnection.state === 'never'
                ? 'Notion에서 Markdown & CSV ZIP을 내보내면 원본 경로와 수집 시각을 보존합니다.'
                : notionConnection.state === 'error'
                  ? notionConnection.lastError
                  : `마지막 가져오기 ${new Date(notionConnection.lastImportedAt ?? '').toLocaleString('ko-KR')}`}
            </p>
            {notionConnection.lastSourceName || notionConnection.lastPath ? (
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {[notionConnection.lastSourceName, notionConnection.lastPath].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => notionRef.current?.click()} disabled={parsing}>
            <RefreshCw className="size-3.5" />{notionConnection.state === 'never' ? 'ZIP 선택' : '다시 가져오기'}
          </Button>
        </CardContent>
      </Card>

      {runSummary ? (
        <Card role="region" aria-label="가져오기 실행 요약" className="overflow-hidden border-teal-600/20 bg-[linear-gradient(135deg,rgba(240,253,250,.9),rgba(255,255,255,.98))] py-0 dark:bg-[linear-gradient(135deg,rgba(17,50,45,.65),rgba(12,18,26,.98))]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-200"><CheckCircle2 className="size-4.5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">가져오기 완료</p>
                  {runSummary.sourceName ? <Badge variant="outline">{runSummary.sourceName}</Badge> : null}
                  <span className="text-[10px] text-muted-foreground">{new Date(runSummary.completedAt).toLocaleString('ko-KR')}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <RunMetric label="신규 문서" value={runSummary.newDocuments + runSummary.journals} />
                  <RunMetric label="새 버전" value={runSummary.newVersions} />
                  <RunMetric label="건너뜀" value={runSummary.skipped} />
                  <RunMetric label="실패" value={runSummary.failed} danger={runSummary.failed > 0} />
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="실행 요약 닫기" onClick={() => setRunSummary(null)}><X className="size-4" /></Button>
            </div>
            {runSummary.outcomes.length ? (
              <div className="mt-4 divide-y rounded-xl border bg-background/70">
                {runSummary.outcomes.map((outcome) => (
                  <button
                    key={outcome.fingerprint}
                    type="button"
                    disabled={outcome.kind === 'failed' ? !outcome.retryCandidate : !outcome.targetId}
                    onClick={() => outcome.kind === 'failed'
                      ? void prepareFailedRetry(outcome)
                      : outcome.route === 'journal'
                        ? onOpenJournal(outcome.targetId!, outcome.date ?? localDateKey())
                        : onOpenDoc(outcome.targetId!)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left enabled:hover:bg-muted/50 disabled:cursor-default"
                  >
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{outcome.title}</span>{outcome.error ? <span className="block truncate text-[10px] text-red-600 dark:text-red-300">{outcome.error}</span> : null}</span>
                    <Badge variant={outcome.kind === 'failed' ? 'destructive' : 'secondary'}>{runOutcomeLabel(outcome.kind)}</Badge>
                    {outcome.kind === 'failed' && outcome.retryCandidate ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 dark:text-red-300"><RefreshCw className="size-3" />다시 준비</span> : outcome.targetId ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {runHistory.length ? (
        <Card className="gap-3 py-4" role="region" aria-label="최근 가져오기 실행">
          <CardHeader className="px-5"><CardTitle className="flex items-center gap-2"><History className="size-4 text-violet-500" />최근 가져오기 실행</CardTitle></CardHeader>
          <CardContent className="space-y-1 px-3 sm:px-4">
            {runHistory.slice(0, 5).map((run) => {
              const applied = run.newDocuments + run.newVersions + run.journals
              return (
                <button key={run.completedAt} type="button" onClick={() => setRunSummary(run)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/60">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200"><FileArchive className="size-3.5" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{run.sourceName || '가져오기 실행'}</span><span className="block truncate text-[10px] text-muted-foreground">{new Date(run.completedAt).toLocaleString('ko-KR')} · 반영 {applied} · 건너뜀 {run.skipped} · 실패 {run.failed}</span></span>
                  <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100" />
                </button>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      {candidates.length ? (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div><p className="text-sm font-semibold">분류 결과</p><p className="mt-0.5 text-[11px] text-muted-foreground">신규 {changeCounts.new} · 변경 {changeCounts.changed} · 동일 {changeCounts.unchanged}. 변경분 중 안전한 항목만 기본 선택합니다.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(candidates.filter((candidate) => candidate.reviewState === 'ready').map((candidate) => candidate.fingerprint)))} disabled={importing}>
                안전 항목 선택
              </Button>
              {routeCounts.review ? <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(candidates.filter((candidate) => candidate.reviewState !== 'duplicate').map((candidate) => candidate.fingerprint)))} disabled={importing}>
                검토 항목도 선택
              </Button> : null}
              <Button size="sm" onClick={() => void importSelected()} disabled={!selectedCandidates.length || importing} className="gap-1.5">
                <Inbox className="size-3.5" />{importing ? '가져오는 중…' : `${selectedCandidates.length}개 가져오기`}
              </Button>
            </div>
          </div>
          <ul className="divide-y">
            {candidates.map((candidate) => (
              <li key={`${candidate.relativePath}-${candidate.fingerprint}`} className={cn(candidate.duplicate && 'bg-muted/35 opacity-65')}>
                <div className="grid gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                  <input type="checkbox" aria-label={`${candidate.title} 가져오기`} className={candidate.duplicate ? 'cursor-not-allowed' : 'cursor-pointer'} checked={selected.has(candidate.fingerprint) && !candidate.duplicate} disabled={candidate.duplicate} onChange={() => toggleCandidate(candidate)} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{candidate.title}</span>
                      {candidate.changeState === 'changed' ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200">변경됨</Badge> : null}
                      {candidate.changeState === 'new' ? <Badge variant="outline">신규</Badge> : null}
                      {candidate.duplicate ? <Badge variant="secondary">동일 · 건너뜀</Badge> : null}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-muted-foreground">{candidate.relativePath} · {candidate.resolvedDate}</span>
                    {candidate.changeState === 'changed' && candidate.route === 'docs' && candidate.existingTargetId ? (
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex rounded-lg border bg-background p-0.5" role="group" aria-label={`${candidate.title} 변경 반영 방식`}>
                          <button type="button" className={cn('rounded-md px-2 py-1 text-[10px]', updateModes.get(candidate.fingerprint) !== 'new' ? 'bg-violet-100 font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100' : 'text-muted-foreground')} onClick={() => setUpdateModes((current) => new Map(current).set(candidate.fingerprint, 'version'))}>새 버전 반영</button>
                          <button type="button" className={cn('rounded-md px-2 py-1 text-[10px]', updateModes.get(candidate.fingerprint) === 'new' ? 'bg-violet-100 font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100' : 'text-muted-foreground')} onClick={() => setUpdateModes((current) => new Map(current).set(candidate.fingerprint, 'new'))}>별도 문서 추가</button>
                        </span>
                        <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/50" onClick={() => void openComparison(candidate)}>
                          <GitCompare className="size-3" />변경 비교
                        </button>
                      </span>
                    ) : null}
                    {candidate.warnings.length ? <span className="mt-1.5 flex flex-wrap gap-1"><Badge variant="outline" className="text-[9px] text-amber-700 dark:text-amber-300">검토 필요</Badge>{candidate.warnings.map((warning) => <Badge key={warning} variant="outline" className="text-[9px] text-amber-700 dark:text-amber-300">{warning}</Badge>)}</span> : null}
                  </span>
                  <span className="flex items-center gap-2 text-[11px]">
                    <Badge variant="outline">{sourceSystemLabel(candidate.provenance.system)}</Badge><Badge>{candidate.noteType}</Badge><ArrowRight className="size-3" /><Badge variant="secondary">{candidate.route === 'journal' ? '일지' : candidate.category}</Badge>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {history.length ? (
        <Card className="gap-3 py-4">
          <CardHeader className="px-5"><CardTitle className="flex items-center gap-2"><History className="size-4" />최근 수집 이력</CardTitle></CardHeader>
          <CardContent className="space-y-1 px-3 sm:px-4">
            {history.slice(0, 8).map((item) => (
              <button key={item.fingerprint} type="button" onClick={() => item.route === 'journal' ? onOpenJournal(item.targetId, item.date ?? localDateKey()) : onOpenDoc(item.targetId)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/60">
                {item.route === 'journal' ? <BookOpen className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-[10px] text-muted-foreground">{item.relativePath} · {new Date(item.importedAt).toLocaleString('ko-KR')}</span></span>
                <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {comparison ? (
        <DocDiffViewer
          open
          onClose={() => setComparison(null)}
          before={{ label: '현재 Folio', title: comparison.current.title, content: comparison.current.content }}
          after={{ label: 'Notion 변경본', title: comparison.candidate.title, content: comparison.candidate.content }}
        />
      ) : null}
    </div>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CheckCircle2 }) {
  return <div className="rounded-2xl border bg-white/60 p-3 dark:bg-white/5"><div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon className="size-3" />{label}</div><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>
}

function RunMetric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className="rounded-xl border bg-background/70 px-3 py-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className={cn('mt-0.5 text-lg font-semibold tabular-nums', danger && 'text-red-600 dark:text-red-300')}>{value}</p></div>
}

function runOutcomeLabel(kind: ImportRunOutcome['kind']): string {
  if (kind === 'new_version') return '새 버전'
  if (kind === 'new_document') return '신규 문서'
  if (kind === 'journal') return '신규 일지'
  return '실패'
}
