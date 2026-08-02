'use client'

/**
 * P42 — 모바일 사진/이미지 첨부 (Markdown data URL 또는 링크)
 * 큰 이미지는 리사이즈 후 Base64로 본문에 삽입 (오프라인 친화)
 */
import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fileToMarkdownImage } from '@/lib/mobile-media'

export function ImageAttachButton({
  onInsert,
  className,
}: {
  onInsert: (markdown: string) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          setMsg(null)
          void fileToMarkdownImage(file)
            .then((md) => {
              onInsert(md)
              setMsg('이미지 첨부됨')
              window.setTimeout(() => setMsg(null), 2000)
            })
            .catch((err) => {
              setMsg(err instanceof Error ? err.message : '첨부 실패')
            })
            .finally(() => setBusy(false))
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 min-h-[44px] gap-1.5 px-2.5 text-xs md:h-8 md:min-h-0"
        disabled={busy}
        aria-label="사진·이미지 첨부"
        title={msg ?? '사진 또는 갤러리 이미지 첨부'}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" aria-hidden />
        )}
        <span className="hidden sm:inline">사진</span>
      </Button>
    </div>
  )
}
