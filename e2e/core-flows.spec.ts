import { expect, test } from '@playwright/test'
import JSZip from 'jszip'

/**
 * P66 — 핵심 플로우 E2E (로컬 모드 · 인증 없이)
 */
test.describe('Folio core flows (P66)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('welcome_seen', '1')
      localStorage.setItem('folio_locale', 'ko')
      localStorage.setItem('workspace_tasks', '[]')
      localStorage.removeItem('folio_weekly_plans_v1')
      localStorage.removeItem('folio_daily_plans_v1')
      localStorage.removeItem('folio_daily_reviews_v1')
      localStorage.removeItem('folio_time_tracking_v1')
    })
  })

  test('login/auth affordance is reachable from home', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toBeVisible()
    await page.getByRole('button', { name: /요약|summary/i }).click()
    await page.getByRole('button', { name: /추가 위젯 더보기/ }).click()
    // Supabase 미설정 시에도 로그인 또는 테마 설정 진입점이 존재
    const security = page.getByRole('button', { name: /보안|Security|セキュリティ/i })
    const theme = page.getByRole('button', { name: /테마|Theme|テーマ|다크|라이트/i })
    const login = page.getByRole('link', { name: /로그인|Login/i })
    const anyControl = security.or(theme).or(login)
    await expect(anyControl.first()).toBeVisible({ timeout: 8000 })
  })

  test('journal write tab accepts input and can save locally', async ({ page }) => {
    await page.goto('/')
    const journalTab = page.getByRole('tab', { name: /일지|Journal|ジャーナル/i }).or(
      page.getByRole('button', { name: /일지|Journal/i }),
    )
    if ((await journalTab.count()) > 0) {
      await journalTab.first().click()
    }
    const editor = page
      .locator('textarea, [contenteditable="true"], [role="textbox"]')
      .first()
    await expect(editor).toBeVisible({ timeout: 10000 })
    await editor.click()
    await editor.fill(`P66 e2e note ${Date.now()}`)
    const save = page.getByRole('button', { name: /저장|Save|保存/i })
    if ((await save.count()) > 0) {
      await save.first().click()
    }
    await expect(editor).toBeVisible()
  })

  test('docs tab opens editor surface', async ({ page }) => {
    await page.goto('/')
    const docs = page.getByRole('tab', { name: /문서|Docs|ドキュメント/i }).or(
      page.getByRole('button', { name: /문서|Docs/i }),
    )
    await docs.first().click()
    const surface = page
      .locator('textarea, [contenteditable="true"], [role="textbox"]')
      .or(page.getByText(/문서|Document|새 문서|New/i))
    await expect(surface.first()).toBeVisible({ timeout: 10000 })
  })

  test('intake keeps the primary action clear on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const docs = page.getByRole('tab', { name: /문서|Docs|ドキュメント/i }).or(
      page.getByRole('button', { name: /문서|Docs/i }),
    )
    await docs.first().click()
    await page.getByRole('tab', { name: '수집함', exact: true }).click()
    await expect(page.getByRole('heading', { name: '필요한 자료만, 안전하게' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Notion에서 가져오기' })).toBeVisible()
    await expect(page.getByText('텍스트 직접 붙여넣기', { exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Markdown 텍스트를 붙여넣으세요')).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })

  test('Notion intake shows the latest import connection status', async ({ page }) => {
    await page.addInitScript(() => {
      const fingerprint = (value: string) => {
        let hash = 0x811c9dc5
        for (let index = 0; index < value.length; index += 1) {
          hash ^= value.charCodeAt(index)
          hash = Math.imul(hash, 0x01000193)
        }
        return (`00000000${(hash >>> 0).toString(16)}`).slice(-8)
      }
      const records = [
        { title: 'Roadmap', path: 'Notion/Workspace/Roadmap.md', content: '# Roadmap\n\nOld plan' },
        { title: 'Stable', path: 'Notion/Workspace/Stable.md', content: '# Stable\n\nNo changes' },
      ].map((record, index) => ({
        fingerprint: fingerprint([record.title, 'manual', 'doc', '', record.content].join('\n')),
        fileName: record.path.split('/').pop(),
        relativePath: record.path,
        title: record.title,
        route: 'docs',
        targetId: `notion-doc-${index}`,
        importedAt: '2026-08-18T09:00:00.000Z',
        provenance: {
          system: 'notion',
          fingerprint: fingerprint([record.title, 'manual', 'doc', '', record.content].join('\n')),
          path: record.path,
          importedAt: '2026-08-18T09:00:00.000Z',
          syncState: 'imported',
        },
      }))
      localStorage.setItem('folio_intake_history_v1', JSON.stringify(records))
      localStorage.setItem('workspace_docs', JSON.stringify([{
        id: 'notion-doc-0',
        title: 'Roadmap',
        content: '# Roadmap\n\nOld plan',
        category: 'Obsidian Import',
        source: 'manual',
        noteType: 'doc',
        tags: [],
        sourcePath: 'Notion/Workspace/Roadmap.md',
        provenance: records[0]?.provenance,
        createdAt: '2026-08-18T09:00:00.000Z',
        updatedAt: '2026-08-18T09:00:00.000Z',
      }]))
      localStorage.setItem('folio_import_connections_v1', JSON.stringify({
        notion: {
          system: 'notion',
          state: 'ready',
          sourceName: 'workspace.zip',
          attemptedAt: '2026-08-18T09:00:00.000Z',
        },
      }))
    })
    await page.goto('/')
    const docs = page.getByRole('tab', { name: /문서|Docs|ドキュメント/i }).or(
      page.getByRole('button', { name: /문서|Docs/i }),
    )
    await docs.first().click()
    await page.getByRole('tab', { name: '수집함', exact: true }).click()
    const connection = page.getByRole('region', { name: 'Notion 가져오기 상태' })
    await expect(connection).toBeVisible()
    await expect(page.getByRole('list', { name: '가져오기 진행 단계' }).getByRole('listitem').filter({ hasText: '자료 선택' })).toHaveAttribute('aria-current', 'step')
    await expect(connection.getByText('가져옴 · 2개', { exact: true })).toBeVisible()
    await expect(connection.getByText(/workspace\.zip/)).toBeVisible()
    await expect(connection.getByRole('button', { name: '다시 가져오기' })).toBeVisible()

    const zip = new JSZip()
    zip.file('Workspace/Roadmap.md', '# Roadmap\n\nUpdated plan')
    zip.file('Workspace/Stable.md', '# Stable\n\nNo changes')
    zip.file('Workspace/New idea.md', '# New idea\n\nFirst draft')
    await page.locator('input[type="file"][accept*=".zip"]').setInputFiles({
      name: 'workspace-next.zip',
      mimeType: 'application/zip',
      buffer: await zip.generateAsync({ type: 'nodebuffer' }),
    })
    await expect(page.getByText('Notion 변경분을 확인했습니다. 신규 1 · 변경 1 · 동일 1.', { exact: false })).toBeVisible()
    await expect(page.getByRole('list', { name: '가져오기 진행 단계' }).getByRole('listitem').filter({ hasText: '변경 확인' })).toHaveAttribute('aria-current', 'step')
    await expect(page.getByText('변경됨', { exact: true })).toBeVisible()
    const skipped = page.getByText('동일해서 건너뜀 1개', { exact: true })
    await expect(skipped).toBeVisible()
    await skipped.click()
    await expect(page.getByText('변경 없음', { exact: true })).toBeVisible()
    const updateMode = page.getByRole('group', { name: 'Roadmap 변경 반영 방식' })
    await expect(updateMode.getByRole('button', { name: '새 버전 반영' })).toBeVisible()
    await expect(updateMode.getByRole('button', { name: '별도 문서 추가' })).toBeVisible()
    await page.getByRole('button', { name: '변경 비교' }).click()
    const comparison = page.getByRole('dialog', { name: '문서 버전 비교' })
    await expect(comparison).toBeVisible()
    await expect(comparison.getByText('현재 Folio → Notion 변경본')).toBeVisible()
    await expect(comparison.locator('pre')).toContainText('Old plan')
    await expect(comparison.locator('pre')).toContainText('Updated plan')
    await page.keyboard.press('Escape')
    await expect(comparison).toBeHidden()
    await page.getByRole('checkbox', { name: 'Roadmap 가져오기' }).check()
    await page.getByRole('button', { name: '1개 가져오기' }).click()
    await expect(page.getByText('1개를 반영했습니다. 기존 문서 새 버전 1개.')).toBeVisible()
    const summary = page.getByRole('region', { name: '가져오기 실행 요약' })
    await expect(summary).toBeVisible()
    await expect(summary.getByText('신규 문서').locator('..')).toContainText('0')
    await expect(summary.getByText('새 버전', { exact: true }).first().locator('..')).toContainText('1')
    await expect(summary.getByText('건너뜀').locator('..')).toContainText('1')
    await expect(summary.getByText('실패', { exact: true }).first().locator('..')).toContainText('0')
    const importedItem = summary.getByRole('button', { name: /Roadmap.*새 버전/ })
    await expect(importedItem).toBeEnabled()
    await expect.poll(async () => page.evaluate(() => {
      const docs = JSON.parse(localStorage.getItem('workspace_docs') || '[]') as Array<{ id: string; content: string }>
      const versions = JSON.parse(localStorage.getItem('folio_doc_versions_v1') || '{}') as Record<string, Array<{ note?: string }>>
      return {
        docCount: docs.length,
        content: docs.find((doc) => doc.id === 'notion-doc-0')?.content,
        notes: versions['notion-doc-0']?.map((version) => version.note).sort(),
      }
    })).toEqual({
      docCount: 1,
      content: '# Roadmap\n\nUpdated plan',
      notes: ['Notion 반영 전', 'Notion 변경 반영'],
    })
    await summary.getByRole('button', { name: '실행 요약 닫기' }).click()
    await expect(summary).toBeHidden()
    await page.reload()
    await docs.first().click()
    await page.getByRole('tab', { name: '수집함', exact: true }).click()
    const recentRuns = page.getByRole('region', { name: '최근 가져오기 실행' })
    await expect(recentRuns).toBeVisible()
    await recentRuns.locator('summary').click()
    await recentRuns.getByRole('button', { name: /workspace-next\.zip.*반영 1.*건너뜀 1.*실패 0/ }).click()
    const restoredSummary = page.getByRole('region', { name: '가져오기 실행 요약' })
    await expect(restoredSummary).toBeVisible()
    await restoredSummary.getByRole('button', { name: /Roadmap.*새 버전/ }).click()
    await expect(page).toHaveURL(/#docs\/write$/)
  })

  test('a persisted failed Notion item can be prepared alone for a safe retry', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      const candidate = {
        fileName: 'Broken.md',
        relativePath: 'Notion/Workspace/Broken.md',
        title: 'Broken import',
        date: null,
        content: '# Broken import\n\nRetry content',
        tags: [],
        frontmatter: { source: 'manual', type: 'doc' },
        source: 'manual',
        noteType: 'doc',
        route: 'docs',
        resolvedDate: '2026-08-18',
        category: 'Obsidian Import',
        fingerprint: 'retry-fingerprint',
        warnings: ['created가 없어 오늘 날짜 사용', 'tags 없음'],
        duplicate: false,
        provenance: {
          system: 'notion',
          fingerprint: 'retry-fingerprint',
          path: 'Notion/Workspace/Broken.md',
          importedAt: '2026-08-18T11:00:00.000Z',
          syncState: 'imported',
        },
        reviewState: 'needs_review',
        changeState: 'new',
      }
      localStorage.setItem('folio_import_runs_v1', JSON.stringify([{
        completedAt: '2026-08-18T11:00:00.000Z',
        sourceName: 'failed-workspace.zip',
        newDocuments: 0,
        newVersions: 0,
        journals: 0,
        skipped: 0,
        failed: 1,
        outcomes: [{
          fingerprint: candidate.fingerprint,
          title: candidate.title,
          kind: 'failed',
          route: 'docs',
          error: 'storage unavailable',
          retryCandidate: candidate,
          retryMode: 'new',
        }],
      }]))
      localStorage.setItem('folio_intake_history_v1', '[]')
      localStorage.setItem('workspace_docs', '[]')
    })
    await page.goto('/')
    const docs = page.getByRole('tab', { name: /문서|Docs|ドキュメント/i }).or(
      page.getByRole('button', { name: /문서|Docs/i }),
    )
    await docs.first().click()
    await page.getByRole('tab', { name: '수집함', exact: true }).click()
    const recentRuns = page.getByRole('region', { name: '최근 가져오기 실행' })
    await recentRuns.locator('summary').click()
    await recentRuns.getByRole('button', { name: /failed-workspace\.zip.*실패 1/ }).click()
    const summary = page.getByRole('region', { name: '가져오기 실행 요약' })
    await expect(summary.getByText('storage unavailable')).toBeVisible()
    await summary.getByRole('button', { name: /Broken import.*실패.*다시 준비/ }).click()
    await expect(page.getByText(/“Broken import” 실패 항목만 다시 준비했습니다/)).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Broken import 가져오기' })).toBeChecked()
    const mobileAction = page.getByRole('region', { name: '선택한 항목 가져오기' })
    await expect(mobileAction).toBeVisible()
    await expect(mobileAction.getByText('1개 선택', { exact: true })).toBeVisible()
    await expect(mobileAction.getByRole('button', { name: '가져오기', exact: true })).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })

  test('board tab shows kanban columns for DnD', async ({ page }) => {
    await page.goto('/')
    const board = page.getByRole('tab', { name: /일정|보드|Board|ボード/i }).or(
      page.getByRole('button', { name: /일정|보드|Board/i }),
    )
    await board.first().click()
    const column = page.getByText(/Backlog|진행|Done|완료|To Do|대기/i)
    await expect(column.first()).toBeVisible({ timeout: 12000 })
  })

  test('header search opens an accessible search field', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /통합 검색 열기|Open search/i }).click()
    await expect(page.getByRole('textbox', { name: /검색|Search/i })).toBeVisible()
  })

  test('meeting actions require approval before appearing in backlog', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /요약|summary/i }).click()
    await page.getByRole('button', { name: /추가 위젯 더보기/ }).click()
    await page.getByRole('button', { name: /^AI$/ }).click()
    const dialog = page.getByRole('dialog', { name: /AI 도구/i })
    await dialog.getByRole('button', { name: '실행' }).click()
    await dialog.getByPlaceholder(/회의 기록/).fill('TODO: 배포 체크리스트를 8/20까지 정리하기')
    await dialog.getByRole('button', { name: /실행 항목 제안/ }).click()
    const title = dialog.getByRole('textbox', { name: /실행 항목 제목/ })
    await expect(title).toHaveValue(/배포 체크리스트/)
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('workspace_tasks') || '[]').length)).toBe(0)
    await dialog.getByRole('button', { name: /선택 항목 승인 후 추가/ }).click()
    await expect(dialog.getByText(/Backlog에 추가했습니다/)).toBeVisible()
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('workspace_tasks') || '[]').length)).toBe(1)
  })

  test('weekly review confirms next-week focus before persisting it', async ({ page }) => {
    await page.goto('/')
    await page.getByText('주간 리뷰', { exact: true }).click()
    await page.getByRole('textbox', { name: '1순위 목표' }).fill('고객 피드백 정리')
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('folio_weekly_plans_v1'))).toBeNull()
    await page.getByRole('button', { name: /주간 리뷰 완료/ }).click()
    await expect(page.getByText('이번 주를 정리하고 다음 주 초점을 확정했습니다.')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const plans = JSON.parse(localStorage.getItem('folio_weekly_plans_v1') || '{}') as Record<string, { focus?: string[] }>
      return Object.values(plans)[0]?.focus?.[0]
    })).toBe('고객 피드백 정리')
  })

  test('weekly focus creates one executable backlog task', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('folio_weekly_plans_v1', JSON.stringify({
        '2026-08-10': {
          weekStart: '2026-08-10',
          weekEnd: '2026-08-16',
          focus: ['고객 피드백 정리'],
          reflection: '',
          completedAt: '2026-08-14T08:00:00.000Z',
          updatedAt: '2026-08-14T08:00:00.000Z',
        },
      }))
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '이번 주 집중할 것' })).toBeVisible()
    await page.getByRole('button', { name: '고객 피드백 정리 실행 업무 만들기' }).click()
    await expect(page.getByText(/실행 업무로 만들었습니다/)).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const tasks = JSON.parse(localStorage.getItem('workspace_tasks') || '[]') as Array<{ title: string; tags: string[] }>
      return tasks.filter((task) => task.title === '고객 피드백 정리' && task.tags.includes('weekly-focus')).length
    })).toBe(1)
    await expect(page.getByRole('button', { name: '고객 피드백 정리 업무 열기' })).toBeVisible()
  })

  test('daily top three can be reordered and confirmed explicitly', async ({ page }) => {
    await page.addInitScript(() => {
      const base = { description: '', tags: [], createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z' }
      localStorage.setItem('workspace_tasks', JSON.stringify([
        { ...base, id: 'due', title: '오늘 마감 업무', status: 'backlog', priority: 'high', dueDate: '2026-08-14' },
        { ...base, id: 'focus', title: '주간 핵심 업무', status: 'backlog', priority: 'low', tags: ['weekly-focus'] },
        { ...base, id: 'active', title: '진행 중 업무', status: 'in_progress', priority: 'low' },
      ]))
    })
    await page.goto('/')
    const dailyPlan = page.getByRole('region', { name: '오늘의 Top 3' })
    await expect(dailyPlan).toBeVisible()
    await expect(dailyPlan.getByText('오늘 마감 업무', { exact: true })).toBeVisible()
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('folio_daily_plans_v1'))).toBeNull()
    await expect(dailyPlan.getByRole('button', { name: '진행 중 업무 집중 시작' })).toBeDisabled()
    await dailyPlan.getByRole('button', { name: '진행 중 업무 순서 올리기' }).click()
    await dailyPlan.getByRole('button', { name: 'Top 3 확정' }).click()
    await expect(dailyPlan.getByText('오늘의 Top 3를 확정했습니다.')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const plans = JSON.parse(localStorage.getItem('folio_daily_plans_v1') || '{}') as Record<string, { taskIds: string[] }>
      return Object.values(plans)[0]?.taskIds
    })).toEqual(['due', 'active', 'focus'])
    await dailyPlan.getByRole('button', { name: '진행 중 업무 집중 시작' }).click()
    await expect(dailyPlan.getByRole('button', { name: '진행 중 업무 집중 중지' })).toBeVisible()
    await page.waitForTimeout(600)
    await dailyPlan.getByRole('button', { name: '진행 중 업무 집중 중지' }).click()
    await expect.poll(async () => page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('folio_time_tracking_v1') || '{}') as { activeTaskId?: string | null; entries?: Array<{ taskId: string; durationMs: number }> }
      return { activeTaskId: store.activeTaskId, durationMs: store.entries?.find((entry) => entry.taskId === 'active')?.durationMs ?? 0 }
    })).toMatchObject({ activeTaskId: null, durationMs: expect.any(Number) })
    await expect.poll(async () => page.evaluate(() => {
      const store = JSON.parse(localStorage.getItem('folio_time_tracking_v1') || '{}') as { entries?: Array<{ taskId: string; durationMs: number }> }
      return store.entries?.find((entry) => entry.taskId === 'active')?.durationMs ?? 0
    })).toBeGreaterThanOrEqual(400)
    await dailyPlan.getByRole('button', { name: '오늘 마감 업무 완료 처리' }).click()
    await expect(dailyPlan.getByText('“오늘 마감 업무”을 완료했습니다.')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const tasks = JSON.parse(localStorage.getItem('workspace_tasks') || '[]') as Array<{ id: string; status: string }>
      return tasks.find((task) => task.id === 'due')?.status
    })).toBe('done')
    await expect(dailyPlan.getByRole('button', { name: '오늘 마감 업무 완료됨' })).toBeVisible()
  })

  test('unfinished top three tasks carry into the next day before new recommendations', async ({ page }) => {
    await page.addInitScript(() => {
      const dateKey = (value: Date) => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
      const today = new Date()
      const previous = new Date(today)
      previous.setDate(previous.getDate() - 1)
      const todayKey = dateKey(today)
      const previousKey = dateKey(previous)
      const base = { description: '', tags: [], priority: 'low', createdAt: previous.toISOString(), updatedAt: previous.toISOString() }
      localStorage.setItem('workspace_tasks', JSON.stringify([
        { ...base, id: 'carry', title: '어제 미완료 업무', status: 'in_progress' },
        { ...base, id: 'finished', title: '어제 완료 업무', status: 'done' },
        { ...base, id: 'new', title: '오늘 새 추천', status: 'backlog', priority: 'high', dueDate: todayKey },
      ]))
      localStorage.setItem('folio_daily_plans_v1', JSON.stringify({
        [previousKey]: {
          date: previousKey,
          taskIds: ['carry', 'finished'],
          confirmedAt: previous.toISOString(),
          updatedAt: previous.toISOString(),
        },
      }))
    })
    await page.goto('/')
    const dailyPlan = page.getByRole('region', { name: '오늘의 Top 3' })
    await expect(dailyPlan.getByText('어제에서 이월', { exact: true })).toBeVisible()
    await expect(dailyPlan.getByText(/어제 미완료 1개를 먼저 이어오고/)).toBeVisible()
    await expect(dailyPlan.getByText('어제 완료 업무', { exact: true })).toHaveCount(0)
    await dailyPlan.getByRole('button', { name: 'Top 3 확정' }).click()
    await expect.poll(async () => page.evaluate(() => {
      const plans = JSON.parse(localStorage.getItem('folio_daily_plans_v1') || '{}') as Record<string, { taskIds: string[] }>
      return Object.values(plans).find((plan) => plan.taskIds.includes('new'))?.taskIds
    })).toEqual(['carry', 'new'])
  })

  test('shutdown review stores the confirmed top three outcome', async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date()
      const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
      const base = { description: '', priority: 'medium', tags: [], createdAt: now.toISOString(), updatedAt: now.toISOString() }
      localStorage.setItem('workspace_tasks', JSON.stringify([
        { ...base, id: 'review-done', title: 'Top 3 완료 업무', status: 'done' },
        { ...base, id: 'review-open', title: 'Top 3 미완료 업무', status: 'in_progress' },
        { ...base, id: 'outside', title: '계획 밖 업무', status: 'done' },
      ]))
      localStorage.setItem('folio_daily_plans_v1', JSON.stringify({
        [date]: { date, taskIds: ['review-done', 'review-open'], confirmedAt: now.toISOString(), updatedAt: now.toISOString() },
      }))
    })
    await page.goto('/')
    await expect(page.getByText(/Top 3 1\/2 완료 · 미완료 1/)).toBeVisible()
    await page.getByRole('button', { name: '내일 첫 행동으로 제안 적용: Top 3 미완료 업무' }).click()
    await expect(page.getByRole('textbox', { name: '내일의 첫 행동' })).toHaveValue('Top 3 미완료 업무')
    await page.getByRole('textbox', { name: '오늘 가장 잘한 일' }).fill('Top 3 한 가지를 끝냈다')
    await page.getByRole('button', { name: '업무 닫기', exact: true }).click()
    await expect(page.getByText('오늘의 업무를 닫았습니다.')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const reviews = JSON.parse(localStorage.getItem('folio_daily_reviews_v1') || '{}') as Record<string, { tomorrow: string; execution?: { planned: number; completed: number; open: number } }>
      return Object.values(reviews)[0]
    })).toMatchObject({ tomorrow: 'Top 3 미완료 업무', execution: { planned: 2, completed: 1, open: 1 } })
  })

  test('morning briefing summarizes yesterday, deadlines and weekly focus', async ({ page }) => {
    await page.addInitScript(() => {
      const dateKey = (value: Date) => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
      const now = new Date()
      const today = dateKey(now)
      const previous = new Date(now)
      previous.setDate(previous.getDate() - 1)
      const previousKey = dateKey(previous)
      const monday = new Date(now)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
      const mondayKey = dateKey(monday)
      const base = { description: '', priority: 'medium', tags: [], status: 'backlog', createdAt: previous.toISOString(), updatedAt: previous.toISOString() }
      localStorage.setItem('workspace_tasks', JSON.stringify([
        { ...base, id: 'brief-action', title: '어제 첫 행동' },
        { ...base, id: 'brief-due', title: '오늘 마감 보고서', dueDate: today },
        { ...base, id: 'brief-late', title: '지연된 검토', dueDate: previousKey },
      ]))
      localStorage.setItem('folio_daily_plans_v1', JSON.stringify({
        [previousKey]: { date: previousKey, taskIds: ['brief-action'], confirmedAt: previous.toISOString(), updatedAt: previous.toISOString() },
      }))
      localStorage.setItem('folio_daily_reviews_v1', JSON.stringify({
        [previousKey]: { date: previousKey, win: '', learned: '', tomorrow: '어제 첫 행동', completedAt: previous.toISOString(), updatedAt: previous.toISOString() },
      }))
      localStorage.setItem('folio_weekly_plans_v1', JSON.stringify({
        [mondayKey]: { weekStart: mondayKey, weekEnd: today, focus: ['출시 준비'], reflection: '', completedAt: previous.toISOString(), updatedAt: previous.toISOString() },
      }))
    })
    await page.goto('/')
    const briefing = page.getByRole('region', { name: '오늘 시작 전, 이것만 확인하세요' })
    await expect(briefing).toBeVisible()
    await expect(briefing.getByText('이월 1', { exact: true })).toBeVisible()
    await expect(briefing.getByText('마감 1 · 지연 1', { exact: true })).toBeVisible()
    await expect(briefing.getByText(/출시 준비/)).toBeVisible()
    await expect(briefing.getByRole('button', { name: '어제 첫 행동' })).toHaveCount(2)
  })
})
