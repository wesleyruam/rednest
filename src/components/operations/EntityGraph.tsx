import { useEffect, useMemo, useState } from 'react'
import ReactFlow, { Background, BackgroundVariant, Controls, MarkerType, type Node, type Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import { Loader2 } from 'lucide-react'
import { getEntityGraph, type EntityGraph as EG } from '@/services/entities'

const COLOR: Record<string, string> = {
  domain: '#378ADD', subdomain: '#5ad1ff', host: '#8a9cff', ip: '#8a9cff',
  email: '#5ad1ff', username: '#EF9F27', profile: '#e879f9', service: '#8a9cff',
  root: '#7F77DD',
}

/** Calcula a profundidade de cada nó seguindo source→target (target = mais próximo da raiz). */
function layout(g: EG): { nodes: Node[]; edges: Edge[] } {
  const parent = new Map<string, string>()
  for (const e of g.edges) if (!parent.has(e.source)) parent.set(e.source, e.target)

  const depthCache = new Map<string, number>()
  const depth = (id: string, seen = new Set<string>()): number => {
    if (depthCache.has(id)) return depthCache.get(id)!
    const p = parent.get(id)
    if (!p || seen.has(id)) { depthCache.set(id, 0); return 0 }
    seen.add(id)
    const d = 1 + depth(p, seen)
    depthCache.set(id, d)
    return d
  }

  const byDepth = new Map<number, string[]>()
  for (const n of g.nodes) {
    const d = depth(n.id)
    if (!byDepth.has(d)) byDepth.set(d, [])
    byDepth.get(d)!.push(n.id)
  }

  const pos = new Map<string, { x: number; y: number }>()
  for (const [d, ids] of byDepth) ids.forEach((id, i) => pos.set(id, { x: d * 260, y: i * 64 }))

  const nodes: Node[] = g.nodes.map((n) => {
    const c = COLOR[n.type] ?? '#888'
    const danger = n.severity === 'high' || n.severity === 'critical'
    return {
      id: n.id,
      position: pos.get(n.id) ?? { x: 0, y: 0 },
      data: { label: `${n.label}` },
      style: {
        background: 'var(--bg-elevated)', color: '#e9e9f1', border: `1px solid ${danger ? '#e24b4a' : c + '88'}`,
        borderRadius: 7, fontSize: 10.5, padding: '6px 9px', width: 200, fontFamily: "'JetBrains Mono', monospace",
        boxShadow: danger ? '0 0 10px rgba(226,75,74,.4)' : undefined,
      },
    }
  })
  const edges: Edge[] = g.edges.map((e, i) => ({
    id: `e${i}`, source: e.source, target: e.target, type: 'smoothstep',
    style: { stroke: 'rgba(127,119,221,.4)' }, markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(127,119,221,.5)' },
  }))
  return { nodes, edges }
}

export function EntityGraph({ operationId }: { operationId: string }) {
  const [g, setG] = useState<EG | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    getEntityGraph(operationId).then(setG).catch(() => setG(null)).finally(() => setLoading(false))
  }, [operationId])

  const flow = useMemo(() => (g ? layout(g) : { nodes: [], edges: [] }), [g])

  if (loading) return <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></div>
  if (!g || g.nodes.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
      Sem entidades estruturais para grafar ainda. Rode subdomínios / service scan / username intelligence.
    </div>
  )

  return (
    <div style={{ height: 540, background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: 8 }}>
      <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView minZoom={0.2} proOptions={{ hideAttribution: true }} nodesDraggable nodesConnectable={false}>
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgba(255,255,255,.06)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
