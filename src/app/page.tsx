'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { JournalPanel } from '@/components/journal';
import { DocsPanel } from '@/components/docs';
import { BoardPanel } from '@/components/board';
import { createBrowserSupabaseClient, signOut } from '@/lib/supabase';

export default function Home() {
  const [email, setEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

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
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          setEmail(session?.user?.email ?? null);
          setAuthReady(true);
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
    } catch {
      setEmail(null);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col leading-none">
            <span
              className="relative inline-block text-[22px] font-bold tracking-[-0.07em] text-gray-900"
              style={{ fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif' }}
            >
              Folio
              <span
                aria-hidden
                className="absolute -right-2 top-0.5 h-1.5 w-1.5 rotate-45 rounded-[1px] bg-gray-900"
              />
            </span>
            <span className="mt-1 text-[10px] font-medium tracking-[0.18em] text-gray-400">
              project records
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:inline">프로젝트의 기록</span>
          {authReady && (
            email ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 max-w-[160px] truncate" title={email}>
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
                  'h-7 text-xs bg-gray-900 text-white hover:bg-gray-800',
                )}
              >
                로그인
              </Link>
            )
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Tabs defaultValue="journal" className="w-full">
          <TabsList className="bg-gray-50 border border-gray-100 p-1 rounded-xl mb-6 w-fit">
            <TabsTrigger value="journal" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              📓 일지
            </TabsTrigger>
            <TabsTrigger value="docs" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              📄 문서
            </TabsTrigger>
            <TabsTrigger value="board" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              📋 일정
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
        Folio · 브라우저에 저장되는 개인 워크스페이스
      </footer>
    </div>
  );
}
