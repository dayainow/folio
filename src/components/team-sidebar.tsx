'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Plus, Trash2, X } from 'lucide-react';
import { TeamInvite } from '@/components/team-invite';
import {
  createTeam,
  getActiveTeamId,
  listInvitations,
  listMembers,
  listTeams,
  removeMember,
  setActiveTeamId,
  type Invitation,
  type Team,
  type TeamMember,
  type TeamRole,
} from '@/lib/team';
import { getUser } from '@/lib/supabase';

interface TeamSidebarProps {
  open: boolean;
  onClose: () => void;
  activeTeamId: string | null;
  onActiveTeamChange: (teamId: string | null) => void;
}

function roleBadge(role: TeamRole) {
  const tone =
    role === 'owner'
      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
      : role === 'admin'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
  return <Badge className={`text-[10px] ${tone}`}>{role}</Badge>;
}

export function TeamSidebar({
  open,
  onClose,
  activeTeamId,
  onActiveTeamChange,
}: TeamSidebarProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [newName, setNewName] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myRole = members.find(m => m.userId === myId)?.role;
  const canInvite = myRole === 'owner' || myRole === 'admin';

  const refresh = useCallback(async (teamId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const user = await getUser();
      setMyId(user?.id ?? null);
      const nextTeams = await listTeams();
      setTeams(nextTeams);

      const preferred =
        teamId ??
        activeTeamId ??
        getActiveTeamId() ??
        nextTeams[0]?.id ??
        null;

      if (preferred && nextTeams.some(t => t.id === preferred)) {
        if (preferred !== activeTeamId) onActiveTeamChange(preferred);
        setActiveTeamId(preferred);
        const [nextMembers, nextInvites] = await Promise.all([
          listMembers(preferred),
          listInvitations(preferred).catch(() => [] as Invitation[]),
        ]);
        setMembers(nextMembers);
        setInvites(nextInvites);
      } else {
        setMembers([]);
        setInvites([]);
        if (!preferred) onActiveTeamChange(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '팀 정보를 불러오지 못했습니다.');
      setTeams([]);
      setMembers([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [activeTeamId, onActiveTeamChange]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const handleCreate = async () => {
    setError(null);
    try {
      const team = await createTeam(newName);
      setNewName('');
      onActiveTeamChange(team.id);
      setActiveTeamId(team.id);
      await refresh(team.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '팀 생성 실패');
    }
  };

  const handleSelect = async (teamId: string) => {
    onActiveTeamChange(teamId);
    setActiveTeamId(teamId);
    await refresh(teamId);
  };

  const handleRemove = async (userId: string) => {
    if (!activeTeamId) return;
    setError(null);
    try {
      await removeMember(activeTeamId, userId);
      await refresh(activeTeamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '멤버 제거 실패');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <Card className="relative z-10 h-full w-full max-w-md rounded-none border-l border-gray-100 dark:border-gray-800 shadow-xl bg-background flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold">팀 관리</h2>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">새 팀</h3>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="팀 이름"
                  className="h-8 text-xs"
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleCreate();
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={!newName.trim()}
                  onClick={() => void handleCreate()}
                >
                  <Plus className="h-3 w-3" />
                  생성
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">내 팀</h3>
              {loading && <p className="text-xs text-gray-400">불러오는 중…</p>}
              {!loading && teams.length === 0 && (
                <p className="text-xs text-gray-400">아직 팀이 없습니다. 생성하거나 초대를 수락하세요.</p>
              )}
              <div className="space-y-1">
                {teams.map(team => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => void handleSelect(team.id)}
                    className={[
                      'w-full text-left rounded-xl px-3 py-2 text-sm transition-colors',
                      activeTeamId === team.id
                        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-900',
                    ].join(' ')}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>

            {activeTeamId && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">멤버</h3>
                  <div className="space-y-1.5">
                    {members.map(m => (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-800 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-mono truncate text-gray-700 dark:text-gray-200">
                            {m.userId.slice(0, 8)}…
                          </div>
                          <div className="mt-0.5">{roleBadge(m.role)}</div>
                        </div>
                        {(canInvite || m.userId === myId) && m.role !== 'owner' && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-500"
                            onClick={() => void handleRemove(m.userId)}
                            aria-label="멤버 제거"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {invites.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">대기 중 초대</h3>
                    <div className="space-y-1">
                      {invites.map(inv => (
                        <div
                          key={inv.id}
                          className="rounded-lg bg-gray-50 dark:bg-gray-900 px-2.5 py-2 text-[11px]"
                        >
                          <div className="font-medium text-gray-700 dark:text-gray-200">{inv.email}</div>
                          <div className="text-gray-400 mt-0.5 truncate font-mono">{inv.token}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />
                <TeamInvite
                  teamId={activeTeamId}
                  canInvite={!!canInvite}
                  onAccepted={id => {
                    onActiveTeamChange(id);
                    void refresh(id);
                  }}
                  onInvited={() => void refresh(activeTeamId)}
                />
              </>
            )}

            {!activeTeamId && (
              <>
                <Separator />
                <TeamInvite
                  teamId={null}
                  canInvite={false}
                  onAccepted={id => {
                    onActiveTeamChange(id);
                    void refresh(id);
                  }}
                />
              </>
            )}

            {error && <p className="text-[11px] text-red-500">{error}</p>}
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Supabase에 <code className="font-mono">docs/supabase-schema-team.sql</code> 을
              적용해야 팀 기능을 사용할 수 있습니다.
            </p>
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
