/**
 * P63 — 자동 리포트 · 템플릿 커스터마이징
 */
'use client'

import { loadJournalsWithFallback } from '@/lib/journal'
import { loadDocsWithFallback } from '@/lib/docs'
import { loadTasksWithFallback, type Task } from '@/lib/board'
import { fetchBeaconSummary } from '@/lib/beacon'
import {
  computeJournalAnalytics,
  getBoardAnalytics,
  getCombinedProductivityMetrics,
} from '@/lib/analytics'
import { filterJournalsByRange } from '@/lib/export'
import { buildSectionedPdf, type PdfLayoutOptions, type PdfSection } from '@/lib/pdf-layout'
import { downloadText } from '@/lib/export'
import { downloadHtml, downloadPdf } from '@/lib/export-rich'
import { sendEmailNotification } from '@/lib/email-notify'
import { monthRangeOf, weekRangeOf, buildPrintableHtml } from '@/lib/export-advanced'

export type ReportSectionId =
  | 'summary'
  | 'journals'
  | 'tasks'
  | 'gates'
  | 'stats'
  | 'trends'
  | 'achievements'

export type ReportKind = 'weekly' | 'monthly' | 'project'

export const ALL_REPORT_SECTIONS: ReportSectionId[] = [
  'summary',
  'journals',
  'tasks',
  'gates',
  'stats',
  'trends',
  'achievements',
]

export const SECTION_LABELS: Record<ReportSectionId, string> = {
  summary: '요약',
  journals: '일지',
  tasks: '태스크',
  gates: 'Gate 상태',
  stats: '통계',
  trends: '트렌드',
  achievements: '성과',
}

export type ReportTemplate = {
  id: string
  name: string
  kind: ReportKind
  /** 표시 순서 */
  sections: ReportSectionId[]
  /** false면 제외 */
  include: Partial<Record<ReportSectionId, boolean>>
  createdAt: string
  updatedAt: string
}

const TEMPLATES_KEY = 'folio_report_templates_v1'

export type ReportBundle = {
  kind: ReportKind
  title: string
  from: string
  to: string
  markdown: string
  htmlBody: string
  sections: PdfSection[]
  generatedAt: string
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultInclude(kind: ReportKind): Partial<Record<ReportSectionId, boolean>> {
  if (kind === 'weekly') {
    return {
      summary: true,
      journals: true,
      tasks: true,
      gates: true,
      stats: true,
      trends: false,
      achievements: false,
    }
  }
  if (kind === 'monthly') {
    return {
      summary: true,
      journals: true,
      tasks: true,
      gates: true,
      stats: true,
      trends: true,
      achievements: true,
    }
  }
  return {
    summary: true,
    journals: true,
    tasks: true,
    gates: true,
    stats: true,
    trends: true,
    achievements: true,
  }
}

export function defaultTemplate(kind: ReportKind, name?: string): ReportTemplate {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: name ?? (kind === 'weekly' ? '주간 리포트' : kind === 'monthly' ? '월간 리포트' : '프로젝트 리포트'),
    kind,
    sections: [...ALL_REPORT_SECTIONS],
    include: defaultInclude(kind),
    createdAt: now,
    updatedAt: now,
  }
}

export function loadReportTemplates(): ReportTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (!raw) return seedDefaults()
    const parsed = JSON.parse(raw) as ReportTemplate[]
    return Array.isArray(parsed) ? parsed : seedDefaults()
  } catch {
    return seedDefaults()
  }
}

function seedDefaults(): ReportTemplate[] {
  const seeds = [
    defaultTemplate('weekly', '주간 기본'),
    defaultTemplate('monthly', '월간 기본'),
    defaultTemplate('project', '프로젝트 기본'),
  ]
  saveReportTemplates(seeds)
  return seeds
}

export function saveReportTemplates(list: ReportTemplate[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list.slice(0, 40)))
  } catch {
    /* ignore */
  }
}

export function upsertReportTemplate(tpl: ReportTemplate): ReportTemplate[] {
  const list = loadReportTemplates()
  const i = list.findIndex((t) => t.id === tpl.id)
  const next = { ...tpl, updatedAt: new Date().toISOString() }
  if (i >= 0) list[i] = next
  else list.unshift(next)
  saveReportTemplates(list)
  return list
}

export function deleteReportTemplate(id: string): ReportTemplate[] {
  const list = loadReportTemplates().filter((t) => t.id !== id)
  saveReportTemplates(list)
  return list
}

function enabledSections(tpl: ReportTemplate): ReportSectionId[] {
  return tpl.sections.filter((id) => tpl.include[id] !== false)
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type GateSnapshot = {
  currentGateLabel: string | null
  progressPercent: number
  readyStages: number
  totalStages: number
  stages: Array<{ name: string; gateStatus: string }>
}

async function loadGateSnapshot(): Promise<GateSnapshot | null> {
  try {
    const vm = await fetchBeaconSummary()
    const p = vm.summary
    if (!p) return null
    return {
      currentGateLabel: p.currentGateLabel,
      progressPercent: p.progressPercent,
      readyStages: p.readyStages,
      totalStages: p.totalStages,
      stages: (p.stages ?? []).map((s) => ({ name: s.name, gateStatus: s.gateStatus })),
    }
  } catch {
    return null
  }
}

function rangeFor(kind: ReportKind, anchor: string): { from: string; to: string } {
  if (kind === 'monthly') return monthRangeOf(anchor)
  if (kind === 'project') {
    // 프로젝트: 최근 30일
    const end = new Date(`${anchor}T12:00:00`)
    const start = new Date(end)
    start.setDate(end.getDate() - 29)
    return { from: toDateStr(start), to: toDateStr(end) }
  }
  return weekRangeOf(anchor)
}

export async function buildReport(
  kind: ReportKind,
  template: ReportTemplate,
  anchorDate = toDateStr(new Date()),
): Promise<ReportBundle> {
  const { from, to } = rangeFor(kind, anchorDate)
  const [journals, docs, tasks, board, productivity, gates] = await Promise.all([
    loadJournalsWithFallback(),
    loadDocsWithFallback(),
    loadTasksWithFallback(),
    getBoardAnalytics(kind === 'monthly' ? '1m' : '1w'),
    getCombinedProductivityMetrics(kind === 'monthly' ? '1m' : '1w'),
    loadGateSnapshot(),
  ])

  const journalEntries = filterJournalsByRange(journals, from, to).sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const journalAnalytics = computeJournalAnalytics(journals, kind === 'monthly' ? '1m' : '1w')
  const tasksInRange = tasks.filter((t) => {
    const d = (t.updatedAt || t.createdAt || '').slice(0, 10)
    return d >= from && d <= to
  })
  const done = tasksInRange.filter((t) => t.status === 'done')
  const docsTouched = docs.filter((d) => {
    const d0 = (d.updatedAt || d.createdAt || '').slice(0, 10)
    return d0 >= from && d0 <= to
  })

  const title =
    kind === 'weekly'
      ? `주간 리포트 (${from} ~ ${to})`
      : kind === 'monthly'
        ? `월간 리포트 (${from.slice(0, 7)})`
        : `프로젝트 리포트 (${from} ~ ${to})`

  const sectionsOut: PdfSection[] = []
  const mdParts: string[] = [
    '---',
    `type: folio-report`,
    `kind: ${kind}`,
    `from: ${from}`,
    `to: ${to}`,
    `exportedAt: ${new Date().toISOString()}`,
    '---',
    '',
    `# ${title}`,
    '',
  ]
  const htmlParts: string[] = [`<h1>${esc(title)}</h1><p class="meta">${esc(from)} ~ ${esc(to)}</p>`]

  const push = (id: ReportSectionId, heading: string, lines: string[], mdBody: string, htmlBody: string) => {
    if (!enabledSections(template).includes(id)) return
    sectionsOut.push({ heading, lines })
    mdParts.push(`## ${heading}`, '', mdBody, '')
    htmlParts.push(`<section><h2>${esc(heading)}</h2>${htmlBody}</section>`)
  }

  // summary
  {
    const lines = [
      `기간: ${from} ~ ${to}`,
      `일지: ${journalEntries.length}건`,
      `태스크(기간 내 갱신): ${tasksInRange.length} · 완료 ${done.length}`,
      `문서 갱신: ${docsTouched.length}`,
      gates
        ? `Gate: ${gates.currentGateLabel ?? '-'} · ${gates.progressPercent}% (${gates.readyStages}/${gates.totalStages})`
        : 'Gate: (Beacon 미연동)',
    ]
    push(
      'summary',
      '요약',
      lines,
      lines.map((l) => `- ${l}`).join('\n'),
      `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`,
    )
  }

  // journals
  {
    const lines =
      journalEntries.length === 0
        ? ['(일지 없음)']
        : journalEntries.flatMap((e) => [
            `${e.date} · tags ${(e.tags ?? []).join(', ') || '-'}`,
            (e.content || '').slice(0, 280).replace(/\n/g, ' '),
            '',
          ])
    const md =
      journalEntries.length === 0
        ? '_(없음)_'
        : journalEntries
            .map((e) => `### ${e.date}\n\n${(e.content || '').slice(0, 500)}\n`)
            .join('\n')
    const html =
      journalEntries.length === 0
        ? '<p>(없음)</p>'
        : journalEntries
            .map(
              (e) =>
                `<article><h3>${esc(e.date)}</h3><p>${esc((e.content || '').slice(0, 400))}</p></article>`,
            )
            .join('')
    push('journals', '일지', lines, md, html)
  }

  // tasks
  {
    const byStatus = (status: Task['status']) => tasksInRange.filter((t) => t.status === status)
    const lines = [
      `backlog ${byStatus('backlog').length} · in_progress ${byStatus('in_progress').length} · review ${byStatus('review').length} · done ${byStatus('done').length}`,
      '',
      ...tasksInRange.slice(0, 40).map((t) => `[${t.status}/${t.priority}] ${t.title}`),
    ]
    const md = [
      `- backlog: ${byStatus('backlog').length}`,
      `- in_progress: ${byStatus('in_progress').length}`,
      `- review: ${byStatus('review').length}`,
      `- done: ${byStatus('done').length}`,
      '',
      ...tasksInRange.slice(0, 40).map((t) => `- **${t.title}** (${t.status}/${t.priority})`),
    ].join('\n')
    const html = `<ul>${tasksInRange
      .slice(0, 40)
      .map((t) => `<li><strong>${esc(t.title)}</strong> — ${esc(t.status)}/${esc(t.priority)}</li>`)
      .join('')}</ul>`
    push('tasks', '태스크', lines, md, html)
  }

  // gates
  {
    const lines = gates
      ? [
          `현재: ${gates.currentGateLabel ?? '-'}`,
          `진행률: ${gates.progressPercent}%`,
          `Ready: ${gates.readyStages}/${gates.totalStages}`,
          '',
          ...gates.stages.map((s) => `${s.name}: ${s.gateStatus}`),
        ]
      : ['Beacon Gate 정보를 불러오지 못했습니다.']
    const md = lines.map((l) => (l ? `- ${l}` : '')).join('\n')
    const html = `<ul>${lines.filter(Boolean).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`
    push('gates', 'Gate 상태', lines, md, html)
  }

  // stats
  {
    const lines = [
      `일지 총 단어(기간 분석): ${journalAnalytics.totalWords}`,
      `일지 엔트리: ${journalAnalytics.totalEntries}`,
      `보드 완료(분석): ${board.completedCount}`,
      `평균 완료 시간(h): ${board.avgCompletionHours ?? '-'}`,
      `문서 수(전체): ${docs.length}`,
    ]
    push(
      'stats',
      '통계',
      lines,
      lines.map((l) => `- ${l}`).join('\n'),
      `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`,
    )
  }

  // trends
  {
    const trend = productivity.trend?.slice(-14) ?? []
    const lines =
      trend.length === 0
        ? ['(트렌드 데이터 없음)']
        : trend.map(
            (p) =>
              `${p.date}: score ${Math.round(p.productivityScore)} · journal ${p.journalCount} · done ${p.completedTasks}`,
          )
    const md = lines.map((l) => `- ${l}`).join('\n')
    const html = `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`
    push('trends', '트렌드', lines, md, html)
  }

  // achievements
  {
    const topTags = journalAnalytics.tags.slice(0, 8).map((t) => `${t.tag} (${t.count})`)
    const lines = [
      `완료 태스크: ${done.length}`,
      `상위 태그: ${topTags.join(', ') || '-'}`,
      `주간 평균 생산성: ${productivity.avgWeeklyScore}`,
      `WoW 성장: ${productivity.wowGrowthPercent}%`,
    ]
    push(
      'achievements',
      '성과',
      lines,
      lines.map((l) => `- ${l}`).join('\n'),
      `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`,
    )
  }

  return {
    kind,
    title,
    from,
    to,
    markdown: mdParts.join('\n'),
    htmlBody: htmlParts.join('\n'),
    sections: sectionsOut,
    generatedAt: new Date().toISOString(),
  }
}

export async function downloadReport(
  bundle: ReportBundle,
  format: 'md' | 'html' | 'pdf',
  layout: PdfLayoutOptions = {},
): Promise<void> {
  const base = `folio-${bundle.kind}-report-${bundle.from}_${bundle.to}`
  if (format === 'md') {
    downloadText(bundle.markdown, `${base}.md`)
    return
  }
  if (format === 'html') {
    const html = buildPrintableHtml(bundle.title, bundle.htmlBody, layout.paper ?? 'a4')
    downloadHtml(html, `${base}.html`)
    return
  }
  const blob = await buildSectionedPdf(bundle.title, bundle.sections, {
    cover: true,
    toc: true,
    pageNumbers: true,
    ...layout,
    coverTitle: bundle.title,
    coverSubtitle: `${bundle.from} ~ ${bundle.to}`,
  })
  downloadPdf(blob, base)
}

export async function emailReport(bundle: ReportBundle): Promise<{ ok: boolean; reason?: string; skipped?: boolean }> {
  return sendEmailNotification({
    subject: `[Folio] ${bundle.title}`,
    text: bundle.markdown.slice(0, 12000),
    html: `<h1>${bundle.title}</h1>${bundle.htmlBody}`.slice(0, 20000),
    kind: 'digest',
  })
}

/** 테스트/미리보기용: 데이터 없이 섹션 순서만 검증 */
export function resolveTemplateSections(tpl: ReportTemplate): ReportSectionId[] {
  return enabledSections(tpl)
}
