import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { GET } from '@/app/api/share/[token]/route'
import { putShare, type StoredShare } from '@/lib/share-server-store'

describe('public share response', () => {
  it('does not expose stored HTML to the public renderer', async () => {
    const token = 'securitytesttoken0123456789abcdef'
    const share: StoredShare = {
      token,
      title: '공유 문서',
      type: 'doc',
      passwordHash: null,
      expiresAt: null,
      createdAt: '2026-08-19T00:00:00.000Z',
      views: 0,
      downloads: 0,
      snapshot: {
        type: 'doc',
        title: '공유 문서',
        html: '<img src=x onerror="alert(1)"><script>alert(1)</script>',
        markdown: '# 안전한 문서\n\n<script>alert(1)</script>',
      },
    }
    await putShare(share)

    const response = await GET(
      new Request(`https://folio.example/api/share/${token}`),
      { params: Promise.resolve({ token }) },
    )
    const payload = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(payload).not.toHaveProperty('html')
    expect(payload.markdown).toBe(share.snapshot.markdown)
  })

  it('renders embedded HTML as inert text instead of executable markup', () => {
    const rendered = renderToStaticMarkup(
      createElement(ReactMarkdown, {
        remarkPlugins: [remarkGfm],
      }, '# 문서\n\n<img src=x onerror="alert(1)"><script>alert(1)</script>'),
    )

    expect(rendered).toContain('<h1>문서</h1>')
    expect(rendered).toContain('&lt;img')
    expect(rendered).not.toContain('<img')
    expect(rendered).not.toContain('<script')
  })
})
