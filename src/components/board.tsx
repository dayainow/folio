'use client';

import dynamic from 'next/dynamic';
import { memo } from 'react';

const BoardDndPanel = dynamic(
  () => import('@/components/board-dnd').then((m) => ({ default: m.BoardDndPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="py-16 text-center text-sm text-muted-foreground">일정 로딩 중…</div>
    ),
  },
);

/** Board 탭 — @dnd-kit 은 board-dnd 청크로 lazy 로드 */
export const BoardPanel = memo(function BoardPanel({
  focusTaskId,
  onFocusHandled,
}: {
  focusTaskId?: string | null;
  onFocusHandled?: () => void;
} = {}) {
  return <BoardDndPanel focusTaskId={focusTaskId} onFocusHandled={onFocusHandled} />;
});
