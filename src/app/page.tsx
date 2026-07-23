'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JournalPanel } from '@/components/journal';
import { DocsPanel } from '@/components/docs';
import { BoardPanel } from '@/components/board';

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-900 to-gray-600 flex items-center justify-center text-white font-bold text-sm">W</div>
          <h1 className="text-lg font-semibold tracking-tight">Workspace</h1>
        </div>
        <span className="text-xs text-gray-400">Obsidian · Notion · Jira in one</span>
      </header>

      {/* Main */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Tabs defaultValue="journal" className="w-full">
          <TabsList className="bg-gray-50 border border-gray-100 p-1 rounded-xl mb-6 w-fit">
            <TabsTrigger value="journal" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              📓 Journal
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              📄 Docs
            </TabsTrigger>
            <TabsTrigger value="board" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              📋 Board
            </TabsTrigger>
          </TabsList>

          <TabsContent value="journal" className="mt-0">
            <JournalPanel />
          </TabsContent>
          <TabsContent value="docs" className="mt-0">
            <DocsPanel />
          </TabsContent>
          <TabsContent value="board" className="mt-0">
            <BoardPanel />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="px-6 py-3 border-t border-gray-50 text-center text-xs text-gray-400">
        Workspace · 모든 데이터는 이 브라우저에 로컬 저장됩니다
      </footer>
    </div>
  );
}
