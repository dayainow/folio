'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GlobalSearch, type SearchNavigatePayload } from '@/components/global-search';
import { ThemeToggle } from '@/components/theme-toggle';
import { StorageModeToggle } from '@/components/storage-mode-toggle';
import { getActiveTeamId } from '@/lib/team';
import { Activity } from 'lucide-react';

const PanelFallback = ({ label }: { label: string }) => (
  <div className="py-16 text-center text-sm text-muted-foreground">{label} 로딩 중…</div>
);

const JournalPanel = dynamic(
  () => import('@/components/journal').then((m) => ({ default: m.JournalPanel })),
  { ssr: false, loading: () => <PanelFallback label="일지" /> },
);

const DocsPanel = dynamic(
  () => import('@/components/docs').then((m) => ({ default: m.DocsPanel })),
  { ssr: false, loading: () => <PanelFallback label="문서" /> },
);

const BoardPanel = dynamic(
  () => import('@/components/board').then((m) => ({ default: m.BoardPanel })),
  { ssr: false, loading: () => <PanelFallback label="일정" /> },
);

const BeaconPanel = dynamic(
  () => import('@/components/beacon').then((m) => ({ default: m.BeaconPanel })),
  { ssr: false, loading: () => <PanelFallback label="프로세스" /> },
);

const JournalAnalyticsPanel = dynamic(
  () => import('@/components/analytics').then((m) => ({ default: m.JournalAnalyticsPanel })),
  { ssr: false, loading: () => <PanelFallback label="통계" /> },
);

const BoardAnalyticsPanel = dynamic(
  () => import('@/components/analytics').then((m) => ({ default: m.BoardAnalyticsPanel })),
  { ssr: false, loading: () => <PanelFallback label="분석" /> },
);

const TeamSwitcher = dynamic(
  () => import('@/components/team-switcher').then((m) => ({ default: m.TeamSwitcher })),
  { ssr: false },
);

const TeamSidebar = dynamic(
  () => import('@/components/team-sidebar').then((m) => ({ default: m.TeamSidebar })),
  { ssr: false },
);

type TabValue = 'journal' | 'docs' | 'board' | 'process';

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<TabValue>('journal');
  const [focusJournalDate, setFocusJournalDate] = useState<string | null>(null);
  const [focusDocId, setFocusDocId] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(() =>
    typeof window !== 'undefined' ? getActiveTeamId() : null,
  );
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);

  const handleActiveTeamChange = useCallback((teamId: string | null) => {
    setActiveTeamIdState(teamId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const boot = async () => {
      try {
        const [{ createBrowserSupabaseClient }, { migrateLocalDataOnLogin }] = await Promise.all([
          import('@/lib/supabase'),
          import('@/lib/migrate'),
        ]);
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
            void import('@/lib/migrate').then(({ migrateLocalDataOnLogin: migrate }) =>
              migrate().catch(() => undefined),
            );
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
      const { signOut } = await import('@/lib/supabase');
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
          <StorageModeToggle />
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
            <TabsTrigger value="process" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm">
              <Activity className="h-3.5 w-3.5" />
              프로세스
            </TabsTrigger>
          </TabsList>

          <TabsContent value="journal" className="mt-0">
            <Tabs defaultValue="journal-write" className="w-full">
              <TabsList className="bg-transparent border-0 p-0 mb-4 h-auto gap-1">
                <TabsTrigger
                  value="journal-write"
                  className="rounded-lg px-3 h-8 text-xs data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                >
                  일지
                </TabsTrigger>
                <TabsTrigger
                  value="journal-stats"
                  className="rounded-lg px-3 h-8 text-xs data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                >
                  통계
                </TabsTrigger>
              </TabsList>
              <TabsContent value="journal-write" className="mt-0">
                <JournalPanel
                  focusDate={focusJournalDate}
                  onFocusHandled={() => setFocusJournalDate(null)}
                />
              </TabsContent>
              <TabsContent value="journal-stats" className="mt-0">
                <JournalAnalyticsPanel />
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="docs" className="mt-0">
            <DocsPanel
              focusDocId={focusDocId}
              onFocusHandled={() => setFocusDocId(null)}
            />
          </TabsContent>
          <TabsContent value="board" className="mt-0">
            <Tabs defaultValue="board-kanban" className="w-full">
              <TabsList className="bg-transparent border-0 p-0 mb-4 h-auto gap-1">
                <TabsTrigger
                  value="board-kanban"
                  className="rounded-lg px-3 h-8 text-xs data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                >
                  일정
                </TabsTrigger>
                <TabsTrigger
                  value="board-analytics"
                  className="rounded-lg px-3 h-8 text-xs data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                >
                  분석
                </TabsTrigger>
              </TabsList>
              <TabsContent value="board-kanban" className="mt-0">
                <BoardPanel
                  focusTaskId={focusTaskId}
                  onFocusHandled={() => setFocusTaskId(null)}
                />
              </TabsContent>
              <TabsContent value="board-analytics" className="mt-0">
                <BoardAnalyticsPanel />
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="process" className="mt-0">
            <BeaconPanel />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="px-6 py-3 border-t border-gray-50 dark:border-gray-900 text-center text-xs text-muted-foreground">
        Folio · 브라우저에 저장되는 개인 워크스페이스
      </footer>
    </div>
  );
}
