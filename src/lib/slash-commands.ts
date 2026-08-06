/**
 * P64 — 에디터 슬래시 명령어 (/)
 */
'use client'

export type SlashCommand = {
  id: string
  label: string
  hint: string
  /** 슬래시+쿼리 구간을 대체할 텍스트 (커서는 끝) */
  insert: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: '머리말 1',
    hint: '큰 제목',
    insert: '# ',
  },
  {
    id: 'h2',
    label: '머리말 2',
    hint: '중간 제목',
    insert: '## ',
  },
  {
    id: 'h3',
    label: '머리말 3',
    hint: '작은 제목',
    insert: '### ',
  },
  {
    id: 'tag',
    label: '태그 추가',
    hint: '#태그',
    insert: '#',
  },
  {
    id: 'bullet',
    label: '글머리 기호',
    hint: '목록',
    insert: '- ',
  },
  {
    id: 'todo',
    label: '할 일',
    hint: '체크박스',
    insert: '- [ ] ',
  },
  {
    id: 'quote',
    label: '인용',
    hint: '인용문',
    insert: '> ',
  },
  {
    id: 'code',
    label: '코드 블록',
    hint: '```',
    insert: '```\n\n```',
  },
  {
    id: 'divider',
    label: '구분선',
    hint: '---',
    insert: '\n---\n',
  },
  {
    id: 'template-daily',
    label: '템플릿 적용 · 데일리',
    hint: '일지 골격',
    insert: '## Today\n\n- \n\n## Notes\n\n',
  },
  {
    id: 'template-retro',
    label: '템플릿 적용 · 회고',
    hint: 'Keep / Problem / Try',
    insert: '## Keep\n\n- \n\n## Problem\n\n- \n\n## Try\n\n- \n',
  },
  {
    id: 'ai-summary',
    label: 'AI · 요약 자리표시',
    hint: '선택 후 AI 패널에서 요약',
    insert: '<!-- ai:summarize -->\n',
  },
  {
    id: 'ai-expand',
    label: 'AI · 확장 자리표시',
    hint: '선택 후 AI 패널에서 확장',
    insert: '<!-- ai:expand -->\n',
  },
  {
    id: 'ai-rewrite',
    label: 'AI · 재작성 자리표시',
    hint: '선택 후 AI 패널에서 재작성',
    insert: '<!-- ai:rewrite -->\n',
  },
]

/** `/query` 감지 — 줄 시작 또는 공백 뒤의 `/` */
export function detectSlashQuery(
  value: string,
  cursor: number,
): { start: number; query: string } | null {
  const before = value.slice(0, cursor)
  const m = before.match(/(^|[\n\s])\/([^\n]*)$/)
  if (!m) return null
  const slashAt = before.length - (m[2]?.length ?? 0) - 1
  if (value[slashAt] !== '/') return null
  return { start: slashAt, query: m[2] ?? '' }
}

export function filterSlashCommands(query: string, limit = 8): SlashCommand[] {
  const q = query.trim().toLowerCase()
  const list = !q
    ? SLASH_COMMANDS
    : SLASH_COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.id.includes(q) ||
          c.hint.toLowerCase().includes(q),
      )
  return list.slice(0, limit)
}

export function applySlashCommand(
  value: string,
  cursor: number,
  start: number,
  cmd: SlashCommand,
): { next: string; caret: number } {
  const before = value.slice(0, start)
  const after = value.slice(cursor)
  const next = before + cmd.insert + after
  let caret = before.length + cmd.insert.length
  // 코드 블록: 가운데로
  if (cmd.id === 'code') {
    caret = before.length + 4 // after ```\n
  }
  return { next, caret }
}
