'use client'

/**
 * P58 — 일지 「보기」 패널 (캘린더 / 목록 / 트리 / 통계)
 */
import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { JournalCalendar } from '@/components/journal-calendar'
import { JournalList } from '@/components/journal-list'
import { JournalTree } from '@/components/journal-tree'
import { JournalStatsPanel } from '@/components/journal-stats'
import {
  deleteJournals,
  loadJournals,
  loadJournalsWithFallback,
  type JournalEntry,
} from '@/lib/journal'
import { collectDatesInFolder } from '@/lib/journal-tree'

export type JournalBrowsePanelProps = {
  focusDate?: string | null
  focusFolder?: string | null
  onOpenWrite?: (date: string) => void
  onFocusHandled?: () => void
}

export function JournalBrowsePanel({
  focusDate,
  focusFolder,
  onOpenWrite,
  onFocusHandled,
}: JournalBrowsePanelProps) {
  const [journals, setJournals] = useState<Record<string, JournalEntry>>({})
  const [ready, setReady] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [view, setView] = useState('calendar')

  const reload = useCallback(() => {
    setJournals(loadJournals())
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadJournalsWithFallback().then((j) => {
      if (cancelled) return
      setJournals(j)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (focusDate) {
      setSelectedDate(focusDate)
      onFocusHandled?.()
    }
  }, [focusDate, ready, onFocusHandled])

  useEffect(() => {
    if (!ready || !focusFolder) return
    setFolderId(focusFolder)
    setView('tree')
  }, [focusFolder, ready])

  const folderDates = folderId ? collectDatesInFolder(folderId, journals) : null

  const selectDate = (date: string) => {
    setSelectedDate(date)
    onOpenWrite?.(date)
  }

  const handleDelete = (dates: string[]) => {
    deleteJournals(dates)
    reload()
  }

  if (!ready) {
    return <p className="py-8 text-center text-xs text-muted-foreground">일지 불러오는 중…</p>
  }

  return (
    <Tabs value={view} onValueChange={setView} className="w-full">
      <TabsList className="mb-3 h-auto flex-wrap gap-1 border-0 bg-transparent p-0">
        <TabsTrigger
          value="calendar"
          className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
        >
          캘린더
        </TabsTrigger>
        <TabsTrigger
          value="list"
          className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
        >
          목록
        </TabsTrigger>
        <TabsTrigger
          value="tree"
          className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
        >
          트리
        </TabsTrigger>
        <TabsTrigger
          value="stats"
          className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
        >
          통계
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calendar" className="mt-0">
        <JournalCalendar
          journals={journals}
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          onJournalsChange={reload}
        />
      </TabsContent>

      <TabsContent value="list" className="mt-0">
        <JournalList
          journals={journals}
          selectedDate={selectedDate}
          folderFilterId={folderId}
          folderDates={folderDates}
          onSelectDate={selectDate}
          onJournalsChange={reload}
        />
      </TabsContent>

      <TabsContent value="tree" className="mt-0">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <JournalTree
            journals={journals}
            selectedDate={selectedDate}
            selectedFolderId={folderId}
            onSelectDate={selectDate}
            onSelectFolder={setFolderId}
            onJournalsChange={reload}
            onDeleteJournals={handleDelete}
            className="min-h-[24rem]"
          />
          <JournalList
            journals={journals}
            selectedDate={selectedDate}
            folderFilterId={folderId}
            folderDates={folderDates}
            onSelectDate={selectDate}
            onJournalsChange={reload}
          />
        </div>
      </TabsContent>

      <TabsContent value="stats" className="mt-0">
        <JournalStatsPanel journals={journals} />
      </TabsContent>
    </Tabs>
  )
}
