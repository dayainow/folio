/**
 * Folio MCP 서버 팩토리 — tools / resources / prompts
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  loadDocs,
  loadJournals,
  loadTasks,
  newId,
  saveDocs,
  saveJournals,
  saveTasks,
  todayDate,
  type DocRecord,
  type TaskRecord,
} from '@/mcp/store'

function text(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  }
}

export function createFolioMcpServer(): McpServer {
  const server = new McpServer({
    name: 'folio',
    version: process.env.npm_package_version ?? '2.5.0-wip',
  })

  // --- tools (journal.read → journal_read) ---
  server.registerTool(
    'journal_read',
    {
      title: 'journal.read',
      description: '일지 읽기 (날짜 YYYY-MM-DD, 생략 시 오늘)',
      inputSchema: {
        date: z.string().optional().describe('YYYY-MM-DD'),
      },
    },
    async ({ date }) => {
      const d = date?.trim() || todayDate()
      const all = await loadJournals()
      const entry = all[d] ?? { date: d, content: '', tags: [], updatedAt: new Date().toISOString() }
      return text({ tool: 'journal.read', entry })
    },
  )

  server.registerTool(
    'journal_write',
    {
      title: 'journal.write',
      description: '일지 쓰기/덮어쓰기 (append=true 이면 본문 뒤에 추가)',
      inputSchema: {
        date: z.string().optional().describe('YYYY-MM-DD'),
        content: z.string().describe('일지 본문'),
        tags: z.array(z.string()).optional(),
        append: z.boolean().optional(),
      },
    },
    async ({ date, content, tags, append }) => {
      const d = date?.trim() || todayDate()
      const all = await loadJournals()
      const prev = all[d]
      const nextContent =
        append && prev?.content ? `${prev.content.replace(/\s*$/, '')}\n\n${content}` : content
      all[d] = {
        date: d,
        content: nextContent,
        tags: tags ?? prev?.tags ?? [],
        updatedAt: new Date().toISOString(),
        id: prev?.id,
      }
      const path = await saveJournals(all)
      return text({ tool: 'journal.write', ok: true, date: d, path, entry: all[d] })
    },
  )

  server.registerTool(
    'doc_read',
    {
      title: 'doc.read',
      description: '문서 읽기 (id 또는 title)',
      inputSchema: {
        id: z.string().optional(),
        title: z.string().optional(),
      },
    },
    async ({ id, title }) => {
      const docs = await loadDocs()
      const doc = id
        ? docs.find((d) => d.id === id)
        : title
          ? docs.find((d) => d.title.toLowerCase() === title.toLowerCase())
          : undefined
      if (!doc) return text({ tool: 'doc.read', error: 'not_found', id, title })
      return text({ tool: 'doc.read', doc })
    },
  )

  server.registerTool(
    'doc_write',
    {
      title: 'doc.write',
      description: '문서 생성/업데이트 (id 있으면 수정, 없으면 생성)',
      inputSchema: {
        id: z.string().optional(),
        title: z.string(),
        content: z.string(),
        category: z.string().optional(),
      },
    },
    async ({ id, title, content, category }) => {
      const docs = await loadDocs()
      const now = new Date().toISOString()
      let doc: DocRecord
      const idx = id ? docs.findIndex((d) => d.id === id) : -1
      if (idx >= 0) {
        doc = {
          ...docs[idx]!,
          title,
          content,
          category: category ?? docs[idx]!.category,
          updatedAt: now,
        }
        docs[idx] = doc
      } else {
        doc = {
          id: id || newId(),
          title,
          content,
          category: category ?? 'Dev Guide',
          createdAt: now,
          updatedAt: now,
        }
        docs.unshift(doc)
      }
      const path = await saveDocs(docs)
      return text({ tool: 'doc.write', ok: true, path, doc })
    },
  )

  server.registerTool(
    'board_list',
    {
      title: 'board.list',
      description: '보드 태스크 목록 (status 필터 선택)',
      inputSchema: {
        status: z.enum(['backlog', 'in_progress', 'review', 'done']).optional(),
      },
    },
    async ({ status }) => {
      const tasks = await loadTasks()
      const filtered = status ? tasks.filter((t) => t.status === status) : tasks
      return text({ tool: 'board.list', count: filtered.length, tasks: filtered })
    },
  )

  server.registerTool(
    'board_update',
    {
      title: 'board.update',
      description: '보드 태스크 생성/업데이트',
      inputSchema: {
        id: z.string().optional(),
        title: z.string(),
        description: z.string().optional(),
        status: z.enum(['backlog', 'in_progress', 'review', 'done']).optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async ({ id, title, description, status, priority, tags }) => {
      const tasks = await loadTasks()
      const now = new Date().toISOString()
      let task: TaskRecord
      const idx = id ? tasks.findIndex((t) => t.id === id) : -1
      if (idx >= 0) {
        const prev = tasks[idx]!
        task = {
          ...prev,
          title,
          description: description ?? prev.description,
          status: status ?? prev.status,
          priority: priority ?? prev.priority,
          tags: tags ?? prev.tags,
          updatedAt: now,
        }
        tasks[idx] = task
      } else {
        task = {
          id: id || newId(),
          title,
          description: description ?? '',
          status: status ?? 'backlog',
          priority: priority ?? 'medium',
          tags: tags ?? [],
          createdAt: now,
          updatedAt: now,
        }
        tasks.unshift(task)
      }
      const path = await saveTasks(tasks)
      return text({ tool: 'board.update', ok: true, path, task })
    },
  )

  // --- resources ---
  server.registerResource(
    'journals',
    'folio://journals',
    {
      title: 'Journals',
      description: '전체 일지 JSON',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(await loadJournals(), null, 2),
        },
      ],
    }),
  )

  server.registerResource(
    'docs',
    'folio://docs',
    {
      title: 'Docs',
      description: '전체 문서 JSON',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(await loadDocs(), null, 2),
        },
      ],
    }),
  )

  server.registerResource(
    'boards',
    'folio://boards',
    {
      title: 'Boards',
      description: '전체 보드 태스크 JSON',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(await loadTasks(), null, 2),
        },
      ],
    }),
  )

  // --- prompts ---
  server.registerPrompt(
    'daily_summary',
    {
      title: '오늘의 업무 요약',
      description: '오늘 일지·진행 중 태스크를 바탕으로 요약을 요청',
      argsSchema: {
        date: z.string().optional().describe('YYYY-MM-DD (기본: 오늘)'),
      },
    },
    async ({ date }) => {
      const d = date?.trim() || todayDate()
      const [journals, tasks] = await Promise.all([loadJournals(), loadTasks()])
      const entry = journals[d]
      const active = tasks.filter((t) => t.status === 'in_progress' || t.status === 'review')
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `다음 Folio 데이터를 바탕으로 ${d} 업무 요약을 작성해 주세요.`,
                '',
                '## 일지',
                entry?.content?.trim() || '(없음)',
                '',
                `Tags: ${(entry?.tags ?? []).join(', ') || '(없음)'}`,
                '',
                '## 진행 중 태스크',
                active.length
                  ? active.map((t) => `- [${t.status}] ${t.title}`).join('\n')
                  : '(없음)',
              ].join('\n'),
            },
          },
        ],
      }
    },
  )

  server.registerPrompt(
    'project_status',
    {
      title: '프로젝트 진행 상황',
      description: '보드 컬럼·문서 목록 기반 진행 상황 브리핑',
    },
    async () => {
      const [tasks, docs] = await Promise.all([loadTasks(), loadDocs()])
      const byStatus = {
        backlog: tasks.filter((t) => t.status === 'backlog').length,
        in_progress: tasks.filter((t) => t.status === 'in_progress').length,
        review: tasks.filter((t) => t.status === 'review').length,
        done: tasks.filter((t) => t.status === 'done').length,
      }
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                '다음 Folio 보드/문서 현황으로 프로젝트 진행 상황을 브리핑해 주세요.',
                '',
                '## 보드 집계',
                JSON.stringify(byStatus, null, 2),
                '',
                '## 최근 태스크 (최대 15)',
                tasks
                  .slice(0, 15)
                  .map((t) => `- [${t.status}/${t.priority}] ${t.title}`)
                  .join('\n') || '(없음)',
                '',
                '## 문서 목록',
                docs.map((d) => `- ${d.title} (${d.category})`).join('\n') || '(없음)',
              ].join('\n'),
            },
          },
        ],
      }
    },
  )

  return server
}
