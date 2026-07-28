'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users, ChevronDown } from 'lucide-react';
import {
  getActiveTeamId,
  listTeams,
  setActiveTeamId,
  type Team,
} from '@/lib/team';

interface TeamSwitcherProps {
  activeTeamId: string | null;
  onActiveTeamChange: (teamId: string | null) => void;
  onOpenManage: () => void;
  enabled?: boolean;
}

export function TeamSwitcher({
  activeTeamId,
  onActiveTeamChange,
  onOpenManage,
  enabled = true,
}: TeamSwitcherProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setTeams([]);
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const next = await listTeams();
        if (cancelled) return;
        setTeams(next);
        const stored = getActiveTeamId();
        if (stored && next.some(t => t.id === stored)) {
          onActiveTeamChange(stored);
        } else if (next[0]) {
          onActiveTeamChange(next[0].id);
          setActiveTeamId(next[0].id);
        }
      } catch {
        if (!cancelled) setTeams([]);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // mount / login only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) return null;

  const active = teams.find(t => t.id === activeTeamId);

  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-xs max-w-[180px]"
        onClick={() => setOpen(v => !v)}
        disabled={!ready}
      >
        <Users className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{active?.name ?? (teams.length ? '팀 선택' : '팀')}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] rounded-xl border border-gray-100 dark:border-gray-800 bg-background shadow-lg py-1">
            {teams.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-gray-400">팀이 없습니다</p>
            )}
            {teams.map(team => (
              <button
                key={team.id}
                type="button"
                className={[
                  'w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-900',
                  team.id === activeTeamId ? 'font-semibold text-foreground' : 'text-gray-600 dark:text-gray-300',
                ].join(' ')}
                onClick={() => {
                  onActiveTeamChange(team.id);
                  setActiveTeamId(team.id);
                  setOpen(false);
                }}
              >
                {team.name}
              </button>
            ))}
            <div className="border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900"
                onClick={() => {
                  setOpen(false);
                  onOpenManage();
                }}
              >
                팀 관리…
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
