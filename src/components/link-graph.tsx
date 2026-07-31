'use client'

/**
 * 문서 wiki-link 네트워크 뷰 (P31) — react-force-graph-2d
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { type NodeObject } from 'react-force-graph-2d'
import {
  buildDocGraph,
  categoryColor,
  type DocRef,
} from '@/lib/link-parser'
import { Badge } from '@/components/ui/badge'
import { Network } from 'lucide-react'

type GraphNode = {
  id: string
  title: string
  category: string
  outDegree: number
  inDegree: number
  color?: string
  val?: number
  x?: number
  y?: number
}

type GraphLink = {
  source: string | GraphNode
  target: string | GraphNode
  label: string
}

export function LinkGraphPanel({
  docs,
  selectedId,
  onSelectDoc,
  compact = false,
}: {
  docs: DocRef[]
  selectedId?: string | null
  onSelectDoc: (docId: string) => void
  /** 하단 배치 시 고정 높이로 잘림 없이 표시 */
  compact?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // react-force-graph-2d 제네릭 ref 타입이 React 19 useRef와 맞지 않아 any 사용
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(undefined)
  const [size, setSize] = useState({ w: 260, h: compact ? 200 : 280 })

  const graph = useMemo(() => buildDocGraph(docs), [docs])

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = graph.nodes.map((n) => ({
      ...n,
      color: categoryColor(n.category),
      val: 1 + n.inDegree + n.outDegree,
    }))
    const links: GraphLink[] = graph.links.map((l) => ({
      source: l.source,
      target: l.target,
      label: l.label,
    }))
    return { nodes, links }
  }, [graph])

  const fitGraph = useCallback(() => {
    const fg = fgRef.current
    if (!fg || graphData.nodes.length === 0) return
    // 선택 포커스 중이면 전체 맞춤을 건너뜀
    if (selectedId) {
      const node = graphData.nodes.find((n) => n.id === selectedId)
      if (node?.x != null && node?.y != null) {
        fg.centerAt(node.x, node.y, 300)
        fg.zoom(2.2, 300)
        return
      }
    }
    // 패딩을 넉넉히 줘서 라벨이 잘리지 않게 중앙 맞춤
    fg.zoomToFit?.(400, compact ? 56 : 64)
  }, [compact, graphData.nodes, selectedId])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({
        w: Math.max(180, Math.floor(cr.width)),
        h: Math.max(compact ? 160 : 200, Math.floor(cr.height)),
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact])

  useEffect(() => {
    // canvas 리사이즈 후 노드가 잘리지 않도록 재맞춤
    const t = window.setTimeout(() => fitGraph(), 100)
    return () => window.clearTimeout(t)
  }, [size.w, size.h, fitGraph])

  const paintNode = useCallback(
    (node: NodeObject<GraphNode>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode
      const r = 4 + Math.min(6, (n.val ?? 1) * 0.8)
      const x = n.x ?? 0
      const y = n.y ?? 0
      const selected = n.id === selectedId

      ctx.beginPath()
      ctx.arc(x, y, r + (selected ? 2 : 0), 0, 2 * Math.PI)
      ctx.fillStyle = n.color ?? '#64748b'
      ctx.fill()
      if (selected) {
        ctx.strokeStyle = '#111827'
        ctx.lineWidth = 1.5 / globalScale
        ctx.stroke()
      }

      const label = n.title.length > 14 ? `${n.title.slice(0, 13)}…` : n.title
      const fontSize = Math.max(10 / globalScale, 2.5)
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#374151'
      ctx.fillText(label, x, y + r + 2)
    },
    [selectedId],
  )

  const categories = useMemo(() => {
    const set = new Set(docs.map((d) => d.category))
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [docs])

  return (
    <div
      className={
        compact
          ? 'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm'
          : 'flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm'
      }
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-50 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
          <Network className="h-4 w-4 text-gray-500" aria-hidden />
          링크 그래프
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Badge variant="secondary" className="text-[10px]">
            노드 {graph.nodeCount}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            엣지 {graph.edgeCount}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            평균 {graph.avgLinks}
          </Badge>
        </div>
      </div>

      {categories.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap gap-1.5 border-b border-gray-50 px-3 py-2"
          aria-label="카테고리 색상"
        >
          {categories.map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1 text-[10px] text-gray-600">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: categoryColor(cat) }}
                aria-hidden
              />
              {cat}
            </span>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className={
          compact
            ? 'relative min-h-0 flex-1 bg-gray-50/40'
            : 'relative min-h-[240px] flex-1 bg-gray-50/40'
        }
      >
        {graph.nodeCount === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-gray-400">
            문서가 없으면 그래프가 비어 있습니다
          </p>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={size.w}
            height={size.h}
            graphData={graphData}
            nodeId="id"
            linkSource="source"
            linkTarget="target"
            backgroundColor="rgba(0,0,0,0)"
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node, color, ctx) => {
              const n = node as GraphNode
              const r = 6 + Math.min(6, (n.val ?? 1) * 0.8)
              ctx.beginPath()
              ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI)
              ctx.fillStyle = color
              ctx.fill()
            }}
            linkColor={() => 'rgba(148,163,184,0.65)'}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            linkWidth={1}
            onNodeClick={(node) => {
              const id = (node as GraphNode).id
              if (id) onSelectDoc(id)
            }}
            onEngineStop={fitGraph}
            cooldownTicks={80}
            enableNodeDrag
            enableZoomInteraction
            enablePanInteraction
          />
        )}
      </div>

      <p className="shrink-0 border-t border-gray-50 px-3 py-2 text-[10px] text-gray-400">
        노드 클릭 → 문서 열기 · 드래그/줌 가능 · 본문에{' '}
        <code className="rounded bg-gray-100 px-1">[[문서명]]</code> 링크
      </p>
    </div>
  )
}
