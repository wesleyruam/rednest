import { useEffect, useRef, useState } from 'react'
import {
  Play, Check, X, Search, Globe, Network, Server, Mail, AtSign, Shield, Database,
  User, GitBranch, Activity, ChevronRight, ChevronDown, Radio,
} from 'lucide-react'
import type { TimelineEvent } from '@/types'
import { listEngagementTimeline } from '@/services/coredata'

// mapeia o nome de ícone (vindo do backend) → componente lucide
const ICONS: Record<string, any> = {
  play: Play, check: Check, x: X, search: Search, globe: Globe, network: Network,
  server: Server, mail: Mail, 'at-sign': AtSign, shield: Shield, database: Database,
  user: User, correlation: GitBranch,
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  system: { label: 'Sistema', color: '#8a9cff' },
  discovery: { label: 'Descoberta', color: '#5ad1ff' },
  finding: { label: 'Achado', color: '#4dd4a4' },
  enrichment: { label: 'Enriquecimento', color: '#a9a4ee' },
  correlation: { label: 'Correlação', color: '#EF9F27' },
}

function iconFor(ev: TimelineEvent) {
  if (ev.icon && ICONS[ev.icon]) return ICONS[ev.icon]
  if (ev.type === 'engine_started') return Play
  if (ev.type === 'engine_finished') return Check
  if (ev.type === 'engine_failed') return X
  if (ev.type === 'correlation') return GitBranch
  if (ev.type === 'asset_found') return Search
  return Activity
}

function colorFor(ev: TimelineEvent) {
  if (ev.type === 'engine_failed') return 'var(--down)'
  if (ev.severity === 'critical' || ev.severity === 'high') return 'var(--down)'
  if (ev.severity === 'medium') return '#f4bc6a'
  const cat = ev.category ? CATEGORY_META[ev.category] : null
  return cat?.color ?? '#8a9cff'
}

const FILTERS = [
  { id: 'all', label: 'Tudo' },
  { id: 'discovery', label: 'Descoberta' },
  { id: 'finding', label: 'Achados' },
  { id: 'system', label: 'Sistema' },
]

function EventRow({ ev }: { ev: TimelineEvent }) {
  const [open, setOpen] = useState(false)
  const Icon = iconFor(ev)
  const color = colorFor(ev)
  const time = new Date(ev.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const hasDetails = ev.details && Object.keys(ev.details).length > 0
  const cat = ev.category ? CATEGORY_META[ev.category] : null

  return (
    <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
      {/* rail */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${color}1f`, border: `1px solid ${color}66`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={12} style={{ color }} />
        </div>
        <div style={{ flex: 1, width: 1, background: 'var(--line)', minHeight: 8 }} />
      </div>
      {/* content */}
      <div style={{ flex: 1, paddingBottom: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10.5, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>{time}</span>
          <span style={{ fontSize: 12.5, color: 'var(--htxt)', flex: 1, minWidth: 0 }}>{ev.title}</span>
          {hasDetails && (
            <button onClick={() => setOpen(v => !v)} className="hbtn" style={{ height: 18, padding: '0 4px', fontSize: 10 }}>
              {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
          {cat && <span className="tag" style={{ fontSize: 9, color: cat.color, borderColor: `${cat.color}55`, background: `${cat.color}14` }}>{cat.label}</span>}
          {ev.engine && <span style={{ fontSize: 9.5, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{ev.engine}</span>}
          {ev.description && !open && <span style={{ fontSize: 10.5, color: 'var(--txt-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {ev.description}</span>}
        </div>
        {open && hasDetails && (
          <pre style={{ marginTop: 6, padding: 8, background: 'rgba(255,255,255,.03)', border: '0.5px solid var(--line)', borderRadius: 6, fontSize: 10.5, color: 'var(--txt-2)', overflow: 'auto', maxHeight: 160, fontFamily: "'JetBrains Mono', monospace" }}>
            {JSON.stringify(ev.details, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

export function InvestigationTimeline({ engagementId }: { engagementId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [filter, setFilter] = useState('all')
  const [live, setLive] = useState(false)
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    seen.current = new Set()
    let active = true
    // Polling (evita conexão SSE permanente que esgota o pool HTTP do browser).
    const poll = async () => {
      try {
        const evs = await listEngagementTimeline(engagementId)
        if (!active) return
        const fresh = evs.some(e => !seen.current.has(e.id))
        evs.forEach(e => seen.current.add(e.id))
        setEvents(evs)
        setLive(fresh)
      } catch { /* ignora */ }
    }
    poll()
    const iv = setInterval(poll, 4000)
    return () => { active = false; clearInterval(iv) }
  }, [engagementId])

  const shown = events.filter(e => filter === 'all' || e.category === filter)

  return (
    <div className="block hot" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Activity size={12} /><span style={{ flex: 1 }}>Timeline da Investigação</span>
        {live && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--up)' }}><Radio size={11} /> ao vivo</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '8px 14px 0', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className="hbtn"
            style={{ fontSize: 10.5, height: 22, background: filter === f.id ? 'rgba(var(--accent-rgb),.2)' : undefined, borderColor: filter === f.id ? 'rgba(var(--accent-rgb),.5)' : undefined, color: filter === f.id ? 'var(--htxt)' : undefined }}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="bbody" style={{ maxHeight: 420, overflow: 'auto' }}>
        {shown.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 12, color: 'var(--txt-3)' }}>
            Sem eventos ainda. Rode o auto-enriquecimento para ver a investigação acontecer.
          </div>
        ) : shown.map(ev => <EventRow key={ev.id} ev={ev} />)}
      </div>
    </div>
  )
}
