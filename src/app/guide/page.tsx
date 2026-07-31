import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Metadata } from 'next'
import { GuideView } from '@/components/guide-view'

export const metadata: Metadata = {
  title: '가이드 · Folio',
  description: 'Folio 온보딩 · 기능 · 문제 해결 가이드',
}

async function loadGuideMarkdown(name: string): Promise<string> {
  const filePath = path.join(process.cwd(), 'docs', name)
  return readFile(filePath, 'utf8')
}

export default async function GuidePage() {
  const [onboarding, features, troubleshooting] = await Promise.all([
    loadGuideMarkdown('ONBOARDING.md'),
    loadGuideMarkdown('FEATURES.md'),
    loadGuideMarkdown('TROUBLESHOOTING.md'),
  ])

  return (
    <GuideView
      docs={{
        onboarding,
        features,
        troubleshooting,
      }}
    />
  )
}
