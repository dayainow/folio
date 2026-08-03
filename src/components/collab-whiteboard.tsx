'use client'

/**
 * P48 — 간단한 실시간 화이트보드
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Pen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createCollabWsClient, type CollabWsClient } from '@/lib/collab-ws-client'
import { getCollabMode, getCollabWsUrl } from '@/lib/collab-mode'
import type { WhiteboardStroke } from '@/lib/collab-protocol'
import { cn } from '@/lib/utils'

export function CollabWhiteboard({
  roomId,
  userId,
  color = '#0d9488',
  className,
}: {
  roomId: string
  userId: string
  color?: string
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const pointsRef = useRef<Array<{ x: number; y: number }>>([])
  const clientRef = useRef<CollabWsClient | null>(null)
  const [status, setStatus] = useState(() => (getCollabMode() === 'local' ? 'local' : 'idle'))

  const drawStroke = useCallback((stroke: WhiteboardStroke) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx || stroke.points.length < 2) return
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y)
    for (let i = 1; i < stroke.points.length; i += 1) {
      ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y)
    }
    ctx.stroke()
  }, [])

  useEffect(() => {
    if (getCollabMode() === 'local') return
    const c = createCollabWsClient({
      roomId: `${roomId}:wb`,
      clientId: `${userId}-wb`,
      handlers: {
        onWhiteboard: drawStroke,
        onWhiteboardClear: () => {
          const canvas = canvasRef.current
          const ctx = canvas?.getContext('2d')
          if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        },
        onStatus: setStatus,
      },
      url: getCollabWsUrl(),
    })
    clientRef.current = c
    return () => c.destroy()
  }, [roomId, userId, drawStroke])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return (
    <div className={cn('rounded-xl border border-border', className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-medium">
        <Pen className="h-3.5 w-3.5" />
        화이트보드
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">{status}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-[10px]"
          onClick={() => {
            const canvas = canvasRef.current
            const ctx = canvas?.getContext('2d')
            if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
            clientRef.current?.clearWhiteboard()
          }}
        >
          <Eraser className="h-3 w-3" />
          지우기
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        width={480}
        height={240}
        className="w-full touch-none bg-muted/20"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          setDrawing(true)
          pointsRef.current = [pos(e)]
        }}
        onPointerMove={(e) => {
          if (!drawing) return
          pointsRef.current.push(pos(e))
          const pts = pointsRef.current
          if (pts.length < 2) return
          drawStroke({
            id: 'preview',
            userId,
            color,
            width: 2,
            points: pts.slice(-2),
            ts: new Date().toISOString(),
          })
        }}
        onPointerUp={() => {
          setDrawing(false)
          const pts = pointsRef.current
          if (pts.length < 2) return
          const stroke: WhiteboardStroke = {
            id: crypto.randomUUID(),
            userId,
            color,
            width: 2,
            points: pts,
            ts: new Date().toISOString(),
          }
          drawStroke(stroke)
          clientRef.current?.sendWhiteboard(stroke)
          pointsRef.current = []
        }}
      />
    </div>
  )
}
