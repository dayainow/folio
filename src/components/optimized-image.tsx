'use client'

/**
 * P50/P57 — next/image 래퍼 (lazy · async · 페이드인)
 */
import { useState } from 'react'
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
  const [loaded, setLoaded] = useState(false)
  if (!src) return null

  const fade = cn(
    'h-auto max-w-full rounded-lg transition-opacity duration-300',
    loaded ? 'opacity-100' : 'opacity-0',
    className,
  )

  if (!isOptimizableSrc(src) || src.startsWith('http')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 외부/data URL
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        className={fade}
        onLoad={() => setLoaded(true)}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={typeof width === 'number' ? width : 800}
      height={typeof height === 'number' ? height : 450}
      className={fade}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 800px"
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      {...rest}
    />
  )
}
