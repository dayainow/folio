'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GlobalSearch, type SearchNavigatePayload } from '@/components/global-search';
import { ThemeToggle } from '@/components/theme-toggle';
import { StorageModeToggle } from '@/components/storage-mode-toggle';
import { HealthStatus } from '@/components/health-status';
import { BeaconChangeBadge } from '@/components/beacon-change-badge';
import { OfflineStatusBadge } from '@/components/offline-status';
import { MobileNav } from '@/components/mobile-nav';
import { FullExportButton } from '@/components/full-export-button';
import { getActiveTeamId } from '@/lib/team';
import { parseFolioDeepLink } from '@/lib/folio-links';
import { Activity } from 'lucide-react';

const PanelFallback = ({ label }: { label: string }) => (
  <div className="min-h-[28rem] py-10 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
    {label} 로딩 중…
  </div>
);

const WidgetSkeleton = () => (
  <section aria-hidden className="mb-6">
    <div className="mb-2 flex h-11 items-center justify-between gap-2">
      <div className="h-3 w-10 rounded bg-muted/50" />
      <div className="h-8 w-16 rounded bg-muted/40" />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="min-h-[11rem] h-44 rounded-2xl border border-gray-100 dark:border-gray-800 bg-muted/30 animate-pulse"
        />
      ))}
    </div>
  </section>
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

const WidgetDashboard = dynamic(
  () => import('@/components/widgets').then((m) => ({ default: m.WidgetDashboard })),
  { ssr: false, loading: () => <WidgetSkeleton /> },
);

const PwaInstallPrompt = dynamic(
  () => import('@/components/pwa-install-prompt').then((m) => ({ default: m.PwaInstallPrompt })),
  { ssr: false, loading: () => null },
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
  const mainRef = useRef<HTMLElement>(null);
  const panelFocusRef = useRef<HTMLDivElement>(null);

  const handleActiveTeamChange = useCallback((teamId: string | null) => {
    setActiveTeamIdState(teamId);
  }, []);

  const handleTabChange = useCallback((v: string) => {
    setTab(v as TabValue);
    // 탭 전환 시 패널 첫 포커스 가능 영역으로 이동
    window.setTimeout(() => {
      const root = panelFocusRef.current;
      if (!root) return;
      const first = root.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }, 0);
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

  // Slack 「확인」 등 딥링크 (마운트 후 적용 · hydration 안전)
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const parsed = parseFolioDeepLink(window.location.search);
      if (!parsed.tab) return;
      setTab(parsed.tab);
      if (parsed.tab === 'journal' && parsed.date) setFocusJournalDate(parsed.date);
      if (parsed.tab === 'docs' && parsed.docId) setFocusDocId(parsed.docId);
      if (parsed.tab === 'board' && parsed.taskId) setFocusTaskId(parsed.taskId);
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.pathname);
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  // 온라인 복구 시 오프라인 큐 동기화
  useEffect(() => {
    const onOnline = () => {
      void import('@/lib/offline-sync').then(({ syncWhenOnline }) => syncWhenOnline());
    };
    window.addEventListener('online', onOnline);
    if (navigator.onLine) {
      window.setTimeout(onOnline, 1500);
    }
    return () => window.removeEventListener('online', onOnline);
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
      <a href="#main-content" className="skip-link">
        본문으로 건너뛰기
      </a>
      <header
        className="border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between bg-background/80 backdrop-blur sticky top-0 z-50 gap-3"
        role="banner"
      >
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
          <FullExportButton />
          <HealthStatus />
          <OfflineStatusBadge />
          <BeaconChangeBadge />
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
          {authReady ? (
            email ? (
              <div className="flex items-center gap-2 min-w-[5.5rem] justify-end">
                <span className="text-xs text-muted-foreground max-w-[160px] truncate" title={email}>
                  {email}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 min-h-[44px] px-3 text-xs sm:h-7 sm:min-h-0"
                  onClick={() => void handleSignOut()}
                  aria-label="로그아웃"
                >
                  로그아웃
                </Button>
              </div>
            ) : (
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: 'sm' }),
                  'h-11 min-h-[44px] px-3 text-xs sm:h-7 sm:min-h-0 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white',
                )}
              >
                로그인
              </Link>
            )
          ) : (
            <div
              className="h-11 w-[4.5rem] sm:h-7 rounded-md bg-muted/40 animate-pulse"
              aria-hidden
            />
          )}
        </div>
      </header>

      <TeamSidebar
        open={teamPanelOpen}
        onClose={() => setTeamPanelOpen(false)}
        activeTeamId={activeTeamId}
        onActiveTeamChange={handleActiveTeamChange}
      />

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full outline-none pb-24 md:pb-6"
      >
        <GlobalSearch onNavigate={handleSearchNavigate} />

        <PwaInstallPrompt />

        <WidgetDashboard onOpenTab={(t) => handleTabChange(t)} />

        <div ref={panelFocusRef}>
        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList
            aria-label="주요 패널"
            className="hidden md:inline-flex bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-1 rounded-xl mb-6 w-fit"
          >
            <TabsTrigger value="journal" className="gap-2 min-h-[44px] px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm">
              📓 일지
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2 min-h-[44px] px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm">
              📄 문서
            </TabsTrigger>
            <TabsTrigger value="board" className="gap-2 min-h-[44px] px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm">
              📋 일정
            </TabsTrigger>
            <TabsTrigger value="process" className="gap-2 min-h-[44px] px-4 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-sm">
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
        </div>
      </main>

      <MobileNav value={tab} onChange={(v) => handleTabChange(v)} />

      <footer
        className="hidden md:block px-6 py-3 border-t border-gray-50 dark:border-gray-900 text-center text-xs text-muted-foreground"
        role="contentinfo"
      >
        Folio · 브라우저에 저장되는 개인 워크스페이스
      </footer>
    </div>
  );
}
