'use client'

/**
 * P62-1 — 문서 탭 셸 (작성 | 보기 | 수집함)
 */
import { useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocsEditor } from '@/components/docs-editor'
import { DocsBrowsePanel } from '@/components/docs-browse'
import { IntakeCenter } from '@/components/intake-center'
import { saveDocWithFallback, type DocEntry } from '@/lib/docs'

export type DocsSubTab = 'write' | 'view' | 'intake'

function readHashTab(): DocsSubTab {
  if (typeof window === 'undefined') return 'write'
  const hash = window.location.hash.replace(/^#/, '')
  if (hash === 'docs/view' || hash === 'view') return 'view'
  if (hash === 'docs/intake' || hash === 'intake') return 'intake'
  return 'write'
}

function writeHash(tab: DocsSubTab) {
  if (typeof window === 'undefined') return
  const next = `#docs/${tab}`
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  }
}

export function DocsPanel({
  focusDocId,
  onFocusHandled,
  onOpenJournal,
  writingFirst = false,
}: {
  focusDocId?: string | null
  onFocusHandled?: () => void
  onOpenJournal?: (entryKey: string, date: string) => void
  writingFirst?: boolean
} = {}) {
  const [subTab, setSubTab] = useState<DocsSubTab>(readHashTab)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const dirtyRef = useRef(false)
  const subTabRef = useRef(subTab)

  useEffect(() => {
    subTabRef.current = subTab
  }, [subTab])

  const trySwitch = (next: DocsSubTab, opts?: { skipConfirm?: boolean }) => {
    if (next === subTabRef.current) {
      writeHash(next)
      return
    }
    if (!opts?.skipConfirm && subTabRef.current === 'write' && dirtyRef.current) {
      const ok = window.confirm(
        '작성 중인 변경사항이 있습니다. 저장하지 않고 다른 화면으로 이동할까요?',
      )
      if (!ok) {
        writeHash('write')
        return
      }
    }
    setSubTab(next)
    writeHash(next)
  }

  useEffect(() => {
    if (!focusDocId) return
    const id = window.setTimeout(() => {
      setFocusId(focusDocId)
      setSubTab('write')
      writeHash('write')
    }, 0)
    return () => window.clearTimeout(id)
  }, [focusDocId])

  useEffect(() => {
    const onHash = () => {
      const next = readHashTab()
      if (next === subTabRef.current) return
      if (subTabRef.current === 'write' && dirtyRef.current) {
        const ok = window.confirm(
          '작성 중인 변경사항이 있습니다. 저장하지 않고 다른 화면으로 이동할까요?',
        )
        if (!ok) {
          writeHash('write')
          return
        }
      }
      setSubTab(next)
      writeHash(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const openWrite = (docId: string) => {
    setFocusId(docId)
    setEditorKey((k) => k + 1)
    setSubTab('write')
    writeHash('write')
  }

  const createNew = async () => {
    const newDoc: DocEntry = {
      id: crypto.randomUUID(),
      title: '새 문서',
      content: '',
      category: 'Dev Guide',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    try {
      await saveDocWithFallback(newDoc)
    } catch {
      /* editor hydrates */
    }
    openWrite(newDoc.id)
  }

  return (
    <Tabs
      value={`docs-${subTab}`}
      onValueChange={(v) => {
        trySwitch(v.replace(/^docs-/, '') as DocsSubTab)
      }}
      className="w-full"
    >
      <TabsList className="mb-3 h-auto gap-1 border-0 bg-transparent p-0">
        <TabsTrigger
          value="docs-write"
          className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
        >
          작성
        </TabsTrigger>
        <TabsTrigger
          value="docs-view"
          className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
        >
          보기
        </TabsTrigger>
        <TabsTrigger
          value="docs-intake"
          className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-violet-100 data-[state=active]:text-violet-900 dark:data-[state=active]:bg-violet-950 dark:data-[state=active]:text-violet-100"
        >
          수집함
        </TabsTrigger>
      </TabsList>

      <TabsContent value="docs-write" className="mt-0">
        <DocsEditor
          key={`docs-editor-${editorKey}`}
          focusDocId={focusId}
          onFocusHandled={() => {
            setFocusId(null)
            onFocusHandled?.()
          }}
          writingFirst={writingFirst}
          onDirtyChange={(d) => {
            dirtyRef.current = d
          }}
        />
      </TabsContent>

      <TabsContent value="docs-view" className="mt-0">
        <DocsBrowsePanel onOpenWrite={openWrite} onCreateNew={() => void createNew()} />
      </TabsContent>

      <TabsContent value="docs-intake" className="mt-0">
        <IntakeCenter
          onOpenDoc={openWrite}
          onOpenJournal={(entryKey, date) => onOpenJournal?.(entryKey, date)}
        />
      </TabsContent>
    </Tabs>
  )
}
