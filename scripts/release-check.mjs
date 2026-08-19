#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const failures = []
const warnings = []
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
if (Boolean(supabaseUrl) !== Boolean(supabaseKey)) {
  failures.push('Supabase URL과 anon key는 함께 설정해야 합니다.')
}
if (!supabaseUrl && !process.env.FOLIO_API_SECRET) {
  warnings.push('클라우드 인증이 없습니다. 공개 배포에서는 AI/Jira/Beacon API가 닫힙니다.')
}
if (process.env.FOLIO_ALLOW_LOCAL_API === '1' && process.env.NODE_ENV === 'production') {
  failures.push('공개 production 환경에서 FOLIO_ALLOW_LOCAL_API=1을 사용하면 안 됩니다.')
}

for (const relative of [
  '.next/standalone/server.js',
  '.next/standalone/public/manifest.json',
  '.next/standalone/.next/static',
  '.next/standalone/release.json',
]) {
  await access(path.join(root, relative)).catch(() => failures.push(`패키지 파일 누락: ${relative}`))
}

for (const warning of warnings) console.warn(`WARN ${warning}`)
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exit(1)
}

console.log(`OK Folio ${packageJson.version} standalone release package`)
