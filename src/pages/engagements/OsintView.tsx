import { useState, useRef, useMemo } from 'react'
import ReactFlow, {
  Background, Controls, BackgroundVariant,
  Handle, Position,
  getBezierPath,
  type Node, type Edge, type NodeTypes, type EdgeTypes, type EdgeProps,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, Maximize2 } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'
import type { Engagement } from '@/types'

// ─── Node metadata ──────────────────────────────────────────────────────────

const NODE_META: Record<string, { color: string; rgb: string; icon: string; label: string }> = {
  target:  { color: '#e24b4a', rgb: '226,75,74',   icon: '⊕', label: 'ALVO'    },
  email:   { color: '#EF9F27', rgb: '239,159,39',  icon: '✉', label: 'E-MAIL'  },
  ip:      { color: '#378ADD', rgb: '55,138,221',  icon: '⬡', label: 'IP'      },
  domain:  { color: '#1D9E75', rgb: '29,158,117',  icon: '◎', label: 'DOMÍNIO' },
  profile: { color: '#e879f9', rgb: '232,121,249', icon: '◉', label: 'PERFIL'  },
}
const PLATFORM_ICON: Record<string, string> = { instagram: '📷', telegram: '✈', twitter: '✕', facebook: '🌐' }
const DEFAULT_NODE = { color: '#7F77DD', rgb: '127,119,221', icon: '●', label: 'IOC' }

const GRAPH_FILTERS = ['Todos', 'Domínio', 'IP', 'E-mail', 'Perfil'] as const
const filterToType: Record<string, string> = { 'Domínio': 'domain', 'IP': 'ip', 'E-mail': 'email', 'Perfil': 'profile' }

// ─── Custom Node: Target ────────────────────────────────────────────────────

function OsintTargetNode({ data }: { data: { label: string } }) {
  return (
    <div className="map-osint-target">
      <div className="map-pulse-ring red" />
      <div className="map-pulse-ring red r2" />
      <Handle type="source" position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Left}   style={{ opacity: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 22, color: '#e24b4a', lineHeight: 1, marginBottom: 4 }}>⊕</div>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#e9e9f1', fontFamily: "'JetBrains Mono', monospace", maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.label}
        </div>
      </div>
    </div>
  )
}

// ─── Custom Node: IOC ───────────────────────────────────────────────────────

interface IocNodeData { label: string; type: string; platform?: string }

function OsintIocNode({ data }: { data: IocNodeData }) {
  const m = NODE_META[data.type] ?? DEFAULT_NODE
  const icon = data.platform ? (PLATFORM_ICON[data.platform] ?? m.icon) : m.icon

  return (
    <div
      className="map-ioc-node"
      style={{ borderColor: `rgba(${m.rgb},.35)`, minWidth: 100 }}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Right}  style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Top}    id="st" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} id="sb" style={{ opacity: 0, pointerEvents: 'none' }} />
      {/* Glow dot */}
      <span style={{ fontSize: 18, lineHeight: 1, marginBottom: 5, filter: `drop-shadow(0 0 6px ${m.color})` }}>{icon}</span>
      {/* Type label */}
      <div style={{ fontSize: 8, fontWeight: 700, color: m.color, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 }}>{m.label}</div>
      {/* Value */}
      <div style={{ fontSize: 9.5, fontWeight: 600, color: '#d8d8e8', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {data.label}
      </div>
      {/* Bottom glow bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: '0 0 10px 10px', background: `linear-gradient(90deg, transparent, ${m.color}88, transparent)` }} />
    </div>
  )
}

// ─── Custom Edge: Glow ──────────────────────────────────────────────────────

function OsintEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const isDirect = (data as { direct?: boolean })?.direct ?? true
  const baseColor = 'rgba(255,255,255,'
  const opacity = isDirect ? '.28)' : '.12)'

  return (
    <g>
      <path d={path} fill="none" stroke={`${baseColor}${isDirect ? '.08)' : '.04)'}`} strokeWidth={5} />
      <path d={path} fill="none" stroke={`${baseColor}${opacity}`}
        strokeWidth={isDirect ? 1.5 : 1}
        strokeDasharray={isDirect ? undefined : '5 8'}
        strokeLinecap="round"
        markerEnd={markerEnd}
      />
    </g>
  )
}

const osintNodeTypes: NodeTypes = { osintTarget: OsintTargetNode, osintIoc: OsintIocNode }
const osintEdgeTypes: EdgeTypes = { osintEdge: OsintEdge }

// ─── Node/Edge builders ─────────────────────────────────────────────────────

function buildOsintNodes(data: NonNullable<Engagement['osintData']>, filter: string): Node[] {
  const { nodes: rawNodes } = data
  const filterType = filter !== 'Todos' ? filterToType[filter] : null
  const visible = rawNodes.filter(n => n.type === 'target' || !filterType || n.type === filterType)
  const count = visible.length

  return visible.map((n, i) => {
    const isTarget = n.type === 'target'
    const angle = isTarget ? 0 : (i / Math.max(count - 1, 1)) * 2 * Math.PI
    const radius = count > 6 ? 220 : 185
    const x = isTarget ? -46 : radius * Math.cos(angle - Math.PI / 2) - 50
    const y = isTarget ? -46 : radius * Math.sin(angle - Math.PI / 2) - 32
    return {
      id: n.id,
      type: isTarget ? 'osintTarget' : 'osintIoc',
      position: { x, y },
      data: { label: n.label, type: n.type, platform: n.platform },
      draggable: true,
    }
  })
}

function buildOsintEdges(data: NonNullable<Engagement['osintData']>, _filter: string, nodes: Node[]): Edge[] {
  const nodeIds = new Set(nodes.map(n => n.id))
  return data.edges
    .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e, i) => ({
      id: `edge-${i}`, source: e.source, target: e.target,
      type: 'osintEdge',
      data: { direct: e.type === 'direct' },
      markerEnd: e.type === 'direct'
        ? { type: MarkerType.ArrowClosed, color: 'rgba(255,255,255,.28)', width: 10, height: 10 }
        : undefined,
    }))
}

function confidenceBadge(c: string) {
  const s = c === 'Alta' ? { color: '#4dd4a4', bg: 'rgba(29,158,117,.14)' } :
            c === 'Média' ? { color: '#f4bc6a', bg: 'rgba(239,159,39,.12)' } :
            { color: '#7ab8f0', bg: 'rgba(55,138,221,.12)' }
  return <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: s.bg, color: s.color }}>{c}</span>
}

interface OsintViewProps { engagement: Engagement }

export function OsintView({ engagement }: OsintViewProps) {
  const d = engagement.osintData!
  const { setEngagementTab } = useAppStore()
  const { toggleEngagementStatus, completedActions, toggleAction } = useDataStore()
  const { osintGraphFilter, setOsintGraphFilter, osintGraphExpanded, setOsintGraphExpanded, showToast } = useUIStore()

  const [filterDropOpen, setFilterDropOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [extraTags, setExtraTags] = useState<string[]>([])
  const filterBtnRef = useRef<HTMLButtonElement>(null)

  const status = engagement.status
  const doneActions = completedActions[engagement.id] ?? []

  const nodes = useMemo(() => buildOsintNodes(d, osintGraphFilter), [d, osintGraphFilter])
  const edges = useMemo(() => buildOsintEdges(d, osintGraphFilter, nodes), [d, osintGraphFilter, nodes])

  const allTags = [...d.tags, ...extraTags]

  function handleAddTag() {
    const t = newTag.trim()
    if (t && !allTags.includes(t)) {
      setExtraTags(prev => [...prev, t])
      setNewTag('')
    }
  }

  const graphEl = (
    <ReactFlow
      nodes={nodes} edges={edges}
      nodeTypes={osintNodeTypes}
      edgeTypes={osintEdgeTypes}
      fitView fitViewOptions={{ padding: 0.32 }}
      nodesDraggable nodesConnectable={false} proOptions={{ hideAttribution: true }}
      minZoom={0.25} maxZoom={2.5}
    >
      <Background variant={BackgroundVariant.Lines} gap={28} size={0.5} color="rgba(255,255,255,.025)" />
      <Controls showInteractive={false} style={{ background: '#0e0e14', border: '0.5px solid #1e1e28', borderRadius: 7 }} />
    </ReactFlow>
  )

  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--hbg)' }}>

      {/* Graph Expanded Overlay */}
      {osintGraphExpanded && (
        <>
          <div onClick={() => setOsintGraphExpanded(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', zIndex: 7000 }} />
          <div style={{ position: 'fixed', top: '5%', left: '5%', right: '5%', bottom: '5%', zIndex: 7001, background: '#0d0d13', border: '0.5px solid rgba(99,102,241,.3)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '0.5px solid #1e1e24', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e9e9f1', fontFamily: "'Space Grotesk', sans-serif" }}>Grafo de Relações — {engagement.name}</span>
              <button className="btn" style={{ padding: '4px 8px' }} onClick={() => setOsintGraphExpanded(false)}><X size={13} /></button>
            </div>
            <div style={{ flex: 1 }}>{graphEl}</div>
          </div>
        </>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {[
          { label: 'CONSULTAS REALIZADAS',    value: d.stats.queries,    trend: '+6 hoje',   color: 'var(--accent)' },
          { label: 'INDICADORES ENCONTRADOS', value: d.stats.indicators, trend: '+27',        color: 'var(--up)' },
          { label: 'DOMÍNIOS RELACIONADOS',   value: d.stats.domains,    trend: '+9',         color: 'var(--low)' },
          { label: 'E-MAILS IDENTIFICADOS',   value: d.stats.emails,     trend: '+4',         color: 'var(--med)' },
          { label: 'PERFIS SOCIAIS',          value: d.stats.profiles,   trend: '+8',         color: 'var(--high)' },
          { label: 'VAZAMENTOS ENCONTRADOS',  value: d.stats.leaks,      trend: '+3',         color: 'var(--crit)' },
        ].map(s => (
          <div key={s.label} className="block" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--txt-3)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginTop: 3 }}>{s.trend}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Graph + Indicators + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, minHeight: 340 }}>
        {/* Relation Graph */}
        <div className="block hot" style={{ position: 'relative' }}>
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">
            <span className="ic">◎</span>
            <span className="t">Grafo de Relações</span>
            <div className="meta" style={{ position: 'relative' }}>
              <button
                ref={filterBtnRef}
                className="hbtn"
                style={{ fontSize: 11 }}
                onClick={() => setFilterDropOpen(v => !v)}
              >
                Tipo: {osintGraphFilter} ▾
              </button>
              {filterDropOpen && (
                <>
                  <div onClick={() => setFilterDropOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 101, marginTop: 4, background: 'var(--panel)', border: '0.5px solid var(--line)', borderRadius: 6, overflow: 'hidden', minWidth: 120 }}>
                    {GRAPH_FILTERS.map(f => (
                      <button
                        key={f}
                        onClick={() => { setOsintGraphFilter(f); setFilterDropOpen(false) }}
                        style={{ display: 'block', width: '100%', padding: '7px 12px', background: osintGraphFilter === f ? 'rgba(99,102,241,.12)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: osintGraphFilter === f ? 'var(--accent)' : 'var(--htxt)', transition: 'background 0.1s' }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button className="hbtn" style={{ fontSize: 11 }} onClick={() => setOsintGraphExpanded(true)}>
                <Maximize2 size={11} /> Expandir
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>{graphEl}</div>
          <div style={{ display: 'flex', gap: 12, padding: '6px 14px', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
            {[['#1D9E75','domínio'],['#378ADD','ip'],['#EF9F27','e-mail'],['#e879f9','perfil']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-3)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />{l}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-3)' }}>
              <span style={{ width: 16, height: 1, background: 'rgba(255,255,255,.4)' }} /> direta
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt-3)' }}>
              <span style={{ width: 16, height: 1, borderTop: '1px dashed rgba(255,255,255,.25)' }} /> indireta
            </div>
          </div>
        </div>

        {/* Indicators */}
        <div className="block">
          <div className="bhead"><span className="t">Principais Indicadores</span></div>
          <div className="bbody" style={{ gap: 6, padding: '10px 0' }}>
            {d.indicators.map(ind => (
              <div key={ind.id} className="rowi" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>{ind.value}</div>
                  <span style={{ fontSize: 9.5, color: 'var(--txt-3)', textTransform: 'uppercase' }}>Confiança:</span>
                </div>
                {confidenceBadge(ind.confidence)}
              </div>
            ))}
            <button className="hbtn" style={{ margin: '6px 14px 0', width: 'calc(100% - 28px)', fontSize: 11 }}
              onClick={() => setEngagementTab('Indicadores')}>
              Ver todos indicadores →
            </button>
          </div>
        </div>

        {/* Activity */}
        <div className="block">
          <div className="bhead"><span className="t">Atividade Recente</span></div>
          <div style={{ padding: '6px 0' }}>
            {d.recentActivities.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 8, padding: '7px 12px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, color: 'var(--txt-3)', fontFamily: 'var(--font-mono)', flexShrink: 0, width: 30 }}>{a.time}</span>
                <span style={{ fontSize: 11, color: 'var(--txt-2)', flex: 1, lineHeight: 1.4 }}>{a.text}</span>
                <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: `${a.tagColor}18`, color: a.tagColor, border: `0.5px solid ${a.tagColor}44`, flexShrink: 0 }}>{a.tag}</span>
              </div>
            ))}
            <button className="hbtn" style={{ margin: '6px 12px 0', width: 'calc(100% - 24px)', fontSize: 11 }}
              onClick={() => setEngagementTab('Atividades')}>
              Ver todas atividades →
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Leaks + Domains + Profiles + Wordcloud */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        {/* Leaks */}
        <div className="block">
          <div className="bhead"><span className="t">Vazamentos Relacionados</span></div>
          <div style={{ padding: '6px 0' }}>
            {d.leaks.map(leak => (
              <div key={leak.id} style={{ display: 'flex', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(226,75,74,.12)', border: '0.5px solid rgba(226,75,74,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13 }}>📦</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--htxt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leak.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{leak.source} • {leak.date}</div>
                </div>
                <span className="sev crit" style={{ fontSize: 9.5 }}>{leak.hits} hits</span>
              </div>
            ))}
            <button className="hbtn" style={{ margin: '6px 14px 0', width: 'calc(100% - 28px)', fontSize: 11 }}
              onClick={() => setEngagementTab('Artefatos')}>
              Ver todos vazamentos →
            </button>
          </div>
        </div>

        {/* Domains */}
        <div className="block">
          <div className="bhead"><span className="t">Domínios Relacionados</span></div>
          <table className="data-table" style={{ fontSize: 11.5 }}>
            <tbody>
              {d.domains.map(dom => (
                <tr key={dom.id}>
                  <td style={{ color: 'var(--low)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{dom.domain}</td>
                  <td style={{ color: 'var(--txt-3)', fontSize: 10.5 }}>{dom.registeredAt}</td>
                  <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(29,158,117,.14)', color: '#4dd4a4', border: '0.5px solid rgba(29,158,117,.3)' }}>{dom.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="hbtn" style={{ margin: '6px 14px 8px', width: 'calc(100% - 28px)', fontSize: 11 }}
            onClick={() => setEngagementTab('Indicadores')}>
            Ver todos domínios →
          </button>
        </div>

        {/* Profiles */}
        <div className="block">
          <div className="bhead"><span className="t">Perfis Sociais Encontrados</span></div>
          <div style={{ padding: '4px 0' }}>
            {d.profiles.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 5, background: 'rgba(232,121,249,.1)', border: '0.5px solid rgba(232,121,249,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>
                    {p.network === 'Instagram' ? '📷' : p.network === 'Facebook' ? '🌐' : p.network.includes('Telegram') ? '✈' : '✕'}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace" }}>{p.handle}</div>
                    <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>{p.network}</div>
                  </div>
                </div>
                {confidenceBadge(p.relevance)}
              </div>
            ))}
            <button className="hbtn" style={{ margin: '6px 14px 4px', width: 'calc(100% - 28px)', fontSize: 11 }}
              onClick={() => setEngagementTab('Artefatos')}>
              Ver todos perfis →
            </button>
          </div>
        </div>

        {/* Wordcloud */}
        <div className="block">
          <div className="bhead"><span className="t">Nuvem de Palavras (Conteúdo)</span></div>
          <div className="bbody" style={{ justifyContent: 'center', alignItems: 'center', minHeight: 140 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', alignContent: 'center' }}>
              {d.wordcloud.map(w => (
                <span key={w.word} style={{
                  fontSize: 10 + w.weight * 1.8,
                  color: `hsl(${(w.word.charCodeAt(0) * 37) % 360}, 60%, 65%)`,
                  fontWeight: w.weight > 6 ? 700 : w.weight > 4 ? 600 : 400,
                  lineHeight: 1.2,
                }}>
                  {w.word}
                </span>
              ))}
            </div>
          </div>
          <button className="hbtn" style={{ margin: '0 14px 10px', width: 'calc(100% - 28px)', fontSize: 11 }}
            onClick={() => setEngagementTab('Mídia')}>
            Ver análise completa →
          </button>
        </div>
      </div>

      {/* Row 3: Tags + Status + Progress + Next Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 2fr', gap: 12 }}>
        {/* Tags */}
        <div className="block" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {allTags.map(t => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
              placeholder="Nova tag..."
              style={{ flex: 1, background: 'var(--hbg)', border: '0.5px solid var(--line)', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: 'var(--htxt)', outline: 'none' }}
            />
            <button className="hbtn" style={{ fontSize: 11, padding: '3px 9px' }} onClick={handleAddTag}>+</button>
          </div>
        </div>

        {/* Status */}
        <div className="block" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span className={`dot ${status === 'active' ? 'on' : 'off'}`} />
            <span style={{ color: status === 'active' ? 'var(--up)' : 'var(--med)', fontSize: 12, fontWeight: 500 }}>
              {status === 'active' ? 'Ativo' : 'Pausado'}
            </span>
          </div>
          <button
            className="hbtn"
            style={{ width: '100%', fontSize: 12 }}
            onClick={() => {
              toggleEngagementStatus(engagement.id)
              showToast(status === 'active' ? 'Engajamento pausado.' : 'Engajamento reativado.', 'info')
            }}
          >
            {status === 'active' ? 'Pausar' : 'Ativar'}
          </button>
        </div>

        {/* Progress */}
        <div className="block" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Progresso Geral</div>
          <div className="progress-bar" style={{ height: 7, marginBottom: 6 }}>
            <div className="progress-bar-fill" style={{ width: `${d.progress}%`, background: 'linear-gradient(90deg, var(--accent) 0%, rgba(99,102,241,.6) 100%)' }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--htxt)', fontFamily: "'Space Grotesk', sans-serif" }}>{d.progress}%</div>
        </div>

        {/* Next Actions */}
        <div className="block" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Próximas Ações</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {d.nextActions.map((a, i) => {
              const done = doneActions.includes(i)
              return (
                <button
                  key={a}
                  onClick={() => toggleAction(engagement.id, i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: done ? 'var(--txt-3)' : 'var(--txt-2)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                >
                  <span style={{
                    width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                    border: done ? 'none' : '1px solid var(--line-2)',
                    background: done ? 'var(--up)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {done && <span style={{ fontSize: 8, color: '#0d0d13', fontWeight: 700 }}>✓</span>}
                  </span>
                  <span style={{ textDecoration: done ? 'line-through' : 'none' }}>{a}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
