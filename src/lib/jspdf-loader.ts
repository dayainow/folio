/**
 * P66 — jspdf 지연 로드 (초기 번들에서 PDF 엔진 분리)
 */
'use client'

export type JsPdfCtor = typeof import('jspdf').jsPDF

let cached: JsPdfCtor | null = null

export async function loadJsPdf(): Promise<JsPdfCtor> {
  if (cached) return cached
  const mod = await import('jspdf')
  cached = mod.jsPDF
  return cached
}
