#!/usr/bin/env node
/**
 * 다른 프로젝트에 Folio MCP + 작업기록 규칙을 설치한다.
 *
 * 사용:
 *   npm run mcp:link -- /path/to/other-project
 *   npm run mcp:link -- /path/to/other-project --folio /path/to/folio
 *   npm run mcp:link -- /path/to/other-project --name my-app
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const folioRoot = path.resolve(__dirname, '..')
const templates = path.join(folioRoot, 'templates', 'external-project')

function parseArgs(argv) {
  const args = [...argv]
  let project = null
  let folio = folioRoot
  let name = null
  let force = false
  while (args.length) {
    const a = args.shift()
    if (a === '--folio') folio = path.resolve(args.shift() || '')
    else if (a === '--name') name = args.shift()
    else if (a === '--force') force = true
    else if (a === '--help' || a === '-h') return { help: true }
    else if (!a.startsWith('-')) project = path.resolve(a)
  }
  return { project, folio, name, force, help: false }
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function writeIfNeeded(file, content, force) {
  if (!force && (await exists(file))) {
    console.log(`  skip (exists): ${file}`)
    return false
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content, 'utf8')
  console.log(`  wrote: ${file}`)
  return true
}

function usage() {
  console.log(`Folio MCP linker

Usage:
  npm run mcp:link -- <other-project-path> [--folio <folio-path>] [--name <slug>] [--force]

Example:
  npm run mcp:link -- ~/Documents/source/my-app --name my-app
`)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help || !opts.project) {
    usage()
    process.exit(opts.help ? 0 : 1)
  }

  const folio = path.resolve(opts.folio)
  const project = path.resolve(opts.project)
  const slug =
    opts.name ||
    path.basename(project).replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase() ||
    'project'

  if (!(await exists(path.join(folio, 'src', 'mcp', 'stdio.ts')))) {
    throw new Error(`Folio MCP 엔트리를 찾을 수 없습니다: ${folio}/src/mcp/stdio.ts`)
  }
  if (!(await exists(project))) {
    throw new Error(`대상 프로젝트가 없습니다: ${project}`)
  }

  console.log(`Folio:   ${folio}`)
  console.log(`Project: ${project}`)
  console.log(`Slug:    ${slug}`)
  console.log('')

  // Cursor mcp.json
  let cursorMcp = await readFile(path.join(templates, '.cursor', 'mcp.json'), 'utf8')
  cursorMcp = cursorMcp.replaceAll('__FOLIO_ROOT__', folio)
  await writeIfNeeded(path.join(project, '.cursor', 'mcp.json'), cursorMcp, opts.force)

  // VS Code / Cursor vscode mcp.json
  let vscodeMcp = await readFile(path.join(templates, '.vscode', 'mcp.json'), 'utf8')
  vscodeMcp = vscodeMcp.replaceAll('__FOLIO_ROOT__', folio)
  await writeIfNeeded(path.join(project, '.vscode', 'mcp.json'), vscodeMcp, opts.force)

  // Rule
  let rule = await readFile(
    path.join(templates, '.cursor', 'rules', 'folio-worklog.mdc'),
    'utf8',
  )
  rule = rule
    .replaceAll('my-app', slug)
    .replaceAll('프로젝트명', slug)
  await writeIfNeeded(
    path.join(project, '.cursor', 'rules', 'folio-worklog.mdc'),
    rule,
    opts.force,
  )

  // 짧은 README 안내
  const tip = `# Folio MCP 연결됨

이 프로젝트는 Folio MCP에 연결되어 있습니다.

- Folio 경로: \`${folio}\`
- 프로젝트 슬러그(태그): \`${slug}\`
- Cursor에서 MCP \`folio\` 서버가 켜져 있는지 확인하세요.
- 에이전트가 작업 후 \`journal_write\` 등으로 자동 기록합니다.
- Folio UI에서 보려면 Folio 앱 헤더의 **「MCP 가져오기」** 를 누르세요.

매뉴얼: \`${folio}/docs/MCP-GUIDE.md\`
`
  await writeIfNeeded(path.join(project, 'FOLIO-MCP.md'), tip, opts.force)

  console.log(`
완료.

다음:
1) 대상 프로젝트를 Cursor로 다시 연다
2) Settings → MCP 에서 folio 연결 확인
3) 작업 후 에이전트가 일지에 남기는지 확인
4) Folio 앱(npm run dev) → 헤더 「MCP 가져오기」로 UI 반영
`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
