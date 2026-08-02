'use client'

/**
 * P42 — Web Speech API 음성 입력
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function subscribeSpeechSupport() {
  return () => undefined
}

export function VoiceInputButton({
  onTranscript,
  className,
  lang = 'ko-KR',
}: {
  onTranscript: (text: string) => void
  className?: string
  lang?: string
}) {
  const supported = useSyncExternalStore(
    subscribeSpeechSupport,
    () => Boolean(getSpeechRecognition()),
    () => false,
  )
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recogRef = useRef<SpeechRecognitionLike | null>(null)
  const onTranscriptRef = useRef(onTranscript)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  useEffect(() => {
    return () => {
      try {
        recogRef.current?.abort()
      } catch {
        /* ignore */
      }
    }
  }, [])

  if (!supported) return null

  const stop = () => {
    try {
      recogRef.current?.stop()
    } catch {
      /* ignore */
    }
    setListening(false)
  }

  const start = () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    setError(null)
    const recog = new Ctor()
    recog.lang = lang
    recog.continuous = true
    recog.interimResults = false
    recog.onresult = (ev) => {
      const parts: string[] = []
      for (let i = 0; i < ev.results.length; i++) {
        const row = ev.results[i]
        if (row?.isFinal && row[0]?.transcript) parts.push(row[0].transcript.trim())
      }
      const text = parts.join(' ').trim()
      if (text) onTranscriptRef.current(text)
    }
    recog.onerror = (ev) => {
      setError(ev.error === 'not-allowed' ? '마이크 권한이 필요합니다' : '음성 인식 오류')
      setListening(false)
    }
    recog.onend = () => setListening(false)
    recogRef.current = recog
    try {
      recog.start()
      setListening(true)
    } catch {
      setError('음성 인식을 시작할 수 없습니다')
      setListening(false)
    }
  }

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Button
        type="button"
        size="sm"
        variant={listening ? 'default' : 'outline'}
        className="h-9 min-h-[44px] gap-1.5 px-2.5 text-xs md:h-8 md:min-h-0"
        aria-pressed={listening}
        aria-label={listening ? '음성 입력 중지' : '음성 입력 시작'}
        title={error ?? (listening ? '듣는 중… 탭하여 중지' : '음성으로 일지 작성')}
        onClick={() => (listening ? stop() : start())}
      >
        {listening ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <MicOff className="h-3.5 w-3.5" aria-hidden />
          </>
        ) : (
          <Mic className="h-3.5 w-3.5" aria-hidden />
        )}
        <span className="hidden sm:inline">{listening ? '중지' : '음성'}</span>
      </Button>
    </div>
  )
}
