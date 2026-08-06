/**
 * P63 — PDF 레이아웃 (표지 · 목차 · 쪽 번호 · 여백 · A4/Letter)
 */
'use client'

import { jsPDF } from 'jspdf'
import type { ProgressFn } from '@/lib/export'

export type PaperSize = 'a4' | 'letter'

export type PdfSection = {
  /** 목차 라벨 */
  heading: string
  /** 본문 줄 (plain text) */
  lines: string[]
}

export type PdfLayoutOptions = {
  paper?: PaperSize
  /** 여백 mm (기본 15) */
  marginMm?: number
  /** 표지 */
  cover?: boolean
  coverTitle?: string
  coverSubtitle?: string
  /** 목차 */
  toc?: boolean
  /** 쪽 번호 */
  pageNumbers?: boolean
  /** 문서 메타 푸터 */
  footerLabel?: string
}

const DEFAULTS: Required<
  Pick<PdfLayoutOptions, 'paper' | 'marginMm' | 'cover' | 'toc' | 'pageNumbers'>
> = {
  paper: 'a4',
  marginMm: 15,
  cover: true,
  toc: true,
  pageNumbers: true,
}

/** mm → pt (1in = 72pt = 25.4mm) */
function mmToPt(mm: number): number {
  return (mm * 72) / 25.4
}

/**
 * 표지/목차/쪽번호가 있는 멀티 섹션 PDF 생성
 */
export function buildSectionedPdf(
  title: string,
  sections: PdfSection[],
  opts: PdfLayoutOptions = {},
  onProgress?: ProgressFn,
): Blob {
  const paper = opts.paper ?? DEFAULTS.paper
  const marginMm = opts.marginMm ?? DEFAULTS.marginMm
  const withCover = opts.cover ?? DEFAULTS.cover
  const withToc = opts.toc ?? DEFAULTS.toc
  const withPages = opts.pageNumbers ?? DEFAULTS.pageNumbers
  const coverTitle = opts.coverTitle ?? title
  const coverSubtitle = opts.coverSubtitle ?? `Folio · ${new Date().toISOString().slice(0, 10)}`
  const footerLabel = opts.footerLabel ?? 'Folio'

  const doc = new jsPDF({ unit: 'pt', format: paper })
  const margin = mmToPt(marginMm)
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const maxW = pageW - margin * 2
  let y = margin

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }

  const writeWrapped = (text: string, fontSize: number, style: 'normal' | 'bold' = 'normal', gap = 4) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text || ' ', maxW) as string[]
    const lineH = fontSize * 1.25
    for (const line of lines) {
      ensureSpace(lineH)
      doc.text(line, margin, y)
      y += lineH
    }
    y += gap
  }

  onProgress?.(0.05, 'PDF 표지…')

  if (withCover) {
    y = pageH * 0.35
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    const titleLines = doc.splitTextToSize(coverTitle, maxW) as string[]
    for (const tl of titleLines) {
      doc.text(tl, margin, y)
      y += 28
    }
    y += 12
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text(coverSubtitle, margin, y)
    y += 18
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`${sections.length} sections · ${paper.toUpperCase()} · margin ${marginMm}mm`, margin, y)
    doc.setTextColor(0)
    doc.addPage()
    y = margin
  }

  onProgress?.(0.15, 'PDF 목차…')

  if (withToc && sections.length > 0) {
    writeWrapped('Contents', 16, 'bold', 10)
    sections.forEach((s, i) => {
      writeWrapped(`${i + 1}. ${s.heading}`, 11, 'normal', 2)
    })
    doc.addPage()
    y = margin
  }

  const total = Math.max(1, sections.length)
  for (let i = 0; i < sections.length; i += 1) {
    const sec = sections[i]!
    writeWrapped(sec.heading, 14, 'bold', 8)
    for (const line of sec.lines) {
      writeWrapped(line, 10, 'normal', 2)
    }
    y += 10
    onProgress?.(0.2 + (0.7 * (i + 1)) / total, `PDF ${i + 1}/${sections.length}`)
  }

  if (withPages) {
    const n = doc.getNumberOfPages()
    for (let p = 1; p <= n; p += 1) {
      doc.setPage(p)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(120)
      const label = `${footerLabel} · ${p} / ${n}`
      doc.text(label, pageW / 2, pageH - margin / 2, { align: 'center' })
      doc.setTextColor(0)
    }
  }

  onProgress?.(1, 'PDF 완료')
  return doc.output('blob')
}
