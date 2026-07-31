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
import { McpSyncButton } from '@/components/mcp-sync-button';
import { getActiveTeamId } from '@/lib/team';
import { parseFolioDeepLink } from '@/lib/folio-links';
import { Activity, PanelRight, X } from 'lucide-react';

const PanelFallback = ({ label }: { label: string }) => (
  <div className="min-h-[12rem] py-8 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
    {label} 로딩 중…
  </div>
);

const SidebarSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-3 p-1">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/40" />
    ))}
  </div>
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

const WidgetSidebar = dynamic(
  () => import('@/components/widgets').then((m) => ({ default: m.WidgetSidebar })),
  { ssr: false, loading: () => <SidebarSkeleton /> },
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [journalPreview, setJournalPreview] = useState<{ date: string; content: string } | null>(
    null,
  );
  const mainRef = useRef<HTMLElement>(null);
  const panelFocusRef = useRef<HTMLDivElement>(null);

  const handleActiveTeamChange = useCallback((teamId: string | null) => {
    setActiveTeamIdState(teamId);
  }, []);

  const handleDraftChange = useCallback((date: string, content: string) => {
    setJournalPreview((prev) => {
      if (prev?.date === date && prev?.content === content) return prev;
      return { date, content };
    });
  }, []);

  const handleTabChange = useCallback((v: string) => {
    setTab(v as TabValue);
    setMobileSidebarOpen(false);
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

  const sidebarFooter = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <StorageModeToggle />
        <ThemeToggle />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <FullExportButton />
        <McpSyncButton />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <HealthStatus />
        <OfflineStatusBadge />
        <BeaconChangeBadge />
      </div>
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
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="truncate text-[11px] text-muted-foreground" title={email}>
              {email}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-[11px]"
              onClick={() => void handleSignOut()}
            >
              로그아웃
            </Button>
          </div>
        ) : (
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: 'sm', variant: 'outline' }),
              'h-8 w-full text-xs',
            )}
          >
            로그인
          </Link>
        )
      ) : null}
    </div>
  );

  const sidebar = (
    <WidgetSidebar
      onOpenTab={(t) => handleTabChange(t)}
      journalPreview={journalPreview}
      footer={sidebarFooter}
      className="h-full"
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main-content" className="skip-link">
        본문으로 건너뛰기
      </a>

      {/* 최소 헤더: 로고 + 탭 + 검색 */}
      <header
        className="sticky top-0 z-50 border-b border-gray-100 bg-background/90 px-3 backdrop-blur dark:border-gray-800 sm:px-4"
        role="banner"
      >
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="relative inline-block text-lg font-bold tracking-[-0.07em] text-foreground"
              style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }}
            >
              Folio
              <span
                aria-hidden
                className="absolute -right-1.5 top-0.5 h-1 w-1 rotate-45 rounded-[1px] bg-foreground"
              />
            </span>
          </div>

          <nav aria-label="주요 패널" className="hidden min-w-0 flex-1 md:block">
            <ul className="flex items-center gap-0.5">
              {(
                [
                  { value: 'journal' as const, label: '일지' },
                  { value: 'docs' as const, label: '문서' },
                  { value: 'board' as const, label: '일정' },
                  { value: 'process' as const, label: '프로세스', icon: true },
                ] as const
              ).map((item) => (
                <li key={item.value}>
                  <button
                    type="button"
                    onClick={() => handleTabChange(item.value)}
                    aria-current={tab === item.value ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs transition-colors',
                      tab === item.value
                        ? 'bg-gray-100 font-medium text-foreground dark:bg-gray-800'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    {'icon' in item && item.icon ? <Activity className="h-3 w-3" /> : null}
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <GlobalSearch variant="icon" onNavigate={handleSearchNavigate} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:hidden"
              aria-label="요약 패널 열기"
              aria-expanded={mobileSidebarOpen}
              onClick={() => setMobileSidebarOpen(true)}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <TeamSidebar
        open={teamPanelOpen}
        onClose={() => setTeamPanelOpen(false)}
        activeTeamId={activeTeamId}
        onActiveTeamChange={handleActiveTeamChange}
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 outline-none px-3 pt-5 pb-24 sm:px-4 sm:pt-7 lg:pb-6"
        >
          <PwaInstallPrompt />

          <div ref={panelFocusRef}>
            <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
              <TabsContent value="journal" className="mt-0">
                <Tabs defaultValue="journal-write" className="w-full">
                  <TabsList className="mb-3 h-auto gap-1 border-0 bg-transparent p-0">
                    <TabsTrigger
                      value="journal-write"
                      className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                    >
                      일지
                    </TabsTrigger>
                    <TabsTrigger
                      value="journal-stats"
                      className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                    >
                      통계
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="journal-write" className="mt-0">
                    <JournalPanel
                      focusDate={focusJournalDate}
                      onFocusHandled={() => setFocusJournalDate(null)}
                      onDraftChange={handleDraftChange}
                      writingFirst
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
                  writingFirst
                />
              </TabsContent>
              <TabsContent value="board" className="mt-0">
                <Tabs defaultValue="board-kanban" className="w-full">
                  <TabsList className="mb-2 h-auto gap-1 border-0 bg-transparent p-0">
                    <TabsTrigger
                      value="board-kanban"
                      className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                    >
                      일정
                    </TabsTrigger>
                    <TabsTrigger
                      value="board-analytics"
                      className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
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

        {/* 데스크톱 우측 사이드바 280px */}
        <aside className="hidden w-[280px] shrink-0 border-l border-gray-100 p-3 dark:border-gray-800 lg:block">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            {sidebar}
          </div>
        </aside>
      </div>

      {/* 모바일: 하단 시트 */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal aria-label="요약 패널">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="닫기"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-gray-100 bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl dark:border-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">요약</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="패널 닫기"
                onClick={() => setMobileSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      <MobileNav value={tab} onChange={(v) => handleTabChange(v)} />
    </div>
  );
}
