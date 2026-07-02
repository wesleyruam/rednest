import { useEffect, useState } from 'react'
import {
  Loader2, Globe, Server, Mail, AtSign, User, ShieldAlert, Database, Link2, Network,
  Camera, Bug, KeyRound, FileText, Download, Star, MessageSquare, ChevronRight, ChevronDown,
  Play, Activity, Settings, Rss, Key, Plug, Boxes, Lock, Upload, Bell, ExternalLink, Hash,
} from 'lucide-react'
import type { Engagement, Operation, TimelineEvent } from '@/types'
import { listEntities, getEntityCounts, getThreatScore, type Entity, type ThreatScore } from '@/services/entities'
import { EntityGraph } from './EntityGraph'
import { getFindingCounts } from '@/services/findings'
import { listEvidence, downloadEvidence, type Evidence } from '@/services/evidence'
import { listReports, generateReport, downloadReport, type Report } from '@/services/reports'
import { useUIStore } from '@/store/ui'

// ─── shared ─────────────────────────────────────────────────────────────────────

const ENTITY_META: Record<string, { label: string; Icon: any; color: string }> = {
  subdomain: { label: 'Subdomínio', Icon: Globe, color: '#5ad1ff' },
  host: { label: 'Host / IP', Icon: Server, color: '#8a9cff' },
  ip: { label: 'IP', Icon: Server, color: '#8a9cff' },
  email: { label: 'E-mail', Icon: Mail, color: '#5ad1ff' },
  username: { label: 'Username', Icon: AtSign, color: '#EF9F27' },
  profile: { label: 'Perfil', Icon: User, color: '#e879f9' },
  service: { label: 'Serviço', Icon: Server, color: '#8a9cff' },
  url: { label: 'URL', Icon: Link2, color: '#5ad1ff' },
  endpoint: { label: 'Endpoint', Icon: Network, color: '#5ad1ff' },
  ioc: { label: 'IOC', Icon: ShieldAlert, color: '#a09ae8' },
  leak: { label: 'Vazamento', Icon: Database, color: '#e24b4a' },
  credential: { label: 'Credencial', Icon: KeyRound, color: '#e24b4a' },
  cve: { label: 'CVE', Icon: Bug, color: '#ff9f5a' },
  tech: { label: 'Tecnologia', Icon: Server, color: '#4dd4a4' },
  screenshot: { label: 'Captura', Icon: Camera, color: '#e879f9' },
}
const fmtDate = (s?: string | null) => s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const card: React.CSSProperties = { background: 'var(--bg-elevated)', border: '0.5px solid var(--border)', borderRadius: 8 }

// ─── Visão Geral: faixa de KPIs ───────────────────────────────────────────────────

function Kpi({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, padding: '11px 13px', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: color ?? 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

export function OpKpiStrip({ operation, engagements, events }: { operation: Operation; engagements: Engagement[]; events: TimelineEvent[] }) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [threat, setThreat] = useState<ThreatScore | null>(null)
  useEffect(() => {
    getEntityCounts(operation.id).then(setCounts).catch(() => {})
    getThreatScore(operation.id).then(setThreat).catch(() => {})
  }, [operation.id, events.length])

  const lastEvent = events[0]
  const created = new Date(operation.createdAt).getTime()
  const lastTs = lastEvent ? new Date(lastEvent.timestamp).getTime() : created
  const totalH = Math.max(0, Math.round((Date.now() - created) / 3600000))
  const running = events.some(e => e.type === 'engine_started') && !events.slice(0, 3).some(e => e.type === 'engine_finished')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
      <Kpi label="Status Pipeline" value={running ? 'Rodando' : 'Ocioso'} color={running ? '#a9a4ee' : '#4dd4a4'} />
      <Kpi label="Engajamentos" value={engagements.length} />
      <Kpi label="Alvos" value={counts.total ?? 0} sub="entidades" />
      <Kpi label="IOCs" value={counts.ioc ?? 0} color={(counts.ioc ?? 0) > 0 ? '#a09ae8' : undefined} />
      <Kpi label="Vulnerabilidades" value={counts.cve ?? 0} color={(counts.cve ?? 0) > 0 ? '#ff9f5a' : undefined} />
      <Kpi label="Evidências" value={operation.evidenceCount} color="#1D9E75" />
      <div style={{ ...card, padding: '11px 13px', minWidth: 0 }} title={threat?.factors.join(' · ') || 'Sem fatores de risco'}>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3 }}>Threat Score</div>
        <div style={{ fontSize: 21, fontWeight: 700, color: threat?.color ?? 'var(--text-primary)', lineHeight: 1.1 }}>{threat?.score ?? 0}</div>
        <div style={{ fontSize: 9.5, color: threat?.color ?? 'var(--text-muted)' }}>{threat?.band ?? '—'}</div>
      </div>
      <Kpi label="Última execução" value={lastEvent ? new Date(lastTs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'} sub={lastEvent ? new Date(lastTs).toLocaleDateString('pt-BR') : ''} />
      <Kpi label="Tempo total" value={`${totalH}h`} sub="desde a criação" />
    </div>
  )
}

// ─── Engajamentos: cards ricos ────────────────────────────────────────────────────

function EngagementCard({ eng, onOpen }: { eng: Engagement; onOpen: (id: string) => void }) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  useEffect(() => { getFindingCounts(eng.id).then(setCounts).catch(() => setCounts({})) }, [eng.id])
  const targets = (eng.target || '').split(/[\s,;]+/).filter(Boolean).length
  const iocs = (counts?.ioc ?? 0) + (counts?.leak ?? 0)
  const evid = eng.evidenceCount ?? 0
  const totalFindings = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  const sColor = eng.status === 'active' ? '#4dd4a4' : eng.status === 'paused' ? '#f4bc6a' : '#7ab8f0'

  return (
    <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e9e9f1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eng.name}</span>
        <span className="badge" style={{ background: `${sColor}1a`, color: sColor, border: `0.5px solid ${sColor}44`, fontSize: 9.5 }}>{eng.status}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eng.target}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {[['Alvos', targets], ['Achados', totalFindings], ['IOCs', iocs], ['Evidências', evid]].map(([l, v]) => (
          <div key={l as string} style={{ textAlign: 'center', padding: '6px 0', background: 'rgba(255,255,255,.02)', borderRadius: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{counts === null ? '·' : (v as number)}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{l as string}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
        <span>Criado {fmtDate(eng.createdAt)}</span>
        <span>Threat: —</span>
      </div>
      <button className="btn btn-accent" style={{ justifyContent: 'center', fontSize: 12 }} onClick={() => onOpen(eng.id)}>
        <ExternalLink size={13} /> Abrir engajamento
      </button>
    </div>
  )
}

export function EngagementsGrid({ engagements, onOpen }: { engagements: Engagement[]; onOpen: (id: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {engagements.map(e => <EngagementCard key={e.id} eng={e} onOpen={onOpen} />)}
    </div>
  )
}

// ─── Alvos: entidades unificadas ──────────────────────────────────────────────────

export function AlvosTab({ operationId }: { operationId: string }) {
  const [items, setItems] = useState<Entity[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [type, setType] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'graph'>('list')

  useEffect(() => {
    setLoading(true)
    Promise.all([listEntities(operationId, type || undefined), getEntityCounts(operationId)])
      .then(([e, c]) => { setItems(e); setCounts(c) })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [operationId, type])

  const types = Object.keys(counts).filter(k => k !== 'total')

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Alvos / Entidades</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{counts.total ?? 0} entidades · sincronizadas dos engajamentos</span>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setView('list')} style={{ fontSize: 11, ...(view === 'list' ? { borderColor: '#378ADD', color: '#7ab8f0' } : {}) }}>Lista</button>
        <button className="btn" onClick={() => setView('graph')} style={{ fontSize: 11, ...(view === 'graph' ? { borderColor: '#378ADD', color: '#7ab8f0' } : {}) }}>Grafo</button>
      </div>

      {view === 'graph' ? <EntityGraph operationId={operationId} /> : <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn" onClick={() => setType('')} style={{ fontSize: 11, ...(type === '' ? { borderColor: '#378ADD', color: '#7ab8f0' } : {}) }}>Tudo ({counts.total ?? 0})</button>
        {types.map(t => {
          const m = ENTITY_META[t]
          return <button key={t} className="btn" onClick={() => setType(t)} style={{ fontSize: 11, ...(type === t ? { borderColor: '#378ADD', color: '#7ab8f0' } : {}) }}>{m?.label ?? t} ({counts[t]})</button>
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Boxes size={30} style={{ opacity: 0.25, margin: '0 auto 10px' }} />
          <div style={{ fontSize: 13 }}>Nenhuma entidade ainda.</div>
          <div style={{ fontSize: 11.5, marginTop: 4 }}>Rode ferramentas nos engajamentos — os alvos descobertos aparecem aqui automaticamente.</div>
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 130px 130px 90px 90px', gap: 10, padding: '8px 14px', borderBottom: '0.5px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            <span>Tipo</span><span>Valor</span><span>Origem</span><span>Último avistamento</span><span>Relac.</span><span>Status</span>
          </div>
          {items.map((e, i) => {
            const m = ENTITY_META[e.type] ?? { label: e.type, Icon: Database, color: 'var(--text-muted)' }
            return (
              <div key={i} className="rowi" style={{ display: 'grid', gridTemplateColumns: '120px 1fr 130px 130px 90px 90px', gap: 10, padding: '9px 14px', borderBottom: '0.5px solid var(--border)', alignItems: 'center', fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><m.Icon size={13} style={{ color: m.color }} /><span style={{ color: m.color, fontSize: 11 }}>{m.label}</span></span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.value}>{e.label ? <span style={{ color: 'var(--text-muted)' }}>{e.label} · </span> : null}{e.value}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.sources.join(', ') || '—'}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>{fmtDate(e.lastSeen)}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11, textAlign: 'center' }}>{e.engagementCount}</span>
                <span><span className="badge" style={{ fontSize: 9, background: 'rgba(127,119,221,.12)', color: '#a9a4ee', border: '0.5px solid rgba(127,119,221,.3)' }}>{e.status}</span></span>
              </div>
            )
          })}
        </div>
      )}
      </>}
    </div>
  )
}

// ─── Atividades: Event Viewer ─────────────────────────────────────────────────────

const EVENT_ICON: Record<string, any> = {
  engine_started: Play, engine_finished: Activity, engine_failed: ShieldAlert,
  asset_found: Network, correlation: Link2, ioc_added: ShieldAlert, monitoring_alert: Bell,
}

function EventRow({ ev }: { ev: TimelineEvent }) {
  const [open, setOpen] = useState(false)
  const Icon = EVENT_ICON[ev.type] ?? Activity
  const color = ev.severity === 'critical' || ev.severity === 'high' ? '#e24b4a' : ev.severity === 'medium' ? '#f4bc6a' : '#1D9E75'
  const hasDetails = ev.details && Object.keys(ev.details).length > 0
  return (
    <div style={{ ...card, marginBottom: 6 }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${color}1a`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={12} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{ev.title}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
            {ev.category && <span style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{ev.category}</span>}
            {ev.engine && <span style={{ fontSize: 9.5, color: '#7ab8f0' }}>{ev.engine}</span>}
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{new Date(ev.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>dur —</span>
        {hasDetails && (open ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />)}
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px 52px' }}>
          {ev.description && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 8 }}>{ev.description}</div>}
          {hasDetails && <pre style={{ padding: 8, background: 'rgba(255,255,255,.03)', border: '0.5px solid var(--border)', borderRadius: 6, fontSize: 10.5, color: 'var(--text-secondary)', overflow: 'auto', maxHeight: 200, fontFamily: 'var(--font-mono)' }}>{JSON.stringify(ev.details, null, 2)}</pre>}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 14 }}>
            <span>Logs: em breve</span><span>JSON: {hasDetails ? 'acima' : '—'}</span><span>Evidências: em breve</span>
          </div>
        </div>
      )}
    </div>
  )
}

export function ActivitiesTab({ events }: { events: TimelineEvent[] }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Event Viewer ({events.length})</div>
      <div style={{ maxWidth: 860 }}>
        {events.length === 0
          ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', fontSize: 13 }}>Nenhuma atividade registrada.</div>
          : events.map(ev => <EventRow key={ev.id} ev={ev} />)}
      </div>
    </div>
  )
}

// ─── Relatórios: centro de geração ────────────────────────────────────────────────

const REPORT_TYPES = [
  { id: 'executive', name: 'Executive Report', desc: 'Resumo gerencial: risco, achados-chave e recomendações.' },
  { id: 'technical', name: 'Technical Report', desc: 'Detalhamento técnico completo da investigação.' },
  { id: 'ioc', name: 'IOC Report', desc: 'Indicadores de comprometimento coletados.' },
  { id: 'vulnerability', name: 'Vulnerability Report', desc: 'CVEs e vulnerabilidades correlacionadas.' },
  { id: 'recon', name: 'Recon Report', desc: 'Superfície de ataque: hosts, subdomínios, serviços.' },
  { id: 'osint', name: 'OSINT Report', desc: 'Perfis, e-mails, usuários e vazamentos.' },
  { id: 'timeline', name: 'Timeline Report', desc: 'Linha do tempo cronológica das ações.' },
]
const FORMATS = ['PDF', 'HTML', 'JSON', 'Markdown']

export function ReportsTab({ operationId }: { operationId: string }) {
  const { showToast } = useUIStore()
  const [reports, setReports] = useState<Report[]>([])
  const [busy, setBusy] = useState(false)
  const load = () => listReports(operationId).then(setReports).catch(() => setReports([]))
  useEffect(() => { void load() }, [operationId])

  async function gen(name: string) {
    setBusy(true)
    try { await generateReport(operationId); showToast(`${name} gerado (PDF)`, 'success'); await load() }
    catch { showToast('Falha ao gerar relatório', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Centro de Relatórios</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 22 }}>
        {REPORT_TYPES.map(r => (
          <div key={r.id} style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} style={{ color: '#378ADD' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e9e9f1' }}>{r.name}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>{r.desc}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FORMATS.map(f => <span key={f} className="badge" style={{ fontSize: 8.5, background: 'rgba(255,255,255,.04)', color: 'var(--text-muted)', border: '0.5px solid var(--border)' }}>{f}</span>)}
            </div>
            <button className="btn btn-accent" style={{ justifyContent: 'center', fontSize: 12 }} disabled={busy} onClick={() => gen(r.name)}>
              {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <FileText size={13} />} Gerar
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Relatórios gerados ({reports.length})</div>
      <div style={{ ...card }}>
        {reports.length === 0
          ? <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Nenhum relatório gerado ainda.</div>
          : reports.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <FileText size={13} style={{ color: 'var(--text-muted)' }} />
              <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{r.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.format} · {fmtDate(r.createdAt)}</span>
              <button className="btn" style={{ padding: '4px 8px' }} onClick={() => downloadReport(r.id, r.name)}><Download size={12} /></button>
            </div>
          ))}
      </div>
    </div>
  )
}

// ─── Evidências: gerenciador ──────────────────────────────────────────────────────

export function EvidenceTab({ operationId }: { operationId: string }) {
  const [items, setItems] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { listEvidence({ operationId }).then(setItems).catch(() => setItems([])).finally(() => setLoading(false)) }, [operationId])

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Gerenciador de Evidências ({items.length})</div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Database size={30} style={{ opacity: 0.25, margin: '0 auto 10px' }} />
          <div style={{ fontSize: 13 }}>Nenhuma evidência armazenada.</div>
          <div style={{ fontSize: 11.5, marginTop: 4 }}>Screenshots, PDFs, documentos, JSON, logs e PCAPs aparecerão aqui.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {items.map(ev => (
            <div key={ev.id} style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 90, borderRadius: 6, background: 'rgba(255,255,255,.03)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <FileText size={22} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Hash size={9} /> {ev.id.slice(0, 12)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fmtDate(ev.createdAt)}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn" style={{ padding: '4px 6px' }} title="Favoritar"><Star size={11} /></button>
                <button className="btn" style={{ padding: '4px 6px' }} title="Importante"><ShieldAlert size={11} /></button>
                <button className="btn" style={{ padding: '4px 6px' }} title="Comentar"><MessageSquare size={11} /></button>
                <button className="btn" style={{ padding: '4px 6px', marginLeft: 'auto' }} title="Download" onClick={() => downloadEvidence(ev.id, ev.name)}><Download size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Configurações: categorizado ──────────────────────────────────────────────────

const SETTINGS_CATS = [
  { id: 'geral', label: 'Geral', Icon: Settings, desc: 'Nome, objetivo, status e tags da operação.' },
  { id: 'pipelines', label: 'Pipelines', Icon: Play, desc: 'Etapas, limites e agendamento do Recon Pipeline.' },
  { id: 'apis', label: 'APIs', Icon: Key, desc: 'Chaves de threat intelligence e enriquecimento.' },
  { id: 'integracoes', label: 'Integrações', Icon: Plug, desc: 'MISP, GHunt (Google Intelligence) e demais engines.' },
  { id: 'feeds', label: 'Threat Feeds', Icon: Rss, desc: 'CISA KEV, RSS e fontes de inteligência.' },
  { id: 'credenciais', label: 'Credenciais', Icon: Lock, desc: 'Sessões e tokens armazenados (cifrados).' },
  { id: 'exportacoes', label: 'Exportações', Icon: Upload, desc: 'Formatos e destinos de exportação de dados.' },
  { id: 'notificacoes', label: 'Notificações', Icon: Bell, desc: 'Telegram e alertas de mudança/risco.' },
  { id: 'modulos', label: 'Módulos', Icon: Boxes, desc: 'Ativar/desativar engines e ferramentas.' },
  { id: 'permissoes', label: 'Permissões', Icon: User, desc: 'Acesso por papel (admin/analyst/viewer).' },
]

export function SettingsTab() {
  const [cat, setCat] = useState('geral')
  const active = SETTINGS_CATS.find(c => c.id === cat)!
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
      <div style={{ width: 200, flexShrink: 0, borderRight: '0.5px solid var(--border)', padding: 12, overflowY: 'auto' }}>
        {SETTINGS_CATS.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 6, background: cat === c.id ? 'rgba(55,138,221,.12)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: cat === c.id ? '#7ab8f0' : 'var(--text-secondary)', fontSize: 12, marginBottom: 2 }}>
            <c.Icon size={13} /> {c.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <active.Icon size={16} style={{ color: '#378ADD' }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{active.label}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{active.desc}</div>
        <div style={{ ...card, padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          Configurações de <b style={{ color: 'var(--text-secondary)' }}>{active.label}</b> — estrutura preparada.
          {active.id === 'apis' && <div style={{ marginTop: 6, fontSize: 11 }}>Use <b>Integrações &amp; Chaves</b> na barra lateral para gerenciar agora.</div>}
          {active.id === 'notificacoes' && <div style={{ marginTop: 6, fontSize: 11 }}>Telegram já configurável em <b>Integrações &amp; Chaves → Notificações</b>.</div>}
          {active.id === 'feeds' && <div style={{ marginTop: 6, fontSize: 11 }}>Veja <b>Threat Feeds</b> na barra lateral.</div>}
        </div>
      </div>
    </div>
  )
}
