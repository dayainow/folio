'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SearchNavigatePayload } from '@/components/global-search';
import { LanguageToggle } from '@/components/language-toggle';
import { useI18n } from '@/components/i18n-provider';
import { ThemeToggle } from '@/components/theme-toggle'
import { HelpTipsButton } from '@/components/help-tips';
import { ShortcutSettingsButton } from '@/components/shortcut-settings';
import { StorageModeToggle } from '@/components/storage-mode-toggle';
import { CollabModeToggle } from '@/components/collab-mode-toggle';
import { HealthStatus } from '@/components/health-status';
import { BeaconChangeBadge } from '@/components/beacon-change-badge';
import { OfflineStatusBadge } from '@/components/offline-status';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { PerfProfiler } from '@/lib/render-profiler';
import { MobileNav } from '@/components/mobile-nav';
import { McpSyncButton } from '@/components/mcp-sync-button';
import { SpriteIcon } from '@/components/icon-sprite';
import { getActiveTeamId } from '@/lib/team';
import { buildFolioHash, parseFolioDeepLink, parseFolioHash } from '@/lib/folio-links';
import { useSwipe } from '@/hooks/use-swipe';
import {
  dispatchMobileAction,
  getMobileFullscreen,
  setMobileFullscreen,
  subscribeMobileFullscreen,
} from '@/lib/mobile-actions';
import { Activity, BookOpen, ChevronDown, FolderKanban, Maximize2, Minimize2, PanelRight, Sparkles, Users, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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

const PersonalAssistantHome = dynamic(
  () =>
    import('@/components/personal-assistant-home').then((m) => ({
      default: m.PersonalAssistantHome,
    })),
  { ssr: false, loading: () => <PanelFallback label="오늘의 기록 비서" /> },
);

const ProjectHub = dynamic(
  () => import('@/components/project-hub').then((m) => ({ default: m.ProjectHub })),
  { ssr: false, loading: () => <PanelFallback label="프로젝트" /> },
);

const JournalBrowsePanel = dynamic(
  () => import('@/components/journal-browse').then((m) => ({ default: m.JournalBrowsePanel })),
  { ssr: false, loading: () => <PanelFallback label="일지 보기" /> },
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

const SummarySidebar = dynamic(
  () => import('@/components/summary-sidebar').then((m) => ({ default: m.SummarySidebar })),
  { ssr: false, loading: () => <SidebarSkeleton /> },
);

const CollabPanel = dynamic(
  () => import('@/components/collab-panel').then((m) => ({ default: m.CollabPanel })),
  { ssr: false },
);

const NotificationCenterButton = dynamic(
  () =>
    import('@/components/notification-hub').then((m) => ({
      default: m.NotificationHubButton,
    })),
  { ssr: false },
);

const SecuritySettingsButton = dynamic(
  () =>
    import('@/components/security-settings').then((m) => ({
      default: m.SecuritySettingsButton,
    })),
  { ssr: false },
);

const PluginsButton = dynamic(
  () =>
    import('@/components/plugin-marketplace').then((m) => ({
      default: m.PluginsButton,
    })),
  { ssr: false, loading: () => null },
);

const PwaInstallPrompt = dynamic(
  () => import('@/components/pwa-install-prompt').then((m) => ({ default: m.PwaInstallPrompt })),
  { ssr: false, loading: () => null },
);

const WelcomeModal = dynamic(
  () => import('@/components/welcome-modal').then((m) => ({ default: m.WelcomeModal })),
  { ssr: false, loading: () => null },
);

const ProductivityHost = dynamic(
  () => import('@/components/productivity-host').then((m) => ({ default: m.ProductivityHost })),
  { ssr: false, loading: () => null },
);

/** P66 — 무거운 사이드바/툴바 청크 분리 */
const GlobalSearch = dynamic(
  () => import('@/components/global-search').then((m) => ({ default: m.GlobalSearch })),
  { ssr: false, loading: () => null },
);

const AdvancedSearchButton = dynamic(
  () =>
    import('@/components/advanced-search').then((m) => ({ default: m.AdvancedSearchButton })),
  { ssr: false, loading: () => null },
);

const FullExportButton = dynamic(
  () => import('@/components/full-export-button').then((m) => ({ default: m.FullExportButton })),
  { ssr: false, loading: () => null },
);

const ExportShareButton = dynamic(
  () => import('@/components/export-share-panel').then((m) => ({ default: m.ExportShareButton })),
  { ssr: false, loading: () => null },
);

const ReportsButton = dynamic(
  () => import('@/components/reports-panel').then((m) => ({ default: m.ReportsButton })),
  { ssr: false, loading: () => null },
);

const DataMigrationButton = dynamic(
  () =>
    import('@/components/data-migration-panel').then((m) => ({ default: m.DataMigrationButton })),
  { ssr: false, loading: () => null },
);

const StorageObservabilityButton = dynamic(
  () =>
    import('@/components/storage-observability').then((m) => ({
      default: m.StorageObservabilityButton,
    })),
  { ssr: false, loading: () => null },
);

const PerfObservabilityButton = dynamic(
  () =>
    import('@/components/perf-observability').then((m) => ({
      default: m.PerfObservabilityButton,
    })),
  { ssr: false, loading: () => null },
);

const AiToolsButton = dynamic(
  () => import('@/components/ai-tools-panel').then((m) => ({ default: m.AiToolsButton })),
  { ssr: false, loading: () => null },
);

type TabValue = 'assistant' | 'projects' | 'journal' | 'docs' | 'board' | 'process';

const TAB_ORDER: TabValue[] = ['assistant', 'projects', 'journal', 'docs', 'board', 'process'];

export default function Home() {
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [routeReady, setRouteReady] = useState(false);
  const [tab, setTab] = useState<TabValue>('assistant');
  const [focusJournalDate, setFocusJournalDate] = useState<string | null>(null);
  const [focusJournalFolder, setFocusJournalFolder] = useState<string | null>(null);
  const [journalSubTab, setJournalSubTab] = useState<'journal-write' | 'journal-view'>(
    'journal-write',
  );
  const [focusDocId, setFocusDocId] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(() =>
    typeof window !== 'undefined' ? getActiveTeamId() : null,
  );
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [collabPanelOpen, setCollabPanelOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [journalPreview, setJournalPreview] = useState<{ date: string; content: string } | null>(
    null,
  );
  const [mobileFs, setMobileFs] = useState(() => {
    if (typeof window === 'undefined') return false;
    return getMobileFullscreen();
  });
  const mainRef = useRef<HTMLElement>(null);
  const panelFocusRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeMobileFullscreen(setMobileFs), []);

  useEffect(() => {
    const applyHashRoute = () => {
      const route = parseFolioHash(window.location.hash);
      setTab(route.tab);
      if (route.journalSubTab) setJournalSubTab(route.journalSubTab);
      setRouteReady(true);
    };
    const timer = window.setTimeout(applyHashRoute, 0);
    window.addEventListener('hashchange', applyHashRoute);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', applyHashRoute);
    };
  }, []);

  useEffect(() => {
    if (!routeReady) return;
    const route = parseFolioHash(window.location.hash);
    if (tab === 'docs' && route.tab === 'docs') return;
    const nextHash = buildFolioHash(tab, { journalSubTab });
    if (window.location.hash !== nextHash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}${nextHash}`,
      );
    }
  }, [journalSubTab, routeReady, tab]);

  useEffect(() => {
    void import('@/plugins').then((m) => m.bootstrapBuiltinPlugins());
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

  // P57 — Background Sync 등록 + 오프라인 시 IndexedDB → localStorage 하이드레이트
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { ensureBackgroundSync, hydrateFromIndexedDb } = await import('@/lib/offline-sync');
      await ensureBackgroundSync();
      if (cancelled || navigator.onLine) return;
      const { getLocalJson, setLocalJson, flushLocalJson } = await import('@/lib/local-cache');
      const pairs: Array<{ type: 'journal' | 'docs' | 'board' | 'projects'; key: string; empty: (v: unknown) => boolean }> = [
        {
          type: 'journal',
          key: 'workspace_journals',
          empty: (v) => !v || (typeof v === 'object' && Object.keys(v as object).length === 0),
        },
        {
          type: 'docs',
          key: 'workspace_docs',
          empty: (v) => !Array.isArray(v) || v.length === 0,
        },
        {
          type: 'board',
          key: 'workspace_tasks',
          empty: (v) => !Array.isArray(v) || v.length === 0,
        },
        {
          type: 'projects',
          key: 'workspace_projects',
          empty: (v) => !Array.isArray(v) || v.length === 0,
        },
      ];
      for (const p of pairs) {
        const current = getLocalJson(p.key, p.type === 'journal' ? {} : []);
        if (!p.empty(current)) continue;
        const snap = await hydrateFromIndexedDb(p.type);
        if (snap != null && !p.empty(snap)) {
          setLocalJson(p.key, snap);
          flushLocalJson(p.key);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // P42/P57 — Background Sync → 클라이언트 flush
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMsg = (event: MessageEvent) => {
      if (event.data?.type === 'folio-background-sync') {
        void import('@/lib/offline-sync').then(({ syncWhenOnline }) => syncWhenOnline());
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    return () => navigator.serviceWorker.removeEventListener('message', onMsg);
  }, []);

  // P43 — 팀 협업 알림 (멘션 · 초대 · Gate)
  useEffect(() => {
    let unsub: (() => void) | undefined;
    void import('@/lib/collab-notify').then(({ subscribeTeamNotify }) => {
      unsub = subscribeTeamNotify({
        userId: email ?? undefined,
        email,
        name: email?.split('@')[0] ?? null,
      });
    });
    return () => unsub?.();
  }, [email]);

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

  useSwipe(swipeRef, {
    axis: 'both',
    threshold: 64,
    haptic: true,
    onEdgeSwipeRight: () => {
      if (mobileSidebarOpen) {
        setMobileSidebarOpen(false);
        return;
      }
      const idx = TAB_ORDER.indexOf(tab);
      if (idx > 0) handleTabChange(TAB_ORDER[idx - 1]!);
    },
    onSwipe: (dir) => {
      if (dir === 'left' || dir === 'right') {
        const idx = TAB_ORDER.indexOf(tab);
        if (idx < 0) return;
        if (dir === 'left' && idx < TAB_ORDER.length - 1) handleTabChange(TAB_ORDER[idx + 1]!);
        if (dir === 'right' && idx > 0) handleTabChange(TAB_ORDER[idx - 1]!);
        return;
      }
      // P44 — 상하 스와이프: 사이드바 토글
      if (dir === 'up') setMobileSidebarOpen(true);
      if (dir === 'down') setMobileSidebarOpen(false);
    },
  });

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
        setUserId(data.user?.id ?? null);
        setAuthReady(true);
        void import('@/lib/audit-log').then(({ setAuditUser, loadAuditConfigFromRuntime }) => {
          setAuditUser(data.user?.email ?? 'guest');
          void loadAuditConfigFromRuntime();
        });
        if (data.user) {
          void migrateLocalDataOnLogin().catch(() => undefined);
          void import('@/lib/sessions').then(({ trackCurrentSession, touchCurrentSession }) => {
            void trackCurrentSession(data.user!.id);
            touchCurrentSession(data.user!.id);
          });
        }
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          setEmail(session?.user?.email ?? null);
          setUserId(session?.user?.id ?? null);
          setAuthReady(true);
          void import('@/lib/audit-log').then(({ setAuditUser }) => {
            setAuditUser(session?.user?.email ?? 'guest');
          });
          if (event === 'SIGNED_IN' && session?.user) {
            void import('@/lib/migrate').then(({ migrateLocalDataOnLogin: migrate }) =>
              migrate().catch(() => undefined),
            );
            void import('@/lib/sessions').then(({ trackCurrentSession }) =>
              trackCurrentSession(session.user!.id),
            );
            void import('@/lib/security-audit').then(({ recordSecurityAudit }) =>
              recordSecurityAudit({
                userId: session.user!.id,
                action: 'auth.login',
              }),
            );
          }
          if (event === 'SIGNED_OUT') {
            setActiveTeamIdState(null);
            setTeamPanelOpen(false);
            void import('@/lib/security-audit').then(({ recordSecurityAudit }) =>
              recordSecurityAudit({ action: 'auth.logout' }),
            );
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
      if (parsed.tab === 'journal' && parsed.folder) {
        setFocusJournalFolder(parsed.folder);
        setJournalSubTab('journal-view');
      }
      if (parsed.tab === 'docs' && parsed.docId) setFocusDocId(parsed.docId);
      if (parsed.tab === 'board' && parsed.taskId) setFocusTaskId(parsed.taskId);
      const url = new URL(window.location.href);
      url.search = '';
      window.history.replaceState({}, '', url.pathname);
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  const handleSignOut = async () => {
    try {
      const { signOut } = await import('@/lib/supabase');
      await signOut();
      setEmail(null);
      setUserId(null);
      setActiveTeamIdState(null);
    } catch {
      setEmail(null);
      setUserId(null);
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
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          도구와 설정
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageToggle />
          <Link
            href="/guide"
            className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'h-9 gap-1.5 text-xs')}
          >
            <BookOpen className="size-3.5" />
            {t('nav.guide')}
          </Link>
          <AdvancedSearchButton onNavigate={handleSearchNavigate} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => {
              setMobileSidebarOpen(false);
              setCollabPanelOpen(true);
            }}
          >
            <Users className="size-3.5" />
            협업
          </Button>
        </div>
      </div>
      <Separator className="my-1" />
      <div className="flex flex-wrap items-center gap-2">
        <StorageModeToggle />
        <CollabModeToggle />
        <ThemeToggle />
        <HelpTipsButton />
        <ShortcutSettingsButton />
      </div>
      <Separator className="my-1" />
      <div className="flex flex-wrap items-center gap-2">
        <FullExportButton />
        <ExportShareButton />
        <ReportsButton />
        <DataMigrationButton />
        <McpSyncButton />
      </div>
      <Separator className="my-1" />
      <div className="flex flex-wrap items-center gap-2">
        <HealthStatus />
        <StorageObservabilityButton />
        <PerfObservabilityButton />
        <AiToolsButton />
        <PluginsButton />
        <OfflineStatusBadge />
        <BeaconChangeBadge />
      </div>
      {authReady && email && (
        <>
          <Separator className="my-1" />
          <TeamSwitcher
            enabled
            activeTeamId={activeTeamId}
            onActiveTeamChange={handleActiveTeamChange}
            onOpenManage={() => setTeamPanelOpen(true)}
          />
        </>
      )}
      {authReady ? (
        email ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] text-muted-foreground" title={email}>
                {email}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-11 px-3 text-[11px]"
                onClick={() => void handleSignOut()}
              >
                {t('common.logout')}
              </Button>
            </div>
            {userId ? <SecuritySettingsButton userId={userId} /> : null}
          </div>
        ) : (
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: 'sm', variant: 'outline' }),
              'inline-flex min-h-11 w-full items-center justify-center text-xs',
            )}
          >
            {t('common.login')}
          </Link>
        )
      ) : null}
    </div>
  );

  const sidebar = (
    <SummarySidebar
      onOpenTab={(t) => handleTabChange(t)}
      onBookmarkNavigate={(payload) => {
        if (payload.kind === 'journal') {
          setTab('journal');
          setFocusJournalDate(payload.targetId);
          return;
        }
        if (payload.kind === 'doc') {
          setTab('docs');
          setFocusDocId(payload.targetId);
          return;
        }
        setTab('board');
        setFocusTaskId(payload.targetId);
      }}
      journalPreview={journalPreview}
      extras={sidebarFooter}
      className="h-full"
    />
  );

  return (
    <>
      <WebVitalsReporter />
      <WelcomeModal />
      <ProductivityHost
        onOpenJournalTab={() => setTab('journal')}
        onOpenDocsTab={() => setTab('docs')}
        onOpenBoardTab={() => setTab('board')}
        onOpenProcessTab={() => setTab('process')}
        onJournalSaved={(date) => {
          setTab('journal');
          setFocusJournalDate(date);
        }}
        onNewDoc={() => setTab('docs')}
        onNewTask={() => setTab('board')}
      />
      <PerfProfiler id="FolioHome">
    <div className={cn('folio-shell flex min-h-screen flex-col bg-background', mobileFs && 'folio-fs-root')}>
      <a href="#main-content" className="skip-link">
        {t('nav.skipToContent')}
      </a>

      {/* 최소 헤더: 로고 + 탭 + 검색 */}
      <header
        className={cn(
          'folio-header sticky top-0 z-50 px-3 sm:px-4',
          mobileFs && 'hidden md:block',
        )}
        role="banner"
      >
        <div className="mx-auto flex h-[3.75rem] max-w-[1600px] items-center gap-3 sm:gap-5">
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="folio-wordmark relative inline-flex items-center gap-2 text-[1.15rem] font-semibold tracking-[-0.055em] text-foreground"
              style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }}
            >
              <span className="folio-brand-mark"><SpriteIcon name="folio-mark" className="size-4.5" /></span>
              Folio
              <span
                aria-hidden
                className="absolute -right-2 top-0 h-1 w-1 rotate-45 rounded-[1px] bg-[var(--folio-jade)]"
              />
            </span>
          </div>

          <nav aria-label={t('nav.main')} className="hidden min-w-0 flex-1 md:block">
            <ul className="folio-primary-nav flex w-fit items-center gap-0.5 rounded-xl bg-muted/35 p-1">
              {(
                [
                  { value: 'assistant' as const, labelKey: 'nav.assistant', assistantIcon: true },
                  { value: 'journal' as const, labelKey: 'nav.journal' },
                  { value: 'docs' as const, labelKey: 'nav.docs' },
                  { value: 'board' as const, labelKey: 'nav.board' },
                ] as const
              ).map((item) => (
                <li key={item.value}>
                  <button
                    type="button"
                    onClick={() => handleTabChange(item.value)}
                    aria-current={tab === item.value ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs transition-colors',
                      tab === item.value
                        ? 'folio-nav-active font-semibold text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {'assistantIcon' in item && item.assistantIcon ? <Sparkles className="h-3 w-3" /> : null}
                    {t(item.labelKey)}
                  </button>
                </li>
              ))}
              <li>
                <details
                  className="group relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      event.currentTarget.removeAttribute('open');
                    }
                  }}
                >
                  <summary
                    className={cn(
                      'flex h-8 cursor-pointer list-none items-center gap-1 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground [&::-webkit-details-marker]:hidden',
                      (tab === 'projects' || tab === 'process') &&
                        'folio-nav-active font-semibold text-foreground',
                    )}
                  >
                    더보기
                    <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="absolute left-0 top-10 z-[70] w-44 rounded-xl border bg-background p-1.5 shadow-xl">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"
                      onClick={(event) => {
                        event.currentTarget.closest('details')?.removeAttribute('open');
                        handleTabChange('projects');
                      }}
                    >
                      <FolderKanban className="size-3.5 text-muted-foreground" />
                      {t('nav.projects')}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"
                      onClick={(event) => {
                        event.currentTarget.closest('details')?.removeAttribute('open');
                        handleTabChange('process');
                      }}
                    >
                      <Activity className="size-3.5 text-muted-foreground" />
                      {t('nav.process')}
                    </button>
                  </div>
                </details>
              </li>
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <GlobalSearch variant="icon" onNavigate={handleSearchNavigate} />
            <NotificationCenterButton />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-12 w-12 min-h-[48px] min-w-[48px] sm:inline-flex md:h-9 md:w-9 md:min-h-0 md:min-w-0 lg:hidden"
              aria-label={mobileFs ? t('settings.fullscreenExit') : t('settings.fullscreen')}
              aria-pressed={mobileFs}
              onClick={() => setMobileFullscreen(!mobileFs)}
            >
              {mobileFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-12 w-12 min-h-[48px] min-w-[48px] md:h-9 md:w-9 md:min-h-0 md:min-w-0"
              aria-label={t('nav.summaryOpen')}
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

      <CollabPanel
        open={collabPanelOpen}
        onClose={() => setCollabPanelOpen(false)}
        roomId={
          tab === 'journal'
            ? `journal:${journalPreview?.date ?? new Date().toISOString().slice(0, 10)}`
            : tab === 'docs' && focusDocId
              ? `doc:${focusDocId}`
              : activeTeamId
                ? `team:${activeTeamId}`
                : `tab:${tab}`
        }
        target={
          tab === 'journal'
            ? {
                kind: 'journal',
                id: journalPreview?.date ?? new Date().toISOString().slice(0, 10),
              }
            : tab === 'docs' && focusDocId
              ? { kind: 'doc', id: focusDocId }
              : null
        }
        tabLabel={tab}
      />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className={cn(
            'folio-main min-w-0 flex-1 outline-none px-3 pt-5 pb-28 sm:px-6 sm:pt-8 lg:pb-10',
            mobileFs && 'pt-2 pb-[env(safe-area-inset-bottom)] md:pt-7 md:pb-6',
          )}
        >
          <PwaInstallPrompt />

          <div ref={panelFocusRef} className="folio-tab-panel" key={tab}>
            <div ref={swipeRef} className="touch-pan-y">
            <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
              <TabsContent value="assistant" className="mt-0">
                <PersonalAssistantHome
                  onOpenJournal={(entryKey) => {
                    setFocusJournalDate(entryKey);
                    setJournalSubTab('journal-write');
                    handleTabChange('journal');
                  }}
                  onOpenDocs={(docId) => {
                    setFocusDocId(docId ?? null);
                    handleTabChange('docs');
                  }}
                  onOpenBoard={(taskId) => {
                    setFocusTaskId(taskId ?? null);
                    handleTabChange('board');
                  }}
                />
              </TabsContent>
              <TabsContent value="projects" className="mt-0">
                <ProjectHub
                  onOpenJournal={(entryKey) => {
                    setFocusJournalDate(entryKey);
                    setJournalSubTab('journal-write');
                    handleTabChange('journal');
                  }}
                  onOpenDoc={(docId) => {
                    setFocusDocId(docId);
                    handleTabChange('docs');
                  }}
                  onOpenTask={(taskId) => {
                    setFocusTaskId(taskId);
                    handleTabChange('board');
                  }}
                />
              </TabsContent>
              <TabsContent value="journal" className="mt-0">
                <Tabs
                  value={journalSubTab}
                  onValueChange={(v) => {
                    const next = v as 'journal-write' | 'journal-view';
                    setJournalSubTab(next);
                    window.history.replaceState(
                      null,
                      '',
                      `${window.location.pathname}${window.location.search}${buildFolioHash('journal', { journalSubTab: next })}`,
                    );
                  }}
                  className="w-full"
                >
                  <TabsList className="mb-3 h-auto gap-1 border-0 bg-transparent p-0">
                    <TabsTrigger
                      value="journal-write"
                      className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                    >
                      작성
                    </TabsTrigger>
                    <TabsTrigger
                      value="journal-view"
                      className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                    >
                      보기
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="journal-write" className="mt-0">
                    <JournalPanel
                      focusDate={focusJournalDate}
                      onFocusHandled={() => {
                        setFocusJournalDate(null);
                      }}
                      onDraftChange={handleDraftChange}
                      writingFirst
                    />
                  </TabsContent>
                  <TabsContent value="journal-view" className="mt-0">
                    <JournalBrowsePanel
                      focusDate={focusJournalDate}
                      focusFolder={focusJournalFolder}
                      onFocusHandled={() => {
                        setFocusJournalDate(null);
                        setFocusJournalFolder(null);
                      }}
                      onOpenWrite={(date, entryKey) => {
                        setFocusJournalDate(entryKey ?? date);
                        setJournalSubTab('journal-write');
                        window.history.replaceState(
                          null,
                          '',
                          `${window.location.pathname}${window.location.search}#journal/write`,
                        );
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </TabsContent>
              <TabsContent value="docs" className="mt-0">
                <DocsPanel
                  focusDocId={focusDocId}
                  onFocusHandled={() => setFocusDocId(null)}
                  onOpenJournal={(entryKey) => {
                    setFocusJournalDate(entryKey)
                    setJournalSubTab('journal-write')
                    handleTabChange('journal')
                  }}
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
                      {t('nav.board')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="board-analytics"
                      className="h-7 rounded-md px-2.5 text-[11px] data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800"
                    >
                      {t('nav.analytics')}
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
          </div>
        </main>

      </div>

      {/* 필요할 때만 여는 요약·도구 패널 */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal aria-label={t('nav.summary')}>
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t('common.close')}
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[75vh] flex-col rounded-t-2xl border border-gray-100 bg-background shadow-xl dark:border-gray-800 lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:max-h-none lg:w-[360px] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l">
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
              <span className="text-sm font-semibold">내 Folio</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label={t('common.close')}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-[min(60vh,calc(75vh-3.5rem))] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:h-[calc(100vh-3.5rem)]">
              <div className="pr-3">{sidebar}</div>
            </ScrollArea>
          </div>
        </div>
      )}

      <MobileNav
        value={tab}
        onChange={(v) => handleTabChange(v)}
        hidden={mobileFs}
        onWrite={() => {
          handleTabChange('journal');
          setFocusJournalDate(new Date().toISOString().slice(0, 10));
        }}
        onSave={() => dispatchMobileAction({ type: 'save' })}
        onNew={() => {
          if (tab === 'docs') {
            dispatchMobileAction({ type: 'new-doc' });
            return;
          }
          handleTabChange('journal');
          dispatchMobileAction({ type: 'new-journal' });
        }}
      />
      {mobileFs && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-[60] h-12 min-h-[48px] gap-1.5 rounded-full px-4 shadow-lg md:hidden"
          onClick={() => setMobileFullscreen(false)}
          aria-label={t('settings.fullscreenExit')}
        >
          <Minimize2 className="h-4 w-4" />
          {t('common.close')}
        </Button>
      )}
    </div>
      </PerfProfiler>
    </>
  );
}
