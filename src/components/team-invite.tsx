'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Ticket, Copy, Check, Link2 } from 'lucide-react';
import {
  acceptInvite,
  inviteMember,
  isInviteExpired,
  type Invitation,
  type TeamRole,
} from '@/lib/team';
import { notifyTeamInviteCreated } from '@/lib/collab-notify';

interface TeamInviteProps {
  teamId: string | null;
  canInvite?: boolean;
  onAccepted?: (teamId: string) => void;
  onInvited?: (invite: Invitation) => void;
}

type InviteRole = 'admin' | 'editor' | 'viewer' | 'guest' | 'member';

export function TeamInvite({
  teamId,
  canInvite = false,
  onAccepted,
  onInvited,
}: TeamInviteProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('editor');
  const [expiresDays, setExpiresDays] = useState(7);
  const [inviteNote, setInviteNote] = useState('');
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return new URLSearchParams(window.location.search).get('invite') ?? '';
    } catch {
      return '';
    }
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState<'token' | 'link' | null>(null);

  const invite = async () => {
    if (!teamId) {
      setError('팀을 먼저 선택하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const inv = await inviteMember(teamId, email, role as Exclude<TeamRole, 'owner'>, expiresDays);
      setLastInvite(inv);
      setEmail('');
      const { saveInviteLinkMeta, buildCustomInviteLink } = await import('@/lib/invite-link');
      saveInviteLinkMeta({
        token: inv.token,
        note: inviteNote || undefined,
        maxUses: maxUses === '' ? undefined : Number(maxUses),
      });
      const link = buildCustomInviteLink(inv.token, { note: inviteNote || undefined });
      const expiredHint = isInviteExpired(inv) ? ' (이미 만료)' : '';
      setMessage(`${inv.email} 초대 생성 · 만료 ${new Date(inv.expiresAt).toLocaleString('ko-KR')}${expiredHint}`);
      void notifyTeamInviteCreated({
        email: inv.email,
        role: inv.role,
        inviteLink: link,
        expiresAt: inv.expiresAt,
      });
      onInvited?.(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대 실패');
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { canUseInviteLink, recordInviteLinkUse } = await import('@/lib/invite-link');
      const gate = canUseInviteLink(token.trim());
      if (!gate.ok) throw new Error(gate.reason ?? '초대 링크를 사용할 수 없습니다.');
      const joined = await acceptInvite(token);
      recordInviteLinkUse(token.trim());
      setToken('');
      setMessage('초대가 수락되었습니다.');
      onAccepted?.(joined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '수락 실패');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (kind: 'token' | 'link') => {
    if (!lastInvite) return;
    const { buildCustomInviteLink } = await import('@/lib/invite-link');
    const text =
      kind === 'link'
        ? buildCustomInviteLink(lastInvite.token, { note: inviteNote || undefined })
        : lastInvite.token;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      {canInvite && teamId && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            <Mail className="h-3.5 w-3.5" />
            멤버 초대
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="h-8 text-xs flex-1 min-w-[10rem]"
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value as InviteRole)}
              className="h-8 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 bg-background"
              aria-label="역할"
            >
              <option value="guest">guest</option>
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
              <option value="admin">admin</option>
            </select>
            <select
              value={expiresDays}
              onChange={e => setExpiresDays(Number(e.target.value))}
              className="h-8 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 bg-background"
              aria-label="초대 만료"
            >
              <option value={1}>1일</option>
              <option value={3}>3일</option>
              <option value={7}>7일</option>
              <option value={14}>14일</option>
              <option value={30}>30일</option>
            </select>
            <Input
              value={inviteNote}
              onChange={(e) => setInviteNote(e.target.value)}
              placeholder="초대 메모 (링크에 포함)"
              className="h-8 text-xs flex-1 min-w-[10rem]"
              aria-label="초대 메모"
            />
            <Input
              type="number"
              min={1}
              max={100}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="최대 사용(선택)"
              className="h-8 w-28 text-xs"
              aria-label="최대 사용 횟수"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={busy || !email.trim()}
              onClick={() => void invite()}
            >
              초대
            </Button>
          </div>
          {lastInvite && (
            <div className="space-y-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[9px]">
                  {lastInvite.role}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  만료 {new Date(lastInvite.expiresAt).toLocaleString('ko-KR')}
                  {isInviteExpired(lastInvite) ? ' · 만료됨' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-[10px] flex-1 truncate text-gray-600 dark:text-gray-300">
                  {lastInvite.token}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => void copy('token')}
                  aria-label="토큰 복사"
                >
                  {copied === 'token' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => void copy('link')}
                  aria-label="초대 링크 복사"
                >
                  {copied === 'link' ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
          <Ticket className="h-3.5 w-3.5" />
          초대 토큰 / 링크 수락
        </div>
        <div className="flex gap-2">
          <Input
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="초대 토큰 또는 링크의 토큰"
            className="h-8 text-xs flex-1 font-mono"
          />
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={busy || !token.trim()}
            onClick={() => void accept()}
          >
            수락
          </Button>
        </div>
      </div>

      {message && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
