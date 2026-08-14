import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { cleanNotionTitle, parseCsvRows, readNotionExport } from '@/lib/notion-import'

describe('Notion export importer', () => {
  it('removes Notion export ids from page titles', () => {
    expect(cleanNotionTitle('Product Plan 1234567890abcdef1234567890abcdef.md')).toBe('Product Plan')
  })

  it('parses quoted database cells', () => {
    expect(parseCsvRows('Name,Notes\nPlan,"first, then second"')).toEqual([
      ['Name', 'Notes'],
      ['Plan', 'first, then second'],
    ])
  })

  it('reads nested Markdown pages and reports unsupported files', async () => {
    const zip = new JSZip()
    zip.file('Workspace/Product Plan 1234567890abcdef1234567890abcdef.md', '# Product Plan\n\nNext step')
    zip.file('Workspace/Database.csv', 'Name,Status\nA,Done')
    zip.file('Workspace/image.png', new Uint8Array([1, 2, 3]))
    const archive = await zip.generateAsync({ type: 'arraybuffer' })
    const result = await readNotionExport(new File([archive], 'notion.zip', { type: 'application/zip' }))

    expect(result.notes).toHaveLength(2)
    expect(result.notes[0]).toMatchObject({
      title: 'Product Plan',
      relativePath: 'Notion/Workspace/Product Plan 1234567890abcdef1234567890abcdef.md',
    })
    expect(result.notes[1]).toMatchObject({
      title: 'Database',
      tags: ['notion-database'],
    })
    expect(result.notes[1]?.content).toContain('| Name | Status |')
    expect(result.databases).toBe(1)
    expect(result.attachments).toBe(1)
  })
})
