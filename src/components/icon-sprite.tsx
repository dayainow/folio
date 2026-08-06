/**
 * P66 — SVG 스프라이트 아이콘 (lucide 외 UI 장식용)
 */
'use client'

import { cn } from '@/lib/utils'

export type SpriteIconName = 'folio-mark' | 'perf-gauge' | 'list-rows' | 'bundle'

type Props = {
  name: SpriteIconName
  className?: string
  title?: string
}

/**
 * `public/icons/sprite.svg` 심볼 참조
 */
export function SpriteIcon({ name, className, title }: Props) {
  return (
    <svg
      className={cn('inline-block size-4 shrink-0', className)}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <use href={`/icons/sprite.svg#${name}`} />
    </svg>
  )
}
