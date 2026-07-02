import { useMemo } from 'react'
import ReactFlow, {
  Background, BackgroundVariant, Controls,
  Handle, Position, MiniMap,
  getBezierPath,
  type Node, type Edge, type NodeTypes, type EdgeTypes, type EdgeProps,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Globe, Eye, Server, Share2, Database, User, Building2 } from 'lucide-react'
import type { Engagement } from '@/types'
import { useAppStore } from '@/store/app'

// ─── Type metadata ─────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; Icon: React.ElementType; color: string; rgb: string }> = {
  osint:          { label: 'OSINT',         Icon: Eye,       color: '#1D9E75', rgb: '29,158,117' },
  website:        { label: 'Web',           Icon: Globe,     color: '#5ad1ff', rgb: '90,209,255' },
  domain:         { label: 'Domínio',       Icon: Globe,     color: '#378ADD', rgb: '55,138,221' },
  infrastructure: { label: 'Infra',         Icon: Server,    color: '#8a9cff', rgb: '138,156,255' },
  organization:   { label: 'Organização',   Icon: Building2, color: '#EF9F27', rgb: '239,159,39'  },
  person:         { label: 'Pessoa',        Icon: User,      color: '#e879f9', rgb: '232,121,249' },
  social_profile: { label: 'Social',        Icon: Share2,    color: '#e879f9', rgb: '232,121,249' },
  leak:           { label: 'Vazamento',     Icon: Database,  color: '#e24b4a', rgb: '226,75,74'   },
}
const DEFAULT_META = { label: 'Engajamento', Icon: Globe, color: '#7F77DD', rgb: '127,119,221' }

// ─── Custom Nodes ──────────────────────────────────────────────────────────

function CenterNodeComp({ data }: { data: { label: string } }) {
  return (
    <div className="map-center-node">
      <div className="map-pulse-ring" />
      <div className="map-pulse-ring r2" />
      <div className="map-pulse-ring r3" />
      <Handle type="source" position={Position.Top}    id="t" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Right}  id="r" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Left}   id="l" style={{ opacity: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', userSelect: 'none' }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(127,119,221,.75)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 5 }}>OPERAÇÃO</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e9e9f1', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.3, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.label}
        </div>
      </div>
    </div>
  )
}

interface EngNodeData {
  name: string; target: string; type: string; status: string
}
function EngNodeComp({ data }: { data: EngNodeData }) {
  const m = TYPE_META[data.type] ?? DEFAULT_META
  const isActive = data.status === 'active'
  const shortName = data.name.includes('—') ? data.name.split('—')[1]?.trim() : data.name
  return (
    <div
      className="map-eng-node"
      style={{ '--ec': m.color, borderLeftColor: m.color, borderColor: `rgba(${m.rgb},.22)` } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Right}  style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <m.Icon size={11} style={{ color: m.color, flexShrink: 0 }} />
          <span style={{ fontSize: 8.5, fontWeight: 700, color: m.color, textTransform: 'uppercase', letterSpacing: '.1em' }}>{m.label}</span>
        </div>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: isActive ? '#34d27b' : '#e0b341',
          boxShadow: `0 0 6px ${isActive ? '#34d27b88' : '#e0b34188'}`,
        }} />
      </div>

      {/* Name */}
      <div style={{
        fontSize: 11.5, fontWeight: 600, color: '#dcdce8', lineHeight: 1.35,
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        marginBottom: 5,
      }}>
        {shortName}
      </div>

      {/* Target */}
      <div style={{
        fontSize: 9.5, color: 'rgba(136,136,148,.7)', fontFamily: "'JetBrains Mono', monospace",
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        borderTop: '0.5px solid rgba(255,255,255,.06)', paddingTop: 5,
      }}>
        {data.target}
      </div>
    </div>
  )
}

// ─── Custom Edges ──────────────────────────────────────────────────────────

function GlowEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const color = (data as { color?: string })?.color ?? 'rgba(127,119,221,.5)'

  return (
    <g>
      {/* Glow blur */}
      <path d={path} fill="none" stroke={color} strokeWidth={6} strokeOpacity={0.12} />
      {/* Main stroke */}
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.5} markerEnd={markerEnd} strokeLinecap="round" />
    </g>
  )
}

function AnimatedEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const color = (data as { color?: string })?.color ?? 'rgba(127,119,221,.5)'

  return (
    <g>
      {/* Glow */}
      <path d={path} fill="none" stroke={color} strokeWidth={5} strokeOpacity={0.1} />
      {/* Base */}
      <path d={path} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.3} />
      {/* Animated dash */}
      <path
        d={path} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.7}
        strokeLinecap="round"
        strokeDasharray="6 10"
        markerEnd={markerEnd}
        style={{ animation: 'map-edge-flow 1.4s linear infinite' }}
      />
    </g>
  )
}

const nodeTypes: NodeTypes = { centerNode: CenterNodeComp, engNode: EngNodeComp }
const edgeTypes: EdgeTypes = { glow: GlowEdge, animated: AnimatedEdge }

// ─── Layout ────────────────────────────────────────────────────────────────

function buildNodes(engagements: Engagement[], opName: string): Node[] {
  const nodes: Node[] = [{
    id: 'op-center', type: 'centerNode',
    position: { x: -52, y: -52 },
    data: { label: opName },
    draggable: true,
  }]

  const count = engagements.length
  const radius = Math.max(200, count * 42)

  engagements.forEach((eng, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2
    const x = radius * Math.cos(angle) - 76
    const y = radius * Math.sin(angle) - 45
    nodes.push({
      id: eng.id, type: 'engNode',
      position: { x, y },
      data: { name: eng.name, target: eng.target, type: eng.type, status: eng.status },
      draggable: true,
    })
  })

  return nodes
}

function buildEdges(engagements: Engagement[]): Edge[] {
  return engagements.map((eng, i) => {
    const m = TYPE_META[eng.type] ?? DEFAULT_META
    const isAnimated = i % 3 === 0
    return {
      id: `e-${eng.id}`,
      source: 'op-center',
      target: eng.id,
      type: isAnimated ? 'animated' : 'glow',
      data: { color: `${m.color}bb` },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: `${m.color}99`,
        width: 11, height: 11,
      },
    }
  })
}

// ─── Component ─────────────────────────────────────────────────────────────

interface EngagementMapProps {
  engagements: Engagement[]
  opName: string
}

export function EngagementMap({ engagements, opName }: EngagementMapProps) {
  const { openEngagement } = useAppStore()
  const nodes = useMemo(() => buildNodes(engagements, opName), [engagements, opName])
  const edges = useMemo(() => buildEdges(engagements), [engagements])

  return (
    <div style={{ width: '100%', height: '100%', background: '#060609', borderRadius: 8, overflow: 'hidden' }}>
      {/* Extra CSS for edge animation (can't use class on SVG path directly) */}
      <style>{`@keyframes map-edge-flow { to { stroke-dashoffset: -32; } }`}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.25}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          if (node.id !== 'op-center') openEngagement(node.id)
        }}
      >
        <Background variant={BackgroundVariant.Lines} gap={28} size={0.5} color="rgba(255,255,255,.025)" />
        <Controls
          showInteractive={false}
          style={{ background: '#0e0e14', border: '0.5px solid #1e1e28', borderRadius: 7 }}
        />
        {engagements.length > 4 && (
          <MiniMap
            nodeColor={(n) => {
              if (n.id === 'op-center') return '#7F77DD'
              const type = (n.data as EngNodeData).type
              return TYPE_META[type]?.color ?? '#888'
            }}
            style={{ background: '#08080f', border: '0.5px solid #1e1e24', borderRadius: 6 }}
            maskColor="rgba(0,0,0,.6)"
            nodeStrokeWidth={0}
          />
        )}
      </ReactFlow>
    </div>
  )
}
