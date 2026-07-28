'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Ticket, Copy, Check } from 'lucide-react';
import {
  acceptInvite,
  inviteMember,
  type Invitation,
  type TeamRole,
} from '@/lib/team';

interface TeamInviteProps {
  teamId: string | null;
  canInvite?: boolean;
  onAccepted?: (teamId: string) => void;
  onInvited?: (invite: Invitation) => void;
}

export function TeamInvite({
  teamId,
  canInvite = false,
  onAccepted,
  onInvited,
}: TeamInviteProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<TeamRole, 'owner'>>('member');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invite = async () => {
    if (!teamId) {
      setError('팀을 먼저 선택하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const inv = await inviteMember(teamId, email, role);
      setLastToken(inv.token);
      setEmail('');
      setMessage(`${inv.email} 초대 생성됨 (토큰을 공유하세요)`);
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
      const joined = await acceptInvite(token);
      setToken('');
      setMessage('초대가 수락되었습니다.');
      onAccepted?.(joined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '수락 실패');
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async () => {
    if (!lastToken) return;
    try {
      await navigator.clipboard.writeText(lastToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="h-8 text-xs flex-1"
            />
            <select
              value={role}
              onChange={e => setRole(e.target.value as 'admin' | 'member')}
              className="h-8 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 bg-background"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
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
          {lastToken && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-900 px-2 py-1.5">
              <code className="text-[10px] flex-1 truncate text-gray-600 dark:text-gray-300">{lastToken}</code>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => void copyToken()}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
          <Ticket className="h-3.5 w-3.5" />
          초대 토큰 수락
        </div>
        <div className="flex gap-2">
          <Input
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="초대 토큰 붙여넣기"
            className="h-8 text-xs flex-1 font-mono"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy || !token.trim()}
            onClick={() => void accept()}
          >
            수락
          </Button>
        </div>
      </div>

      {message && (
        <p className="text-[11px] text-gray-500 flex items-center gap-1">
          <Badge variant="secondary" className="text-[10px]">OK</Badge>
          {message}
        </p>
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
