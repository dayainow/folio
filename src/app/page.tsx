'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { JournalPanel } from '@/components/journal';
import { DocsPanel } from '@/components/docs';
import { BoardPanel } from '@/components/board';
import { GlobalSearch, type SearchNavigatePayload } from '@/components/global-search';
import { ThemeToggle } from '@/components/theme-toggle';
import { TeamSwitcher } from '@/components/team-switcher';
import { TeamSidebar } from '@/components/team-sidebar';
import { createBrowserSupabaseClient, signOut } from '@/lib/supabase';
import { migrateLocalDataOnLogin } from '@/lib/migrate';
import { getActiveTeamId } from '@/lib/team';

type TabValue = 'journal' | 'docs' | 'board';

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<TabValue>('journal');
  const [focusJournalDate, setFocusJournalDate] = useState<string | null>(null);
  const [focusDocId, setFocusDocId] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);

  const handleActiveTeamChange = useCallback((teamId: string | null) => {
    setActiveTeamIdState(teamId);
  }, []);

  useEffect(() => {
    setActiveTeamIdState(getActiveTeamId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const boot = async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        setEmail(data.user?.email ?? null);
        setAuthReady(true);
        if (data.user) {
          void migrateLocalDataOnLogin().catch(() => undefined);
        }
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          setEmail(session?.user?.email ?? null);
          setAuthReady(true);
          if (event === 'SIGNED_IN' && session?.user) {
            void migrateLocalDataOnLogin().catch(() => undefined);
          }
          if (event === 'SIGNED_OUT') {
            setActiveTeamIdState(null);
            setTeamPanelOpen(false);
          }
        });
        unsubscribe = () => subscription.unsubscribe();
      } catch {
        if (cancelled) return;
        setEmail(null);
        setAuthReady(true);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setEmail(null);
      setActiveTeamIdState(null);
    } catch {
      setEmail(null);
    }
  };

  const handleSearchNavigate = (payload: SearchNavigatePayload) => {
    if (payload.source === 'journal') {
      setTab('journal');
      setFocusJournalDate(payload.hit.date);
      return;
    }
    if (payload.source === 'docs') {
      setTab('docs');
      setFocusDocId(payload.hit.id);
      return;
    }
    setTab('board');
    setFocusTaskId(payload.hit.id);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between bg-background/80 backdrop-blur sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col leading-none">
            <span
              className="relative inline-block text-[22px] font-bold tracking-[-0.07em] text-foreground"
              style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }}
            >
              Folio
              <span
                aria-hidden
                className="absolute -right-2 top-0.5 h-1.5 w-1.5 rotate-45 rounded-[1px] bg-foreground"
              />
            </span>
            <span className="mt-1 text-[10px] font-medium tracking-[0.18em] text-muted-foreground">
              project records
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">프로젝트의 기록</span>
          <ThemeToggle />
          {authReady && email && (
            <TeamSwitcher
              enabled
              activeTeamId={activeTeamId}
              onActiveTeamChange={handleActiveTeamChange}
              onOpenManage={() => setTeamPanelOpen(true)}
            />
          )}
          {authReady && (
            email ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground max-w-[160px] truncate" title={email}>
                  {email}
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleSignOut()}>
                  로그아웃
                </Button>
              </div>
            ) : (
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: 'sm' }),
                  'h-7 text-xs bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white',
                )}
              >
                로그인
              </Link>
            )
          )}
        </div>
      </header>

      <TeamSidebar
        open={teamPanelOpen}
        onClose={() => setTeamPanelOpen(false)}
        activeTeamId={activeTeamId}
        onActiveTeamChange={handleActiveTeamChange}
      />

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <GlobalSearch onNavigate={handleSearchNavigate} />

        <Tabs
          value={tab}
          onValueChange={v => setTab(v as TabValue)}
          className="w-full"
        >
          <TabsList className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-1 rounded-xl mb-6 w-fit">
            <TabsTrigger value="journal" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm">
              📓 일지
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm">
              📄 문서
            </TabsTrigger>
            <TabsTrigger value="board" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm">
              📋 일정
            </TabsTrigger>
          </TabsList>

          <TabsContent value="journal" className="mt-0">
            <JournalPanel
              focusDate={focusJournalDate}
              onFocusHandled={() => setFocusJournalDate(null)}
            />
          </TabsContent>
          <TabsContent value="docs" className="mt-0">
            <DocsPanel
              focusDocId={focusDocId}
              onFocusHandled={() => setFocusDocId(null)}
            />
          </TabsContent>
          <TabsContent value="board" className="mt-0">
            <BoardPanel
              focusTaskId={focusTaskId}
              onFocusHandled={() => setFocusTaskId(null)}
            />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="px-6 py-3 border-t border-gray-50 dark:border-gray-900 text-center text-xs text-muted-foreground">
        Folio · 브라우저에 저장되는 개인 워크스페이스
      </footer>
    </div>
  );
}
