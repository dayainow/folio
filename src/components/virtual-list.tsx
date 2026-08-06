/**
 * P66 — 긴 리스트 가상화 (react-window v2 List)
 */
'use client'

import { memo, useCallback, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import { List, type RowComponentProps } from 'react-window'
import { cn } from '@/lib/utils'

export type VirtualListProps<T> = {
  items: T[]
  height: number
  itemHeight: number
  /** 이 개수 미만이면 가상화 없이 전부 렌더 */
  threshold?: number
  className?: string
  overscanCount?: number
  getItemKey?: (item: T, index: number) => string | number
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode
  empty?: ReactNode
}

type RowData<T> = {
  items: T[]
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode
}

function VirtualRow<T>({
  index,
  style,
  items,
  renderItem,
}: RowComponentProps<RowData<T>>): ReactElement | null {
  const item = items[index]
  if (item === undefined) return null
  return <>{renderItem(item, index, style)}</>
}

function VirtualListInner<T>({
  items,
  height,
  itemHeight,
  threshold = 40,
  className,
  overscanCount = 6,
  getItemKey,
  renderItem,
  empty,
}: VirtualListProps<T>) {
  const rowProps: RowData<T> = { items, renderItem }

  const rowKey = useCallback(
    (index: number) => {
      const item = items[index]
      if (item !== undefined && getItemKey) return getItemKey(item, index)
      return index
    },
    [items, getItemKey],
  )

  if (items.length === 0) {
    return <>{empty ?? null}</>
  }

  if (items.length < threshold) {
    return (
      <div className={cn(className)} style={{ maxHeight: height, overflow: 'auto' }}>
        {items.map((item, index) => (
          <div key={getItemKey?.(item, index) ?? index}>
            {renderItem(item, index, { height: itemHeight })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <List
      className={cn(className)}
      style={{ height, width: '100%' }}
      rowCount={items.length}
      rowHeight={itemHeight}
      rowComponent={VirtualRow}
      rowProps={rowProps}
      rowKey={rowKey}
      overscanCount={overscanCount}
    />
  )
}

export const VirtualList = memo(VirtualListInner) as typeof VirtualListInner
