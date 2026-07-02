import { useState, useMemo, useEffect } from 'react'
import {
  ShieldAlert, Database, Globe, User, AlertTriangle,
  FileText, Plus, Bell, Filter, X, Play, Check, Search, GitBranch, type LucideIcon,
} from 'lucide-react'
import { listTimeline } from '@/services/coredata'
import { useDataStore } from '@/store/data'
import type { TimelineEvent, EventType, IOCThreatLevel } from '@/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const EVENT_META: Record<EventType, {
  label: string; Icon: LucideIcon
  color: string; bg: string
}> = {
  alert_triggered:    { label: 'Alerta',         Icon: Bell,          color: '#f0476a', bg: 'rgba(240,71,106,.12)'  },
  ioc_added:          { label: 'IOC',             Icon: ShieldAlert,   color: '#a09ae8', bg: 'rgba(127,119,221,.12)' },
  evidence_collected: { label: 'Evidência',       Icon: Database,      color: '#5ad1ff', bg: 'rgba(90,209,255,.12)'  },
  domain_found:       { label: 'Domínio',         Icon: Globe,         color: '#EF9F27', bg: 'rgba(239,159,39,.12)'  },
  profile_found:      { label: 'Perfil',          Icon: User,          color: '#e879f9', bg: 'rgba(232,121,249,.12)' },
  leak_found:         { label: 'Vazamento',       Icon: AlertTriangle, color: '#f0476a', bg: 'rgba(240,71,106,.12)'  },
  monitoring_alert:   { label: 'Monitoramento',   Icon: Bell,          color: '#fb923c', bg: 'rgba(251,146,60,.12)'  },
  operation_created:  { label: 'Operação',        Icon: Plus,          color: '#34d27b', bg: 'rgba(29,158,117,.12)'  },
  engagement_created: { label: 'Engajamento',     Icon: Plus,          color: '#34d27b', bg: 'rgba(29,158,117,.12)'  },
  note_added:         { label: 'Nota',            Icon: FileText,      color: '#888',    bg: 'rgba(255,255,255,.06)' },
  engine_started:     { label: 'Engine',          Icon: Play,          color: '#8a9cff', bg: 'rgba(138,156,255,.12)' },
  engine_finished:    { label: 'Concluído',       Icon: Check,         color: '#34d27b', bg: 'rgba(29,158,117,.12)'  },
  engine_failed:      { label: 'Falha',           Icon: X,             color: '#f0476a', bg: 'rgba(240,71,106,.12)'  },
  asset_found:        { label: 'Achado',          Icon: Search,        color: '#5ad1ff', bg: 'rgba(90,209,255,.12)'  },
  correlation:        { label: 'Correlação',      Icon: GitBranch,     color: '#EF9F27', bg: 'rgba(239,159,39,.12)'  },
}

const SEV_COLOR: Record<string, string> = {
  critical:      'var(--crit)',
  high:          'var(--high)',
  medium:        'var(--med)',
  low:           'var(--low)',
  informational: 'var(--txt-3)',
}

const SEV_LABEL: Record<string, string> = {
  critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo', informational: 'Info',
}

const ALL_TYPES: EventType[] = [
  'alert_triggered', 'ioc_added', 'evidence_collected', 'domain_found',
  'profile_found', 'leak_found', 'monitoring_alert', 'operation_created',
  'engagement_created', 'note_added',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByDate(events: TimelineEvent[]): Array<{ label: string; events: TimelineEvent[] }> {
  const today     = new Date('2026-06-24')
  const yesterday = new Date('2026-06-23')

  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const dateKey = (iso: string) => {
    const d = new Date(iso)
    const k = fmt(d)
    if (fmt(today)     === k) return 'Hoje'
    if (fmt(yesterday) === k) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const map = new Map<string, TimelineEvent[]>()
  events.forEach(ev => {
    const key = dateKey(ev.timestamp)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ev)
  })

  return Array.from(map.entries()).map(([label, events]) => ({ label, events }))
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TimelinePage() {
  const operations = useDataStore(s => s.operations)
  const [events,      setEvents]      = useState<TimelineEvent[]>([])
  const [opFilter,    setOpFilter]    = useState('all')
  const [typeFilter,  setTypeFilter]  = useState<EventType | 'all'>('all')
  const [sevFilter,   setSevFilter]   = useState<IOCThreatLevel | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    return events
      .filter(ev => opFilter   === 'all' || ev.operationId === opFilter)
      .filter(ev => typeFilter === 'all' || ev.type === typeFilter)
      .filter(ev => sevFilter  === 'all' || ev.severity === sevFilter)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [events, opFilter, typeFilter, sevFilter])

  const groups = useMemo(() => groupByDate(filtered), [filtered])

  const stats = useMemo(() => ({
    total:    events.length,
    critical: events.filter(e => e.severity === 'critical').length,
    high:     events.filter(e => e.severity === 'high').length,
    alerts:   events.filter(e => e.type === 'alert_triggered' || e.type === 'monitoring_alert').length,
    iocs:     events.filter(e => e.type === 'ioc_added').length,
  }), [events])

  const hasFilters = opFilter !== 'all' || typeFilter !== 'all' || sevFilter !== 'all'

  function clearFilters() {
    setOpFilter('all')
    setTypeFilter('all')
    setSevFilter('all')
  }

  function dismissEvent(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  useEffect(() => {
    listTimeline().then(setEvents).catch(() => setEvents([]))
  }, [])

  const opName = (id: string) => operations.find(o => o.id === id)?.name ?? id

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: '0.5px solid var(--border)',
        background: 'var(--bg-surface)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Timeline de Eventos</h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Histórico cronológico de todas as atividades
          </p>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className="btn"
          style={{ padding: '6px 14px', fontSize: 12, gap: 6, background: showFilters ? 'rgba(127,119,221,.12)' : undefined, color: showFilters ? '#a09ae8' : undefined }}
        >
          <Filter size={12} /> Filtros {hasFilters && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--crit)', display: 'inline-block', marginLeft: 2 }} />}
        </button>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'flex', borderBottom: '0.5px solid var(--border)',
        background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        {[
          { label: 'Total',    value: stats.total,    color: 'var(--text-primary)' },
          { label: 'Críticos', value: stats.critical,  color: 'var(--crit)'  },
          { label: 'Altos',    value: stats.high,      color: 'var(--high)'  },
          { label: 'Alertas',  value: stats.alerts,    color: 'var(--med)'   },
          { label: 'IOCs',     value: stats.iocs,      color: 'var(--low)'   },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            flex: 1, padding: '10px 0', textAlign: 'center',
            borderRight: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div style={{
          padding: '12px 24px', borderBottom: '0.5px solid var(--border)',
          background: 'rgba(127,119,221,.04)', flexShrink: 0,
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          {/* Operation */}
          <select
            value={opFilter} onChange={e => setOpFilter(e.target.value)}
            style={{ padding: '6px 10px', background: 'rgba(255,255,255,.04)', border: '0.5px solid var(--line)', borderRadius: 7, color: 'var(--htxt)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">Todas as operações</option>
            {operations.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
          </select>

          {/* Event type */}
          <select
            value={typeFilter} onChange={e => setTypeFilter(e.target.value as EventType | 'all')}
            style={{ padding: '6px 10px', background: 'rgba(255,255,255,.04)', border: '0.5px solid var(--line)', borderRadius: 7, color: 'var(--htxt)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">Todos os tipos</option>
            {ALL_TYPES.map(t => <option key={t} value={t}>{EVENT_META[t].label}</option>)}
          </select>

          {/* Severity chips */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(s => {
              const active = sevFilter === s
              const label = s === 'all' ? 'Todas' : SEV_LABEL[s]
              return (
                <button key={s} onClick={() => setSevFilter(s)}
                  style={{
                    padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                    background: active ? 'rgba(127,119,221,.2)' : 'rgba(255,255,255,.04)',
                    color: active ? '#a09ae8' : 'var(--text-muted)',
                    fontWeight: active ? 600 : 400,
                  }}
                >{label}</button>
              )
            })}
          </div>

          {hasFilters && (
            <button onClick={clearFilters} style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, background: 'rgba(226,75,74,.1)', color: '#e24b4a', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={10} /> Limpar
            </button>
          )}
        </div>
      )}

      {/* Timeline body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, paddingTop: 40 }}>
            Nenhum evento para os filtros selecionados.
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} style={{ marginBottom: 32 }}>

              {/* Date label */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', flexShrink: 0 }}>
                  {group.label}
                </div>
                <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {group.events.length} evento{group.events.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {group.events.map((ev, i) => {
                  const meta  = EVENT_META[ev.type]
                  const sev   = ev.severity
                  const isLast = i === group.events.length - 1

                  return (
                    <div key={ev.id} style={{ display: 'flex', gap: 16, position: 'relative' }}>

                      {/* Vertical line + icon */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 36 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: meta.bg, border: `1px solid ${meta.color}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: sev === 'critical' ? `0 0 12px ${meta.color}30` : 'none',
                        }}>
                          <meta.Icon size={14} style={{ color: meta.color }} />
                        </div>
                        {!isLast && (
                          <div style={{ width: 1, flex: 1, background: 'var(--line)', marginTop: 4, marginBottom: 4, minHeight: 16 }} />
                        )}
                      </div>

                      {/* Card */}
                      <div style={{
                        flex: 1, marginBottom: isLast ? 0 : 8,
                        background: 'var(--bg-surface)',
                        border: `0.5px solid var(--border)`,
                        borderLeft: `2px solid ${sev ? SEV_COLOR[sev] : 'var(--line)'}`,
                        borderRadius: '0 8px 8px 0',
                        padding: '10px 14px',
                        position: 'relative',
                        transition: 'background .1s',
                      }}
                        onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
                        onMouseOut={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
                      >
                        {/* Top row */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 5 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {ev.title}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{
                              fontSize: 9.5, padding: '1px 7px', borderRadius: 3,
                              background: meta.bg, color: meta.color,
                              fontWeight: 600, letterSpacing: '.02em',
                            }}>
                              {meta.label}
                            </span>
                            {sev && (
                              <span style={{ fontSize: 10, color: SEV_COLOR[sev] ?? 'var(--txt-3)', fontWeight: 600 }}>
                                {SEV_LABEL[sev]}
                              </span>
                            )}
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {fmtTime(ev.timestamp)}
                            </span>
                            <button
                              onClick={() => dismissEvent(ev.id)}
                              className="hbtn"
                              style={{ width: 20, height: 20, padding: 0, justifyContent: 'center', opacity: .5 }}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                          {ev.description}
                        </div>

                        {/* Footer badges */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                          <span style={{
                            fontSize: 10, padding: '1px 7px', borderRadius: 3,
                            background: 'rgba(255,255,255,.04)', color: 'var(--text-muted)',
                          }}>
                            {opName(ev.operationId)}
                          </span>
                          {ev.engagementId && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              · {ev.engagementId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', paddingBottom: 8 }}>
          {filtered.length} evento{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
