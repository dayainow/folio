'use client'

/**
 * P32 — 일지+문서+보드 전체 ZIP 내보내기 (헤더)
 */
import { ExportMenu } from '@/components/export-menu'
import { loadDocsWithFallback } from '@/lib/docs'
import { loadJournalsWithFallback } from '@/lib/journal'
import { loadTasksWithFallback } from '@/lib/board'
import {
  downloadBlob,
  fullExportFilename,
  zipFullExport,
} from '@/lib/export'

export function FullExportButton() {
  return (
    <ExportMenu
      label="전체 내보내기"
      size="sm"
      items={[
        {
          id: 'zip-all',
          label: 'ZIP 번들',
          description: 'journals/ · docs/ · boards/ · metadata.json',
          run: async (setProgress) => {
            setProgress(0.05, '데이터 로드…')
            const [journals, docs, tasks] = await Promise.all([
              loadJournalsWithFallback(),
              loadDocsWithFallback(),
              loadTasksWithFallback(),
            ])
            setProgress(0.15, 'ZIP 구성…')
            const blob = await zipFullExport(
              {
                journals,
                docs,
                tasks,
                version: process.env.NEXT_PUBLIC_FOLIO_VERSION ?? process.env.npm_package_version ?? '3.8.0-wip',
              },
              (r, label) => setProgress(0.15 + r * 0.85, label),
            )
            downloadBlob(blob, fullExportFilename())
            void import('@/lib/security-audit').then(({ recordSecurityAudit }) =>
              recordSecurityAudit({
                action: 'export',
                resource: 'full-zip',
                detail: `j=${Object.keys(journals).length} d=${docs.length} b=${tasks.length}`,
              }),
            )
          },
        },
      ]}
    />
  )
}
