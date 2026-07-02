import { useEffect, useMemo, useState } from 'react'
import {
  Sparkles, Loader2, CheckCircle2, XCircle, Circle, AlertTriangle, Info, ShieldCheck,
  ShieldAlert, Globe, Network, Server, AtSign, Mail, Lightbulb, ListChecks,
  ChevronRight, FileText,
} from 'lucide-react'
import type { Engagement } from '@/types'
import { enrichEngagementStream, type EnrichStreamEvent } from '@/services/engagements'
import { summarize, targetOverview, type Insight, type NextStep } from '@/lib/engagementSummary'
import { getFindingCounts } from '@/services/findings'
import { InvestigationTimeline } from './InvestigationTimeline'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'

const KIND_META: Record<string, { label: string; color: string; Icon: any }> = {
  ip: { label: 'IP', color: '#8a9cff', Icon: Server },
  email: { label: 'E-MAIL', color: '#e879f9', Icon: Mail },
  domain: { label: 'DOMÍNIO', color: '#5ad1ff', Icon: Globe },
  username: { label: 'USUÁRIO', color: '#EF9F27', Icon: AtSign },
  unknown: { label: '—', color: '#888', Icon: Globe },
}

// ─── Primitives ─────────────────────────────────────────────────────────────────

function Card({ title, icon, action, children, pad = true }: { title?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; pad?: boolean }) {
  return (
    <div className="block hot" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      {title && (
        <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}<span style={{ flex: 1 }}>{title}</span>{action}
        </div>
      )}
      <div className="bbody" style={{ flex: 1, padding: pad ? undefined : 0 }}>{children}</div>
    </div>
  )
}

function MiniField({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '0.5px solid var(--line)' }}>
      <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>{k}</span>
      <span style={{ fontSize: 12, color: 'var(--htxt)', textAlign: 'right', fontFamily: mono ? "'JetBrains Mono', monospace" : undefined, wordBreak: 'break-all' }}>{v ?? '—'}</span>
    </div>
  )
}

function StepIcon({ status }: { status: string }) {
  if (status === 'running') return <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: '#7f77dd' }} />
  if (status === 'done') return <CheckCircle2 size={13} style={{ color: 'var(--up)' }} />
  if (status === 'error') return <XCircle size={13} style={{ color: 'var(--down)' }} />
  return <Circle size={13} style={{ color: 'var(--txt-3)', opacity: 0.5 }} />
}

function InsightRow({ ins }: { ins: Insight }) {
  const meta = ins.level === 'warn'
    ? { Icon: AlertTriangle, color: '#f4bc6a' }
    : ins.level === 'ok'
    ? { Icon: ShieldCheck, color: 'var(--up)' }
    : { Icon: Info, color: '#5ad1ff' }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0' }}>
      <meta.Icon size={13} style={{ color: meta.color, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--htxt)', lineHeight: 1.4 }}>{ins.text}</span>
    </div>
  )
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

function Gauge({ score, color }: { score: number; color: string }) {
  const r = 24, c = 2 * Math.PI * r, off = c * (1 - score / 100)
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" style={{ flexShrink: 0 }}>
      <circle cx="30" cy="30" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 30 30)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
      <text x="30" y="34" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--htxt)">{score}</text>
    </svg>
  )
}

function KpiCell({ value, label, sub, icon }: { value: React.ReactNode; label: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="block hot" style={{ minWidth: 0 }}>
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--txt-3)', fontSize: 11 }}>{icon}<span>{label}</span></div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--htxt)', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{sub}</div>}
      </div>
    </div>
  )
}

function CoverageRow({ label, value, total, onOpen }: { label: string; value: number; total: number; onOpen?: () => void }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  const color = value > 0 ? 'var(--up)' : 'var(--txt-3)'
  return (
    <button
      onClick={onOpen}
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr 44px',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '7px 0',
        background: 'transparent',
        border: 'none',
        borderBottom: '0.5px solid var(--line)',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 11.5, color: 'var(--txt-2)' }}>{label}</span>
      <span style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: color }} />
      </span>
      <span style={{ fontSize: 11.5, color, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </button>
  )
}

// ─── Selected target overview cards ─────────────────────────────────────────────

function fmtDate(s?: string | null) {
  return s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}

function PlatformProfileCard({ p }: { p: any }) {
  const title = p.platform === 'github' ? 'GitHub' : p.platform === 'gitlab' ? 'GitLab' : p.platform
  return (
    <Card title={title} icon={<Globe size={12} />}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        {p.avatar && <img src={p.avatar} alt="" width={42} height={42} style={{ borderRadius: 8, flexShrink: 0, border: '0.5px solid var(--line-2)' }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--htxt)' }}>{p.name ?? p.username}</div>
          <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#7ab8f0', fontFamily: "'JetBrains Mono', monospace", textDecoration: 'none' }}>@{p.username}</a>
        </div>
      </div>
      {p.bio && <div style={{ fontSize: 11.5, color: 'var(--txt-2)', marginBottom: 8, lineHeight: 1.4 }}>{p.bio}</div>}
      {(p.repos != null || p.followers != null) && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
          {p.repos != null && <div><div style={{ fontSize: 15, fontWeight: 700, color: 'var(--htxt)' }}>{p.repos}</div><div style={{ fontSize: 9.5, color: 'var(--txt-3)' }}>repos</div></div>}
          {p.followers != null && <div><div style={{ fontSize: 15, fontWeight: 700, color: 'var(--htxt)' }}>{p.followers}</div><div style={{ fontSize: 9.5, color: 'var(--txt-3)' }}>seguidores</div></div>}
          {p.following != null && <div><div style={{ fontSize: 15, fontWeight: 700, color: 'var(--htxt)' }}>{p.following}</div><div style={{ fontSize: 9.5, color: 'var(--txt-3)' }}>seguindo</div></div>}
        </div>
      )}
      {p.company && <MiniField k="Empresa" v={p.company} />}
      {p.location && <MiniField k="Local" v={p.location} />}
      <MiniField k="Criado" v={fmtDate(p.createdAt)} />
      {p.lastActivity && <MiniField k="Última atividade" v={fmtDate(p.lastActivity)} />}
      {p.languages?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {p.languages.map((l: any) => <span key={l.name} className="tag" style={{ fontSize: 10 }}>{l.name} ({l.count})</span>)}
        </div>
      )}
      {p.links?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          {p.links.map((l: string) => <a key={l} href={l.startsWith('http') ? l : `https://${l}`} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: '#7ab8f0', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l}</a>)}
        </div>
      )}
    </Card>
  )
}

function ServicesCard({ scan }: { scan: any }) {
  const services = scan?.services ?? []
  if (!services.length) return null
  return (
    <Card title={`Serviços (${services.length})`} icon={<Server size={12} />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {services.map((s: any) => {
          const tls = s.tls ?? s.http?.tls
          return (
            <div key={s.port} style={{ padding: '8px 10px', borderRadius: 7, background: 'rgba(255,255,255,.02)', border: '1px solid var(--line-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="tag" style={{ fontSize: 9.5, color: '#8a9cff', borderColor: '#8a9cff55', background: '#8a9cff1a' }}>{String(s.protocol).toUpperCase()}</span>
                <span style={{ fontSize: 11, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace" }}>:{s.port}</span>
                {s.http?.status != null && <span style={{ fontSize: 11, color: 'var(--htxt)', marginLeft: 'auto' }}>HTTP {s.http.status} · {s.http.httpVersion}</span>}
              </div>
              {s.http && (
                <>
                  {s.http.title && <div style={{ fontSize: 11.5, color: 'var(--htxt)' }}>{s.http.title}</div>}
                  {s.http.server && <MiniField k="Server" v={s.http.server} />}
                  <MiniField k="Security headers" v={`${s.http.securityScore}/6`} />
                  {s.http.technologies?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {s.http.technologies.map((tch: string) => <span key={tch} className="tag" style={{ fontSize: 9.5 }}>{tch}</span>)}
                    </div>
                  )}
                  {s.http.cookies?.length > 0 && <MiniField k="Cookies" v={s.http.cookies.map((c: any) => c.name).join(', ')} />}
                </>
              )}
              {tls?.certificate && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '0.5px solid var(--line)' }}>
                  <MiniField k="TLS" v={`${tls.protocol ?? ''} ${tls.cipher?.name ?? ''}`.trim()} />
                  <MiniField k="Cert (CN)" v={tls.certificate.subject} />
                  <MiniField k="Emissor" v={tls.certificate.issuer} />
                  <MiniField k="Validade" v={`${(tls.certificate.validFrom || '').slice(0, 11)} → ${(tls.certificate.validTo || '').slice(0, 11)}`} />
                </div>
              )}
              {s.ssh && (
                <>
                  <MiniField k="Banner" v={s.ssh.software} mono />
                  {s.ssh.algorithms?.kex?.length > 0 && <MiniField k="KEX" v={s.ssh.algorithms.kex.slice(0, 2).join(', ')} />}
                  {s.ssh.algorithms?.hostKeys?.length > 0 && <MiniField k="Host keys" v={s.ssh.algorithms.hostKeys.join(', ')} />}
                </>
              )}
              {s.ftp && <MiniField k="FTP" v={s.ftp.software} mono />}
              {s.smtp && (
                <>
                  <MiniField k="SMTP" v={s.smtp.banner} mono />
                  {s.smtp.features?.length > 0 && <MiniField k="Recursos" v={s.smtp.features.slice(0, 6).join(', ')} />}
                </>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function TargetCards({ t }: { t: any }) {
  const ov = targetOverview(t)
  if (!ov) return null
  const cards: React.ReactNode[] = []

  if (ov.threatIntel) {
    const v = ov.threatIntel.verdict
    const col = v === 'malicious' ? 'var(--down)' : v === 'suspicious' ? '#f4bc6a' : 'var(--up)'
    cards.push(
      <Card key="ti" title="Threat Intelligence" icon={<ShieldAlert size={12} />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span className="badge" style={{ background: `${col}22`, color: col, border: `0.5px solid ${col}55`, textTransform: 'uppercase' }}>{v ?? '—'}</span>
        </div>
        <MiniField k="Clean Score" v={`${ov.threatIntel.score ?? 0} / 100`} />
        {ov.threatIntel.virustotal && <MiniField k="VT detections" v={`${ov.threatIntel.virustotal.malicious ?? 0} / ${(ov.threatIntel.virustotal.malicious ?? 0) + (ov.threatIntel.virustotal.harmless ?? 0) + (ov.threatIntel.virustotal.undetected ?? 0)}`} />}
        {ov.threatIntel.otx && <MiniField k="OTX Pulses" v={ov.threatIntel.otx.pulses ?? 0} />}
      </Card>,
    )
  }
  if (ov.whois) {
    cards.push(
      <Card key="whois" title="WHOIS / DNS" icon={<Globe size={12} />}>
        <MiniField k="Registrador" v={ov.whois.registrar} />
        <MiniField k="Criado" v={ov.whois.created} />
        <MiniField k="A" v={(ov.whois.dns?.A ?? []).join(', ')} mono />
        <MiniField k="NS" v={(ov.whois.dns?.NS ?? []).slice(0, 2).join(', ')} mono />
      </Card>,
    )
  }
  if (ov.subdomains?.length || ov.kind === 'domain') {
    cards.push(
      <Card key="sub" title="Subdomínios" icon={<Network size={12} />}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--htxt)' }}>{ov.subdomains.length}</div>
        <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 6 }}>Encontrados</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {ov.subdomains.slice(0, 8).map((s: string) => <span key={s} className="tag" style={{ fontSize: 10 }}>{s}</span>)}
          {ov.subdomains.length > 8 && <span className="tag" style={{ fontSize: 10 }}>+{ov.subdomains.length - 8}</span>}
        </div>
      </Card>,
    )
  }
  if (ov.hosts?.length || ov.asn) {
    cards.push(
      <Card key="hosts" title="IPs / Hosts" icon={<Server size={12} />}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--htxt)' }}>{ov.hosts.length}</div>
        <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 6 }}>Endereços</div>
        {ov.hosts.slice(0, 4).map((h: string) => <div key={h} style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--htxt)' }}>{h}</div>)}
        {ov.asn && <MiniField k="ASN" v={ov.asn.asn ? `AS${ov.asn.asn} ${ov.asn.org ?? ''}` : '—'} />}
      </Card>,
    )
  }
  if (ov.hunter) {
    cards.push(
      <Card key="hunter" title="E-mails (Hunter)" icon={<Mail size={12} />}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--htxt)' }}>{ov.hunter.total ?? 0}</div>
        <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 6 }}>Encontrados</div>
        <MiniField k="Organização" v={ov.hunter.organization} />
        <MiniField k="Padrão" v={ov.hunter.pattern} />
      </Card>,
    )
  }
  if (ov.email) {
    cards.push(
      <Card key="email" title="E-mail Intel" icon={<AtSign size={12} />}>
        <MiniField k="Gravatar" v={ov.email.gravatar?.found ? 'perfil' : 'sem perfil'} />
        <MiniField k="Hunter" v={ov.email.hunter?.result} />
        <MiniField k="Leak-Lookup" v={`${ov.email.leaklookup?.n ?? 0} fontes`} />
        <MiniField k="COMB" v={`${(ov.email.comb?.count ?? 0).toLocaleString('pt-BR')} registros`} />
      </Card>,
    )
  }
  if (ov.servicescan?.services?.length) cards.push(<ServicesCard key="svc" scan={ov.servicescan} />)
  for (const p of (ov.userintel?.platforms ?? []).filter((x: any) => x.found)) {
    cards.push(<PlatformProfileCard key={`pf-${p.platform}`} p={p} />)
  }
  if (ov.googleintel?.found) {
    const g = ov.googleintel
    cards.push(
      <Card key="gi" title="Google Intelligence" icon={<Globe size={12} />}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          {g.photo && <img src={g.photo} alt="" width={42} height={42} style={{ borderRadius: '50%', flexShrink: 0, border: '0.5px solid var(--line-2)' }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--htxt)' }}>{g.name ?? '—'}</div>
            <div style={{ fontSize: 10.5, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace" }}>{ov.value}</div>
          </div>
        </div>
        {g.gaiaId && <MiniField k="Gaia ID" v={g.gaiaId} mono />}
        {g.lastEdit && <MiniField k="Último update" v={g.lastEdit} />}
        {g.services?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {g.services.slice(0, 12).map((s: string) => <span key={s} className="tag" style={{ fontSize: 9.5 }}>{s}</span>)}
          </div>
        )}
      </Card>,
    )
  }
  if (ov.kind === 'username') {
    cards.push(
      <Card key="user" title="Usuário / Vazamentos" icon={<AtSign size={12} />}>
        <MiniField k="Leak-Lookup" v={`${ov.leaklookup?.n ?? 0} fontes`} />
        <MiniField k="COMB" v={`${(ov.comb?.count ?? 0).toLocaleString('pt-BR')} registros`} />
        {ov.whatsmyname && <MiniField k="Perfis (WhatsMyName)" v={ov.whatsmyname.found?.length ?? 0} />}
        {ov.whatsmyname && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {(ov.whatsmyname.found ?? []).slice(0, 10).map((h: any) => (
              <a key={h.name} href={h.url} target="_blank" rel="noreferrer" className="tag" style={{ fontSize: 10, textDecoration: 'none', color: 'var(--htxt)' }}>{h.name}</a>
            ))}
          </div>
        )}
      </Card>,
    )
  }
  if (t.note) cards.push(<Card key="note" title="Alvo"><div style={{ fontSize: 12, color: 'var(--txt-3)' }}>{t.note}</div></Card>)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {cards}
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export function EngagementOverview({ engagement, onNavigate }: { engagement: Engagement; onNavigate?: (tool: string) => void }) {
  const { replaceEngagement } = useDataStore()
  const { showToast } = useUIStore()
  const [loading, setLoading] = useState(false)
  const [pipeline, setPipeline] = useState<Record<string, { label: string; status: string; progress?: any }> | null>(null)
  const [pipeOrder, setPipeOrder] = useState<string[]>([])
  const [selected, setSelected] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})

  const sum = useMemo(() => summarize(engagement), [engagement])
  const targets = sum.targets
  const hasData = targets.length > 0

  const loadCounts = () => getFindingCounts(engagement.id).then(setCounts).catch(() => {})
  useEffect(() => { loadCounts() }, [engagement.id, (engagement as any).enrichment?.ranAt])

  async function run() {
    setLoading(true)
    setPipeline(null)
    setPipeOrder([])
    const { startTask, updateTask, endTask } = useUIStore.getState()
    const taskId = startTask(`Auto-enriquecimento: ${engagement.target}`)
    let total = 0
    const doneKeys = new Set<string>()
    try {
      await enrichEngagementStream(engagement.id, (e: EnrichStreamEvent) => {
        if (e.type === 'start') {
          total = e.steps.length
          updateTask(taskId, { progress: { done: 0, total } })
          const steps: Record<string, any> = {}
          e.steps.forEach((s) => { steps[s.key] = { label: s.label, status: 'pending' } })
          setPipeline(steps)
          setPipeOrder(e.steps.map((s) => s.key))
        } else if (e.type === 'step') {
          if ((e.status === 'done' || e.status === 'error') && !doneKeys.has(e.key)) {
            doneKeys.add(e.key)
            updateTask(taskId, { progress: { done: doneKeys.size, total } })
          }
          setPipeline((p) => p ? { ...p, [e.key]: { ...p[e.key], status: e.status, progress: e.progress ?? p[e.key].progress } } : p)
        } else if (e.type === 'complete') {
          replaceEngagement(e.engagement)
          showToast('Engajamento enriquecido', 'success')
          void loadCounts()
        } else if (e.type === 'error') {
          showToast(`Falha: ${e.error}`, 'error')
        }
      })
    } catch {
      showToast('Falha ao enriquecer', 'error')
    } finally {
      setLoading(false)
      endTask(taskId)
    }
  }

  // KPIs: usa o maior entre o derivado do enrichment e a contagem real de achados salvos
  const mx = (a: number, b?: number) => Math.max(a || 0, b || 0)
  const k = {
    iocs: mx(sum.kpis.iocs, counts.ioc),
    leaks: mx(sum.kpis.leaks, (counts.leak || 0) + (counts.credential || 0)),
    subdomains: mx(sum.kpis.subdomains, counts.subdomain),
    hosts: mx(sum.kpis.hosts, counts.host),
    emails: mx(sum.kpis.emails, counts.email),
    profiles: mx(sum.kpis.profiles, counts.profile),
    services: counts.service || 0,
    urls: (counts.url || 0) + (counts.endpoint || 0),
  }
  const coverageTotal = Math.max(1, k.iocs + k.leaks + k.subdomains + k.hosts + k.emails + k.profiles + k.services + k.urls)
  const missing = [
    { ok: k.subdomains > 0 || k.hosts > 0, label: 'Mapear superfície externa', tool: engagement.type === 'website' ? 'reconhecimento' : 'subdominios' },
    { ok: k.iocs > 0 || k.leaks > 0, label: 'Cruzar alvo com threat intel e vazamentos', tool: 'hosts' },
    { ok: k.services > 0 || engagement.type !== 'website', label: 'Identificar serviços e tecnologias expostas', tool: 'servicescan' },
    { ok: k.profiles > 0 || engagement.type === 'website', label: 'Validar presença social e perfis relacionados', tool: 'username' },
    { ok: (engagement.evidenceCount ?? 0) > 0, label: 'Anexar evidências do caso', tool: 'evidencias' },
  ].filter(item => !item.ok)

  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', padding: '18px 20px', background: 'var(--hbg)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div className="block hot" style={{ minWidth: 0 }} title={sum.risk.factors.join(' · ') || 'Sem fatores de risco'}>
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bbody" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
            <Gauge score={sum.risk.score} color={sum.risk.color} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>Risco Geral</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: sum.risk.color }}>{sum.risk.band}</div>
            </div>
          </div>
        </div>
        <KpiCell label="IOCs" value={k.iocs} sub="Indicadores" icon={<ShieldAlert size={12} />} />
        <KpiCell label="Vazamentos" value={k.leaks} sub="Fontes" icon={<AlertTriangle size={12} />} />
        <KpiCell label="Subdomínios" value={k.subdomains} sub="Encontrados" icon={<Network size={12} />} />
        <KpiCell label="Hosts / IPs" value={k.hosts} sub="Endereços" icon={<Server size={12} />} />
        <KpiCell label="E-mails" value={k.emails} sub="Encontrados" icon={<Mail size={12} />} />
        {k.profiles > 0 && <KpiCell label="Perfis" value={k.profiles} sub="Encontrados" icon={<AtSign size={12} />} />}
        {k.services > 0 && <KpiCell label="Serviços" value={k.services} sub="Ativos" icon={<Server size={12} />} />}
        {k.urls > 0 && <KpiCell label="URLs / Endpoints" value={k.urls} sub="Descobertos" icon={<Network size={12} />} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, .8fr)', gap: 14, alignItems: 'start' }}>
        <Card title="Matriz CTI / OSINT" icon={<ShieldAlert size={12} />}>
          <CoverageRow label="IOCs" value={k.iocs} total={coverageTotal} onOpen={() => onNavigate?.('indicadores')} />
          <CoverageRow label="Vazamentos" value={k.leaks} total={coverageTotal} onOpen={() => onNavigate?.('vazamentos')} />
          <CoverageRow label="Subdomínios" value={k.subdomains} total={coverageTotal} onOpen={() => onNavigate?.('subdominios')} />
          <CoverageRow label="Hosts" value={k.hosts} total={coverageTotal} onOpen={() => onNavigate?.('hosts')} />
          <CoverageRow label="E-mails" value={k.emails} total={coverageTotal} onOpen={() => onNavigate?.('emails')} />
          <CoverageRow label="Serviços" value={k.services} total={coverageTotal} onOpen={() => onNavigate?.('servicescan')} />
          <CoverageRow label="URLs" value={k.urls} total={coverageTotal} onOpen={() => onNavigate?.('crawler')} />
        </Card>

        <Card title="Lacunas Operacionais" icon={<AlertTriangle size={12} />}
          action={<span className="tag" style={{ fontSize: 9.5 }}>{missing.length ? `${missing.length} abertas` : 'cobertura ok'}</span>}>
          {missing.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--txt-2)' }}>A coleta principal possui indicadores, superfície, evidência e correlação suficientes para análise inicial.</div>
          ) : missing.map(item => (
            <button key={item.label} onClick={() => onNavigate?.(item.tool)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 0', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--line)', textAlign: 'left' }}>
              <ChevronRight size={13} style={{ color: '#f4bc6a', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--htxt)', flex: 1 }}>{item.label}</span>
            </button>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 4 }}>
            <button className="hbtn" onClick={() => onNavigate?.('evidencias')}><FileText size={12} /> Evidência</button>
            <button className="hbtn" onClick={() => onNavigate?.('monitor-mudancas')}><ShieldCheck size={12} /> Monitor</button>
            <button className="hbtn" onClick={() => onNavigate?.('indicadores')}><ShieldAlert size={12} /> Achados</button>
          </div>
        </Card>
      </div>

      {/* 3-col: Exec summary | Auto Enrichment | Timeline+Insights+NextSteps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        {/* Executive summary */}
        <Card title="Resumo Executivo" icon={<FileText size={12} />}>
          <p style={{ fontSize: 12.5, color: 'var(--htxt)', lineHeight: 1.5, marginBottom: 12 }}>{sum.execText}</p>
          {sum.insights.slice(0, 5).map((ins, i) => <InsightRow key={i} ins={ins} />)}
          {sum.ranAt && <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginTop: 10 }}>Última atualização: {new Date(sum.ranAt).toLocaleString('pt-BR')}</div>}
        </Card>

        {/* Auto enrichment */}
        <Card title="Auto Enrichment" icon={<Sparkles size={12} />}
          action={
            <button className="hbtn" onClick={run} disabled={loading} style={{ fontSize: 11, height: 24, background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)' }}>
              {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
              {loading ? 'Rodando' : hasData ? 'Reexecutar' : 'Executar'}
            </button>
          }>
          {pipeline ? (
            pipeOrder.map((key) => {
              const st = pipeline[key]
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                  <StepIcon status={st.status} />
                  <span style={{ fontSize: 12, flex: 1, color: st.status === 'pending' ? 'var(--txt-3)' : 'var(--htxt)' }}>{st.label}</span>
                  {st.progress && st.status === 'running' && (
                    <span style={{ fontSize: 10, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace" }}>{Math.round((st.progress.checked / st.progress.total) * 100)}%</span>
                  )}
                  {st.status === 'done' && <CheckCircle2 size={12} style={{ color: 'var(--up)' }} />}
                  {st.status === 'error' && <span style={{ fontSize: 10, color: 'var(--down)' }}>falhou</span>}
                </div>
              )
            })
          ) : hasData ? (
            sum.integrations.map((it) => (
              <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                {it.ran ? <CheckCircle2 size={13} style={{ color: 'var(--up)' }} /> : <Circle size={13} style={{ color: 'var(--txt-3)', opacity: 0.5 }} />}
                <span style={{ fontSize: 12, flex: 1, color: it.ran ? 'var(--htxt)' : 'var(--txt-3)' }}>{it.label}</span>
                <span style={{ fontSize: 11, color: it.ran ? 'var(--up)' : 'var(--txt-3)' }}>{it.ran ? 'Concluído' : '—'}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--txt-3)' }}>Nenhuma execução ainda. Clique em “Executar”.</div>
          )}
        </Card>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Insights" icon={<Lightbulb size={12} />}>
            {sum.insights.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>Rode o enriquecimento para gerar insights.</div>
            ) : sum.insights.map((ins, i) => <InsightRow key={i} ins={ins} />)}
          </Card>

          <Card title="Próximos Passos" icon={<ListChecks size={12} />}>
            {sum.nextSteps.map((ns: NextStep) => (
              <button key={ns.tool + ns.label} onClick={() => onNavigate?.(ns.tool)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 0', background: 'transparent', border: 'none', borderBottom: '0.5px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}>
                <ChevronRight size={13} style={{ color: '#7f77dd', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--htxt)', flex: 1 }}>{ns.label}</span>
                <span className="tag" style={{ fontSize: 9.5, color: 'var(--txt-3)' }}>{ns.cat}</span>
              </button>
            ))}
          </Card>
        </div>
      </div>

      {/* Correlações automáticas (Correlation Engine) */}
      {(() => {
        const correlations: any[] = (engagement as any).enrichment?.correlations ?? []
        if (!correlations.length) return null
        return (
          <Card title={`Correlações (${correlations.length})`} icon={<Network size={12} />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {correlations.map((h) => {
                const v = h.threatIntel?.verdict
                const col = v === 'malicious' ? 'var(--down)' : v === 'suspicious' ? '#f4bc6a' : 'var(--up)'
                return (
                  <div key={h.ip} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,.02)', border: '1px solid var(--line-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Server size={13} style={{ color: '#8a9cff' }} />
                      <span style={{ fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--htxt)' }}>{h.ip}</span>
                      {v && <span className="tag" style={{ fontSize: 9, marginLeft: 'auto', color: col, borderColor: `${col}55`, background: `${col}1a`, textTransform: 'uppercase' }}>{v}</span>}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>← {h.from}</div>
                    {h.asn?.asn && <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginTop: 2 }}>AS{h.asn.asn} {h.asn.org ?? ''}</div>}
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })()}

      {/* Correlação de ameaças (Threat Feeds: KEV + IOCs) */}
      {(() => {
        const enr: any = (engagement as any).enrichment ?? {}
        const feedMatches: any[] = enr.feedMatches ?? []
        const techMatches: any[] = enr.techMatches ?? []
        if (!feedMatches.length && !techMatches.length) return null
        return (
          <Card title="Correlação de Ameaças" icon={<ShieldAlert size={12} />}>
            {techMatches.map((t) => (
              <div key={`t-${t.tech}`} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--line)' }}>
                <div style={{ fontSize: 12.5, color: 'var(--htxt)', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{t.tech}</span> — {t.cves.length} CVE(s)
                  {t.cves.filter((c: any) => c.kev).length > 0 && <span className="tag" style={{ marginLeft: 6, fontSize: 9, color: '#f4bc6a', borderColor: '#f4bc6a55', background: 'rgba(244,188,106,.12)' }}>{t.cves.filter((c: any) => c.kev).length} KEV</span>}
                  {t.cves.some((c: any) => c.ransomware) && <span className="tag" style={{ marginLeft: 4, fontSize: 9, color: 'var(--down)', borderColor: 'var(--down)', background: 'rgba(226,75,74,.12)' }}>RANSOMWARE</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {t.cves.slice(0, 12).map((c: any) => (
                    <a key={c.cveID} href={`https://nvd.nist.gov/vuln/detail/${c.cveID}`} target="_blank" rel="noreferrer" className="tag" style={{ fontSize: 9.5, textDecoration: 'none', color: c.ransomware ? 'var(--down)' : c.kev ? '#f4bc6a' : 'var(--htxt)' }} title={c.score ? `CVSS ${c.score}` : undefined}>{c.cveID}{c.score ? ` (${c.score})` : ''}</a>
                  ))}
                </div>
              </div>
            ))}
            {feedMatches.map((f) => (
              <div key={`f-${f.indicator}`} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--line)' }}>
                <div style={{ fontSize: 12, color: 'var(--htxt)', marginBottom: 4 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#7ab8f0' }}>{f.indicator}</span> em {f.hits.length} feed(s)
                </div>
                {f.hits.slice(0, 5).map((h: any, i: number) => (
                  <div key={i} style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>· {h.source}: {h.title.slice(0, 70)}</div>
                ))}
              </div>
            ))}
          </Card>
        )
      })()}

      {/* Timeline da investigação em tempo real (centro da investigação) */}
      <InvestigationTimeline engagementId={engagement.id} />

      {/* Targets selector */}
      {hasData && (
        <Card title={`Alvos (${targets.length})`} icon={<Globe size={12} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {targets.map((t: any, i: number) => {
              const meta = KIND_META[t.kind] ?? KIND_META.unknown
              const active = i === selected
              return (
                <button key={i} onClick={() => setSelected(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: active ? `${meta.color}1a` : 'rgba(255,255,255,.02)', border: `1px solid ${active ? meta.color + '66' : 'var(--line-2)'}` }}>
                  <meta.Icon size={16} style={{ color: meta.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--htxt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.value}</span>
                  <span className="tag" style={{ fontSize: 9.5, color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}1a` }}>{meta.label}</span>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Selected target detail */}
      {hasData && targets[selected] && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--txt-3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChevronRight size={13} /> Visão geral do alvo: <span style={{ color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace" }}>{targets[selected].value}</span>
          </div>
          <TargetCards t={targets[selected]} />
        </div>
      )}
    </div>
  )
}
