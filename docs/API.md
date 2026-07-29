# Folio API 레퍼런스 (`src/lib`)

클라이언트·서버에서 쓰는 주요 모듈 시그니처 요약. 상세는 각 파일 JSDoc을 본다.

## storage — 저장 모드

```ts
type StorageMode = 'local' | 'cloud' | 'beacon'
type StorageDataType = 'journal' | 'docs' | 'board'

getStorageMode(): StorageMode
setStorageMode(mode: StorageMode): void
subscribeStorageMode(listener: (mode: StorageMode) => void): () => void

saveWithFallback(
  data: unknown,
  type: StorageDataType,
  options: {
    localSave: (data: unknown) => void | Promise<void>
    cloudSave?: (data: unknown) => Promise<void>
    resolveRemoteData?: () => unknown
  },
): Promise<{ mode: StorageMode; usedFallback: boolean }>

loadWithFallback<T>(options: {
  type: StorageDataType
  localLoad: () => T
  cloudLoad?: () => Promise<T>
  emptyBeacon?: T
}): Promise<T>

isBeaconAvailable(): Promise<boolean>
loadBeaconCache<T>(type: StorageDataType): Promise<T | null>
saveBeaconCache(type: StorageDataType, data: unknown): Promise<void>
```

**동작:** 저장 시 항상 `localSave` 선행. cloud/beacon 원격은 5초 타임아웃.

## local-cache / debounce

```ts
setLocalJson(key: string, value: unknown, delayMs?: number): void  // default 300ms
getLocalJson<T>(key: string, fallback: T): T
flushLocalJson(key?: string): void

debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number): T & { flush(): void; cancel(): void }
```

## journal

```ts
interface JournalEntry { date: string; content: string; tags: string[]; updatedAt: string; /* … */ }

loadJournals(): Record<string, JournalEntry>
saveJournal(date: string, content: string, tags: string[]): void
getAllTags(entries?): string[]
saveJournalWithFallback(date, content, tags): Promise<void>
loadJournalsWithFallback(): Promise<Record<string, JournalEntry>>
```

## docs

```ts
interface DocEntry { id: string; title: string; content: string; category: string; createdAt: string; updatedAt: string }

loadDocs(): DocEntry[]
saveDoc(doc: DocEntry): void
deleteDoc(id: string): void
loadCategories(docs?): string[]
saveDocWithFallback(doc: DocEntry): Promise<void>
deleteDocWithFallback(id: string): Promise<void>
loadDocsWithFallback(): Promise<DocEntry[]>
```

## board

```ts
interface Task {
  id: string; title: string; description: string
  status: 'backlog' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high'
  tags: string[]
  /* jira*, github* 확장 필드 */
}

loadTasks(): Task[]
saveTasks(tasks: Task[]): void
saveTaskWithFallback(task: Task): Promise<SaveWithFallbackResult>
saveTasksWithFallback(tasks: Task[]): Promise<SaveWithFallbackResult>
deleteTaskWithFallback(id: string): Promise<SaveWithFallbackResult>
loadTasksWithFallback(): Promise<Task[]>
```

## supabase

```ts
createBrowserSupabaseClient()
createServerSupabaseClient(): Promise<SupabaseClient>
getUser(): Promise<User | null>
requireAuthUser(): Promise<{ supabase; userId: string }>
isAuthenticated(): Promise<boolean>
signIn(email, password) / signUp(email, password) / signOut()
```

## team

```ts
getActiveTeamId() / setActiveTeamId(teamId)
createTeam(name: string): Promise<Team>
inviteMember(teamId, email, role?): Promise<Invitation>
acceptInvite(token: string): Promise<string>
listTeams() / listMembers(teamId) / listInvitations(teamId)
removeMember(teamId, userId)
shareDoc(teamId, docId, permission) / shareBoard(teamId, boardId, permission)
listSharedDocs(teamId) / listSharedBoards(teamId)
```

## search / analytics

```ts
searchAll(query: string): Promise<SearchAllResult>
getJournalAnalytics(range: AnalyticsRange): Promise<JournalAnalytics>
getBoardAnalytics(range: AnalyticsRange): Promise<BoardAnalytics>
recordBoardStatusChange(taskId, status, at?)
```

## beacon

```ts
fetchBeaconSummary(): Promise<BeaconViewModel>
loadBeaconFromDirectoryPicker(): Promise<BeaconViewModel>
buildBeaconViewModel(input): BeaconViewModel
defaultBeaconRoot(): string
```

## a11y (React hooks)

```ts
useEscapeToClose(open: boolean, onClose: () => void): void
useFocusTrap(open: boolean, containerRef: RefObject<HTMLElement | null>): void
```

## 연동 · 기타

| 모듈 | 주요 export |
|------|-------------|
| `notify-client` | `fetchIntegrationsStatus`, `notifyChannels` |
| `obsidian` | `readObsidianMarkdownFiles`, `parseFrontmatter` |
| `jira` | `fetchIssues`, `createIssue`, `transitionIssue` |
| `github` | `fetchGitHubIssues`, `createGithubIssue` |
| `slack` / `discord` | `send*Notification` |
| `favorites` | `loadFavorites`, `toggleFavorite` |
| `theme` | `getStoredTheme`, `toggleTheme` |
| `migrate` | `migrateLocalDataOnLogin` |
| `query-cache` | `cachedQuery`, `invalidateQueryCache` |
| `utils` | `cn(...inputs)` |

HTTP API 라우트는 `src/app/api/*` — health · runtime · Beacon · Jira · GitHub · notify · integrations/status.

| Method | Path | 요약 |
|--------|------|------|
| GET | `/api/health` | `{ status: "ok", version, uptime, timestamp }` |
| GET | `/api/runtime` | Node/Next 버전 · env 설정 여부 · uptime (시크릿 비노출) |
