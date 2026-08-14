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
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { saveDocWithFallback, loadDocsWithFallback, type DocEntry } from '@/lib/docs'
import { loadJournalsWithFallback, saveJournalWithFallback } from '@/lib/journal'
import {
  appendIntakeHistory,
  buildIntakeCandidates,
  intakeFingerprintsFromTagSets,
  intakeTags,
  loadIntakeHistory,
  type IntakeCandidate,
  type IntakeHistoryItem,
} from '@/lib/intake'
import { readObsidianMarkdownFiles, uniqueDocTitle } from '@/lib/obsidian'
import { createJournalEntryKey, localDateKey } from '@/lib/personal-assistant'
import { cn } from '@/lib/utils'

export function IntakeCenter({
  onOpenJournal,
  onOpenDoc,
}: {
  onOpenJournal: (entryKey: string, date: string) => void
  onOpenDoc: (docId: string) => void
}) {
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const [candidates, setCandidates] = useState<IntakeCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [history, setHistory] = useState<IntakeHistoryItem[]>(() => loadIntakeHistory())
  const [pasted, setPasted] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selected.has(candidate.fingerprint) && !candidate.duplicate),
    [candidates, selected],
  )
  const routeCounts = useMemo(
    () => ({
      journal: candidates.filter((candidate) => candidate.route === 'journal').length,
      docs: candidates.filter((candidate) => candidate.route === 'docs').length,
      warnings: candidates.filter((candidate) => candidate.warnings.length > 0).length,
    }),
    [candidates],
  )

  const prepareFiles = async (files: FileList | File[]) => {
    setParsing(true)
    setMessage('')
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
      const next = buildIntakeCandidates(notes, history, new Date(), fingerprints)
      setCandidates(next)
      setSelected(new Set(next.filter((candidate) => !candidate.duplicate).map((candidate) => candidate.fingerprint)))
      setMessage(next.length ? `${next.length}개 원본을 분석했습니다.` : '가져올 Markdown 파일이 없습니다.')
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
    void prepareFiles([file])
  }

  const importSelected = async () => {
    if (!selectedCandidates.length || importing) return
    setImporting(true)
    setMessage('')
    const imported: IntakeHistoryItem[] = []
    let failed = 0
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
              intakeTags(candidate),
              targetId,
            )
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
              tags: intakeTags(candidate),
              sourcePath: candidate.relativePath,
              createdAt,
              updatedAt: new Date().toISOString(),
            }
            await saveDocWithFallback(doc)
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
          })
        } catch {
          failed += 1
        }
      }

      if (imported.length) {
        const nextHistory = appendIntakeHistory(imported)
        setHistory(nextHistory)
        const importedSet = new Set(imported.map((item) => item.fingerprint))
        setCandidates((current) =>
          current.map((candidate) =>
            importedSet.has(candidate.fingerprint) ? { ...candidate, duplicate: true } : candidate,
          ),
        )
        setSelected(new Set())
        window.dispatchEvent(new CustomEvent('folio-journals-changed'))
      }
      setMessage(`${imported.length}개를 새 기록으로 가져왔습니다.${failed ? ` ${failed}개 실패` : ''}`)
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
            <Metric label="보완 필요" value={routeCounts.warnings} icon={AlertTriangle} />
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
              ['마이그레이션 우선', 'frontmatter의 출처·유형·날짜·태그를 그대로 보존'],
              ['Append only', '동일 날짜가 있어도 새 항목으로 추가하고 원본을 덮어쓰지 않음'],
              ['중복 방지', '원본 지문을 기록해 같은 파일의 재수집을 차단'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl bg-muted/40 p-3"><p className="text-xs font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p></div>
            ))}
          </CardContent>
        </Card>
      </div>

      {candidates.length ? (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div><p className="text-sm font-semibold">분류 결과</p><p className="mt-0.5 text-[11px] text-muted-foreground">체크한 원본만 가져옵니다.</p></div>
            <Button size="sm" onClick={() => void importSelected()} disabled={!selectedCandidates.length || importing} className="gap-1.5">
              <Inbox className="size-3.5" />{importing ? '가져오는 중…' : `${selectedCandidates.length}개 가져오기`}
            </Button>
          </div>
          <ul className="divide-y">
            {candidates.map((candidate) => (
              <li key={`${candidate.relativePath}-${candidate.fingerprint}`}>
                <label className={cn('grid cursor-pointer gap-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5', candidate.duplicate && 'cursor-not-allowed bg-muted/35 opacity-65')}>
                  <input type="checkbox" checked={selected.has(candidate.fingerprint) && !candidate.duplicate} disabled={candidate.duplicate} onChange={() => toggleCandidate(candidate)} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{candidate.title}</span>{candidate.duplicate ? <Badge variant="secondary">이미 수집됨</Badge> : null}</span>
                    <span className="mt-1 block truncate text-[11px] text-muted-foreground">{candidate.relativePath} · {candidate.resolvedDate}</span>
                    {candidate.warnings.length ? <span className="mt-1.5 flex flex-wrap gap-1">{candidate.warnings.map((warning) => <Badge key={warning} variant="outline" className="text-[9px] text-amber-700 dark:text-amber-300">{warning}</Badge>)}</span> : null}
                  </span>
                  <span className="flex items-center gap-2 text-[11px]">
                    <Badge variant="outline">{candidate.source}</Badge><Badge>{candidate.noteType}</Badge><ArrowRight className="size-3" /><Badge variant="secondary">{candidate.route === 'journal' ? '일지' : candidate.category}</Badge>
                  </span>
                </label>
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
    </div>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CheckCircle2 }) {
  return <div className="rounded-2xl border bg-white/60 p-3 dark:bg-white/5"><div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon className="size-3" />{label}</div><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>
}
