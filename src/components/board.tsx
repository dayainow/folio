'use client';

import { memo } from 'react';
import { BoardDndPanel } from '@/components/board-dnd';

/** Board 탭 — DnD 패널 직접 연결 (이중 dynamic 제거로 클릭/상태 갱신 안정화) */
export const BoardPanel = memo(function BoardPanel({
  focusTaskId,
  onFocusHandled,
}: {
  focusTaskId?: string | null;
  onFocusHandled?: () => void;
} = {}) {
  return <BoardDndPanel focusTaskId={focusTaskId} onFocusHandled={onFocusHandled} />;
});
