'use client';

import { useMemo } from 'react';

export interface TagCount {
  tag: string;
  count: number;
}

interface TagCloudProps {
  tags: TagCount[];
  selected?: string | null;
  onSelect: (tag: string | null) => void;
  emptyLabel?: string;
  className?: string;
}

/** 빈도 기반 폰트 크기 / 색상 */
function styleForCount(count: number, max: number): { fontSize: string; className: string } {
  const ratio = max <= 1 ? 1 : count / max;
  const fontSize =
    ratio >= 0.75 ? '1.05rem' : ratio >= 0.5 ? '0.95rem' : ratio >= 0.3 ? '0.85rem' : '0.75rem';
  const className =
    ratio >= 0.75
      ? 'text-gray-900 dark:text-gray-100 font-semibold'
      : ratio >= 0.5
        ? 'text-gray-700 dark:text-gray-200 font-medium'
        : ratio >= 0.3
          ? 'text-gray-600 dark:text-gray-300'
          : 'text-gray-500 dark:text-gray-400';
  return { fontSize, className };
}

export function buildTagCounts(
  sources: Array<{ tags?: string[] | null }>,
): TagCount[] {
  const map = new Map<string, number>();
  for (const item of sources) {
    for (const raw of item.tags ?? []) {
      const tag = raw.trim();
      if (!tag) continue;
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ko'));
}

export function TagCloud({
  tags,
  selected = null,
  onSelect,
  emptyLabel = '아직 태그 없음',
  className = '',
}: TagCloudProps) {
  const max = useMemo(() => Math.max(1, ...tags.map(t => t.count)), [tags]);

  if (tags.length === 0) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">{emptyLabel}</span>;
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 ${className}`}>
      {tags.map(({ tag, count }) => {
        const active = selected === tag;
        const { fontSize, className: tone } = styleForCount(count, max);
        return (
          <button
            key={tag}
            type="button"
            title={`${count}회`}
            onClick={() => onSelect(active ? null : tag)}
            style={{ fontSize }}
            className={[
              'rounded-md px-1.5 py-0.5 transition-colors leading-tight',
              active
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : `${tone} hover:bg-gray-100 dark:hover:bg-gray-800`,
            ].join(' ')}
          >
            #{tag}
            <span className="ml-1 text-[10px] opacity-60 tabular-nums">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
