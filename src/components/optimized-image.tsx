'use client'

/**
 * P50 — next/image 래퍼 (자동 최적화 · 외부/data URL 폴백)
 */
import Image, { type ImageProps } from 'next/image'
import { cn } from '@/lib/utils'

function isOptimizableSrc(src: string): boolean {
  if (src.startsWith('data:') || src.startsWith('blob:')) return false
  if (src.startsWith('/')) return true
  try {
    const u = new URL(src)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export type OptimizedImageProps = Omit<ImageProps, 'src' | 'alt'> & {
  src?: string | null
  alt?: string
  className?: string
}

/**
 * 로컬·상대 경로는 next/image, data/blob·최적화 불가 URL은 lazy img
 */
export function OptimizedImage({
  src,
  alt = '',
  className,
  width = 800,
  height = 450,
  ...rest
}: OptimizedImageProps) {
  if (!src) return null

  if (!isOptimizableSrc(src) || src.startsWith('http')) {
    // 마크다운 외부 URL은 remotePatterns 없이 img (lazy)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 외부/data URL
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn('h-auto max-w-full rounded-lg', className)}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={typeof width === 'number' ? width : 800}
      height={typeof height === 'number' ? height : 450}
      className={cn('h-auto max-w-full rounded-lg', className)}
      sizes="(max-width: 768px) 100vw, 800px"
      {...rest}
    />
  )
}
