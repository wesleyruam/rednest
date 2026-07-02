import { useEffect, useMemo, useState } from 'react'
import {
  Search, Loader2, AlertTriangle, ShieldCheck, ShieldAlert, ShieldX,
  Globe, Server, Network, Activity, Clock, FileSearch, Copy,
  Mail, AtSign, Flag, CheckCircle, Trash2, ChevronRight, Plus, X, Check, User,
} from 'lucide-react'
import {
  enrichIp, enrichDomain, enrichCve, enrichAsn, enrichWhois,
  enrichSubdomains, enrichWayback, checkHost, detectKind,
  hunterDomain, godaddyCreateAbuse,
  gravatar, hunterEmail, holehe, leaklookup, comb,
  whatsMyNameStream, type WmnHit, type WmnResult, serviceScan,
  contentDiscoveryStream, type ContentDiscoveryEvent, type ContentDiscoveryResult,
  crawlerStream, type CrawlEvent, type CrawlResult,
  captureScreenshot, type ShotResult,
  domainAttribution, type AttributionResult,
} from '@/services/integrations'
import { geoCheck, type GeoCheckResult } from '@/services/proxies'
import { ApiError } from '@/lib/api'
import { ingestFindings, listFindings, deleteFinding, addFinding, type Finding } from '@/services/findings'
import { useUIStore } from '@/store/ui'

// Rótulos amigáveis p/ as chaves de `data` dos achados.
const FINDING_DATA_LABELS: Record<string, string> = {
  registrar: 'Registrador', registrarId: 'IANA ID', abuseEmail: 'E-mail de abuso',
  created: 'Registrado em', expires: 'Expira em', updated: 'Atualizado em',
  nameservers: 'Nameservers', status: 'Status do domínio', registrant: 'Registrante',
  hostname: 'Hostname (rDNS)', asn: 'ASN', org: 'Organização', country: 'País',
  region: 'Região', city: 'Cidade', loc: 'Coordenadas', postal: 'CEP', timezone: 'Fuso horário',
  title: 'Título', finalUrl: 'URL final', verdict: 'Veredito', score: 'Score',
  technologies: 'Tecnologias', server: 'Servidor', vendor: 'Fabricante', product: 'Produto',
}

function fmtFindingValue(v: any): string | null {
  if (v == null || v === '') return null
  if (Array.isArray(v)) return v.length ? v.join(', ') : null
  if (typeof v === 'object') {
    const parts = Object.entries(v).filter(([, x]) => x != null && x !== '').map(([k, x]) => `${k}: ${x}`)
    return parts.length ? parts.join(' · ') : null
  }
  return String(v)
}

/** Detalhes completos de um achado (tudo que foi coletado). */
function FindingDetails({ f }: { f: Finding }) {
  const data = (f.data ?? {}) as Record<string, any>
  const shot = data.screenshot as string | undefined
  const entries = Object.entries(data).filter(([k, v]) => k !== 'screenshot' && fmtFindingValue(v) != null)
  return (
    <div style={{ padding: '8px 0 4px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {f.source && <Field k="Fonte" v={f.source} />}
      {f.target && <Field k="Vínculo" v={f.target} mono />}
      {f.severity && <Field k="Severidade" v={f.severity} />}
      {entries.map(([k, v]) => <Field key={k} k={FINDING_DATA_LABELS[k] ?? k} v={fmtFindingValue(v)} mono={['hostname', 'asn', 'loc', 'finalUrl', 'abuseEmail', 'registrarId'].includes(k)} />)}
      <Field k="Coletado em" v={new Date(f.createdAt).toLocaleString('pt-BR')} />
      {shot && (
        <a href={shot} target="_blank" rel="noreferrer" style={{ marginTop: 6, display: 'block' }}>
          <img src={shot} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, border: '1px solid var(--line-2)' }} />
        </a>
      )}
      {entries.length === 0 && !shot && !f.source && <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>Sem detalhes adicionais.</span>}
    </div>
  )
}

/** Achados já coletados desta categoria — expansíveis, mostram TUDO que foi coletado. */
export function SavedFindings({ eid, types, refreshKey = 0 }: { eid?: string; types: string[]; refreshKey?: number }) {
  const [items, setItems] = useState<Finding[]>([])
  const [open, setOpen] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!eid) return
    Promise.all(types.map(t => listFindings(eid, t)))
      .then(all => setItems(all.flat().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))))
      .catch(() => setItems([]))
  }, [eid, types.join(','), refreshKey])
  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allOpen = items.length > 0 && expanded.size === items.length
  if (!eid || items.length === 0) return null
  return (
    <div className="block hot" style={{ marginBottom: 12 }}>
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => setOpen(v => !v)}>Já coletado ({items.length})</span>
        <span style={{ fontSize: 10.5, color: 'var(--txt-3)', cursor: 'pointer' }} onClick={() => setExpanded(allOpen ? new Set() : new Set(items.map(i => i.id)))}>{allOpen ? 'recolher tudo' : 'expandir tudo'}</span>
        <span style={{ fontSize: 10.5, color: 'var(--txt-3)', cursor: 'pointer' }} onClick={() => setOpen(v => !v)}>{open ? 'ocultar' : 'mostrar'}</span>
      </div>
      {open && (
        <div className="bbody">
          {items.slice(0, 200).map(f => {
            const isOpen = expanded.has(f.id)
            return (
              <div key={f.id} style={{ borderBottom: '0.5px solid var(--line)' }}>
                <div onClick={() => toggle(f.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: 11.5, cursor: 'pointer' }}>
                  <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--txt-3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                  <span className="tag" style={{ fontSize: 8.5, flexShrink: 0 }}>{f.type}</span>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label ? `${f.label} · ` : ''}{f.value}</span>
                </div>
                {isOpen && <div style={{ paddingLeft: 20 }}><FindingDetails f={f} /></div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="hud" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 20px', background: 'var(--hbg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {children}
    </div>
  )
}

function Panel({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="block hot">
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}<span style={{ flex: 1 }}>{title}</span>{action}
      </div>
      <div className="bbody">{children}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,.04)',
  border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--htxt)',
  fontSize: 12.5, outline: 'none', fontFamily: "'JetBrains Mono', monospace",
}

/** Quebra "a, b c" em ["a","b","c"] (vírgula/espaço/;). */
export function parseTargets(s: string): string[] {
  return [...new Set((s || '').split(/[\s,;]+/).map(t => t.trim()).filter(Boolean))]
}
/** Escolhe o melhor alvo inicial: 1º que casa com algum tipo desejado, senão o 1º. */
function pickTarget(s: string, kinds: string[]): string {
  const ts = parseTargets(s)
  return ts.find(t => kinds.includes(detectKind(t))) ?? ts[0] ?? s
}

/** Chips dos múltiplos alvos — clicar seleciona qual usar no input. */
function TargetChips({ all, value, onPick }: { all: string[]; value: string; onPick: (v: string) => void }) {
  if (all.length <= 1) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      <span style={{ fontSize: 10.5, color: 'var(--txt-3)', alignSelf: 'center' }}>Alvos:</span>
      {all.map(t => {
        const active = t === value
        return (
          <button key={t} onClick={() => onPick(t)} className="hbtn" style={{
            fontSize: 10.5, height: 22, fontFamily: "'JetBrains Mono', monospace",
            background: active ? 'rgba(var(--accent-rgb),.2)' : undefined,
            borderColor: active ? 'rgba(var(--accent-rgb),.5)' : undefined,
            color: active ? 'var(--htxt)' : undefined,
          }}>{t}</button>
        )
      })}
    </div>
  )
}

function RunBar({ value, setValue, onRun, loading, placeholder, all }: {
  value: string; setValue: (v: string) => void; onRun: () => void; loading: boolean; placeholder?: string; all?: string[]
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {all && <TargetChips all={all} value={value} onPick={setValue} />}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder}
          style={inputStyle}
          onKeyDown={e => e.key === 'Enter' && !loading && onRun()}
        />
        <button className="hbtn" onClick={onRun} disabled={loading}
          style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)', minWidth: 96, justifyContent: 'center' }}>
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
          {loading ? 'Consultando' : 'Consultar'}
        </button>
      </div>
    </div>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(240,71,106,.1)', border: '1px solid rgba(240,71,106,.3)' }}>
      <AlertTriangle size={13} style={{ color: 'var(--down)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--down)' }}>{msg}</span>
    </div>
  )
}

function Field({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '0.5px solid var(--line)' }}>
      <span style={{ fontSize: 12, color: 'var(--txt-3)', flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: mono ? 11.5 : 12.5, color: 'var(--htxt)', textAlign: 'right', fontFamily: mono ? "'JetBrains Mono', monospace" : undefined, wordBreak: 'break-all' }}>{v ?? '—'}</span>
    </div>
  )
}

function useRun<T>(fn: (arg: string) => Promise<T>, label?: string, ingest?: { eid?: string; tool: string }) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (arg: string) => {
    if (!arg.trim()) return
    setLoading(true); setError(null)
    const taskId = label ? useUIStore.getState().startTask(`${label}: ${arg.trim()}`) : null
    try {
      const res = await fn(arg.trim())
      setData(res)
      if (ingest?.eid) {
        ingestFindings(ingest.eid, ingest.tool, arg.trim(), res).catch((err) => {
          const msg = err instanceof ApiError ? err.message : 'falha ao salvar'
          useUIStore.getState().showToast(`Resultado não salvo: ${msg}`, 'error')
        })
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha na consulta.')
      setData(null)
    } finally {
      setLoading(false)
      if (taskId) useUIStore.getState().endTask(taskId)
    }
  }
  return { data, loading, error, run }
}

// ─── Threat Intel (IP ou domínio) ──────────────────────────────────────────────

function VerdictBadge({ verdict, score }: { verdict: string; score: number }) {
  const cfg = verdict === 'malicious'
    ? { c: 'var(--down)', bg: 'rgba(240,71,106,.12)', Icon: ShieldX, label: 'Malicioso' }
    : verdict === 'suspicious'
    ? { c: 'var(--med)', bg: 'rgba(224,179,65,.12)', Icon: ShieldAlert, label: 'Suspeito' }
    : { c: 'var(--up)', bg: 'rgba(52,210,123,.12)', Icon: ShieldCheck, label: 'Limpo' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 9, background: cfg.bg, border: `1px solid ${cfg.c}40` }}>
      <cfg.Icon size={18} style={{ color: cfg.c }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: cfg.c }}>{cfg.label}</div>
        <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>Score agregado: {score}/100</div>
      </div>
    </div>
  )
}

function ProviderCard({ name, children, data }: { name: string; children?: React.ReactNode; data: any }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,.025)', border: '0.5px solid var(--line)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--htxt)', marginBottom: 6 }}>{name}</div>
      {data?.configured === false
        ? <div style={{ fontSize: 11.5, color: 'var(--med)' }}>Chave não configurada</div>
        : data?.error
        ? <div style={{ fontSize: 11.5, color: 'var(--down)' }}>{String(data.error)}</div>
        : children}
    </div>
  )
}

export function ThreatIntelPanel({ initial, auto, eid }: { initial: string; auto?: boolean; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['ip', 'domain']))
  const { data, loading, error, run } = useRun<any>((v) =>
    detectKind(v) === 'ip' ? enrichIp(v) : enrichDomain(v),
    'Threat Intel', { eid, tool: 'hosts' },
  )
  useEffect(() => { if (auto && initial.trim()) run(initial) }, [])
  return (
    <Wrap>
      <Panel title="Threat Intelligence" icon={<ShieldAlert size={13} />}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="IP ou domínio" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <VerdictBadge verdict={data.verdict} score={data.score} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {data.abuseipdb && (
                <ProviderCard name="AbuseIPDB" data={data.abuseipdb}>
                  <Field k="Score" v={`${data.abuseipdb.score ?? 0}%`} />
                  <Field k="Denúncias" v={data.abuseipdb.reports} />
                  <Field k="ISP" v={data.abuseipdb.isp} />
                  <Field k="País" v={data.abuseipdb.country} />
                </ProviderCard>
              )}
              <ProviderCard name="VirusTotal" data={data.virustotal}>
                <Field k="Maliciosos" v={data.virustotal?.malicious} />
                <Field k="Suspeitos" v={data.virustotal?.suspicious} />
                <Field k="Inofensivos" v={data.virustotal?.harmless} />
                <Field k="Reputação" v={data.virustotal?.reputation} />
              </ProviderCard>
              <ProviderCard name="AlienVault OTX" data={data.otx}>
                <Field k="Pulses" v={data.otx?.pulses} />
                {(data.otx?.pulse_names ?? []).slice(0, 3).map((n: string, i: number) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 3 }}>• {n}</div>
                ))}
              </ProviderCard>
              <ProviderCard name="ThreatFox" data={data.threatfox}>
                <Field k="Matches" v={data.threatfox?.n} />
                <Field k="Exatos" v={data.threatfox?.exact} />
                {(data.threatfox?.matches ?? []).slice(0, 2).map((m: any, i: number) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 3 }}>• {m.malware} ({m.threat_type})</div>
                ))}
              </ProviderCard>
              {data.censys && (
                <ProviderCard name="Censys" data={data.censys}>
                  <Field k="ASN" v={data.censys.asn} />
                  <Field k="Org" v={data.censys.org || data.censys.asn_name} />
                  <Field k="Serviços" v={data.censys.service_count} />
                  <Field k="País" v={data.censys.country} />
                </ProviderCard>
              )}
            </div>
          </div>
        )}
      </Panel>
    </Wrap>
  )
}

// ─── WHOIS / DNS ────────────────────────────────────────────────────────────────

export function WhoisPanel({ initial, auto, eid }: { initial: string; auto?: boolean; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain']))
  const { data, loading, error, run } = useRun<any>(enrichWhois, 'WHOIS/DNS', { eid, tool: 'whois' })
  useEffect(() => { if (auto && initial.trim()) run(initial) }, [])
  const dns = data?.dns ?? {}
  return (
    <Wrap>
      <Panel title="WHOIS / DNS" icon={<Globe size={13} />}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="domínio" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
        {data && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Registro</div>
              <Field k="Registrador" v={data.registrar} />
              <Field k="Criado" v={data.created} />
              <Field k="Expira" v={data.expires} />
              <Field k="Atualizado" v={data.updated} />
              <Field k="Nameservers" v={(data.nameservers ?? []).join(', ') || '—'} mono />
              <Field k="Status" v={(data.status ?? []).join(', ') || '—'} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Registros DNS</div>
              {['A', 'AAAA', 'NS', 'MX', 'TXT'].map(rt => (
                (dns[rt] ?? []).length > 0 && <Field key={rt} k={rt} v={(dns[rt] ?? []).join(', ')} mono />
              ))}
            </div>
          </div>
        )}
      </Panel>
    </Wrap>
  )
}

// ─── Subdomínios ────────────────────────────────────────────────────────────────

export function SubdomainsPanel({ initial, eid }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain']))
  const { showToast } = useUIStore()
  const { data, loading, error, run } = useRun<any>(enrichSubdomains, 'Subdomínios', { eid, tool: 'subdominios' })
  return (
    <Wrap>
      <Panel title="Subdomínios (passivo)" icon={<Network size={13} />}
        action={data && <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{data.names.length} encontrados · {(data.sources_ok ?? []).join(', ')}</span>}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="domínio" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
        {data && (data.names.length === 0
          ? <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--txt-3)' }}>Nenhum subdomínio encontrado.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {data.names.map((n: string) => (
                <div key={n} className="rowi" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '0.5px solid var(--line)' }}>
                  <Globe size={11} style={{ color: 'var(--txt-3)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--htxt)' }}>{n}</span>
                  <button className="hbtn" style={{ width: 26, height: 24, padding: 0, justifyContent: 'center' }} onClick={() => { navigator.clipboard.writeText(n); showToast('Copiado', 'success') }}><Copy size={11} /></button>
                </div>
              ))}
            </div>
        )}
      </Panel>
      <SavedFindings eid={eid} types={['subdomain']} />
    </Wrap>
  )
}

// ─── ASN ────────────────────────────────────────────────────────────────────────

export function AsnPanel({ initial, eid }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['ip']))
  const { data, loading, error, run } = useRun<any>(enrichAsn, 'ASN', { eid, tool: 'asn' })
  return (
    <Wrap>
      <Panel title="ASN / Roteamento" icon={<Network size={13} />}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="endereço IP" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
        {data && (data.found === false
          ? <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>Sem dados de ASN.</div>
          : <div>
              <Field k="ASN" v={data.asn ? `AS${data.asn}` : '—'} mono />
              <Field k="Organização" v={data.org} />
              <Field k="Prefixo BGP" v={data.prefix} mono />
              <Field k="País" v={data.country} />
              <Field k="Cidade" v={data.city} />
            </div>
        )}
      </Panel>
    </Wrap>
  )
}

// ─── Check-Host ──────────────────────────────────────────────────────────────────

export function CheckHostPanel({ initial, defaultKind = 'ping' }: { initial: string; defaultKind?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain', 'ip']))
  const [kind, setKind] = useState(defaultKind)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async () => {
    if (!value.trim()) return
    setLoading(true); setError(null)
    const taskId = useUIStore.getState().startTask(`Check-Host (${kind}): ${value.trim()}`)
    try { setData(await checkHost(value.trim(), kind, 12)) }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Falha.'); setData(null) }
    finally { setLoading(false); useUIStore.getState().endTask(taskId) }
  }
  return (
    <Wrap>
      <Panel title="Check-Host (checagem distribuída)" icon={<Activity size={13} />}
        action={data && !data.error && <span style={{ fontSize: 11, color: 'var(--up)' }}>{data.reachable}/{data.total} nós alcançaram</span>}>
        <TargetChips all={parseTargets(initial)} value={value} onPick={setValue} />
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
          <input value={value} onChange={e => setValue(e.target.value)} placeholder="host / IP" style={inputStyle} onKeyDown={e => e.key === 'Enter' && !loading && run()} />
          <select value={kind} onChange={e => setKind(e.target.value)} style={{ ...inputStyle, flex: '0 0 90px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {['ping', 'http', 'tcp', 'dns'].map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <button className="hbtn" onClick={run} disabled={loading} style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)', minWidth: 96, justifyContent: 'center' }}>
            {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}{loading ? 'Checando' : 'Checar'}
          </button>
        </div>
        {error && <ErrBox msg={error} />}
        {data?.error && <ErrBox msg={data.error} />}
        {data && !data.error && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(data.nodes ?? []).map((n: any, i: number) => (
              <div key={i} className="rowi" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px', borderBottom: '0.5px solid var(--line)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: n.ok ? 'var(--up)' : 'var(--down)' }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--htxt)' }}>{n.country} <span style={{ color: 'var(--txt-3)' }}>{n.city}</span></span>
                <span style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: n.ok ? 'var(--up)' : 'var(--down)' }}>
                  {n.ok ? (n.ms != null ? `${n.ms} ms` : 'OK') : 'falhou'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </Wrap>
  )
}

// ─── Wayback ─────────────────────────────────────────────────────────────────────

export function WaybackPanel({ initial, eid }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain']))
  const { data, loading, error, run } = useRun<any>(enrichWayback, 'Wayback Machine', { eid, tool: 'wayback' })
  const urls = (data?.urls ?? []) as Array<{ url: string; status: string | null; mime: string | null }>
  return (
    <Wrap>
      <Panel title="Wayback Machine" icon={<Clock size={13} />}
        action={data && <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{urls.length} URLs arquivadas</span>}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="domínio" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
        {data && (urls.length === 0
          ? <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--txt-3)' }}>Nada arquivado.</div>
          : <div style={{ display: 'flex', flexDirection: 'column' }}>
              {urls.slice(0, 300).map((u, i) => (
                <div key={i} className="rowi" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', borderBottom: '0.5px solid var(--line)' }}>
                  <span style={{ flex: 1, fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: 'var(--htxt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.url}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>{u.status}</span>
                </div>
              ))}
              {urls.length > 300 && <div style={{ fontSize: 11, color: 'var(--txt-3)', padding: '8px 4px' }}>+{urls.length - 300} mais…</div>}
            </div>
        )}
      </Panel>
    </Wrap>
  )
}

// ─── CVE ─────────────────────────────────────────────────────────────────────────

export function CvePanel({ initial, auto, eid }: { initial: string; auto?: boolean; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['cve']))
  const { data, loading, error, run } = useRun<any>(enrichCve, 'CVE', { eid, tool: 'cve' })
  useEffect(() => { if (auto && initial.trim()) run(initial) }, [])
  const cvssColor = (s: number) => s >= 9 ? 'var(--down)' : s >= 7 ? '#e85d30' : s >= 4 ? 'var(--med)' : 'var(--up)'
  return (
    <Wrap>
      <Panel title="Detalhes de CVE" icon={<FileSearch size={13} />}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="CVE-AAAA-NNNN" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
        {data && (data.found === false
          ? <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>CVE não encontrada.</div>
          : <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                {data.cvss != null && (
                  <span style={{ fontSize: 22, fontWeight: 800, color: cvssColor(data.cvss), fontFamily: "'Space Grotesk', sans-serif" }}>CVSS {data.cvss}</span>
                )}
                {data.cwe && <span className="tag">{data.cwe}</span>}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--txt-2)', lineHeight: 1.6, margin: '0 0 10px' }}>{data.description || 'Sem descrição.'}</p>
              {(data.references ?? []).slice(0, 8).map((r: string, i: number) => (
                <a key={i} href={r} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 11.5, color: 'rgba(var(--accent-rgb),1)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r}</a>
              ))}
            </div>
        )}
      </Panel>
    </Wrap>
  )
}

// ─── E-mail Intel (agregado) ────────────────────────────────────────────────────

// ── E-mails & Usuários: lista + Consultar/Adicionar (popups) ────────────────────

function PopupModal({ title, onClose, children, width }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="hud" onClick={e => e.stopPropagation()} style={{ width: width ?? 560, maxWidth: '94vw', maxHeight: '88vh', overflow: 'auto', background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 12, boxShadow: '0 20px 60px -20px #000' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--htxt)' }}>{title}</span>
          <X size={15} style={{ marginLeft: 'auto', cursor: 'pointer', color: 'var(--txt-3)' }} onClick={onClose} />
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  )
}

function renderSource(k: string, d: any): React.ReactNode {
  if (k === 'gravatar') return d?.found === false ? 'Sem perfil público' : `${d?.displayName ?? 'Perfil encontrado'}${d?.location ? ' · ' + d.location : ''}${(d?.verifiedAccounts ?? []).length ? ' · ' + d.verifiedAccounts.length + ' contas' : ''}`
  if (k === 'hunter') return `${d?.result ?? '—'}${d?.score != null ? ' · ' + d.score + '%' : ''}`
  if (k === 'holehe') return `${d?.used ?? 0} site(s)${(d?.sites ?? []).length ? ': ' + d.sites.slice(0, 6).join(', ') + (d.sites.length > 6 ? '…' : '') : ''}`
  if (k === 'leaklookup') return `${d?.n ?? 0} fonte(s) de vazamento`
  if (k === 'comb') return `${d?.count ?? 0} vazamento(s)${(d?.records ?? []).length ? ' · ' + d.records.length + ' cred(s)' : ''}`
  return '—'
}

const SRC_LABEL: Record<string, string> = { gravatar: 'Gravatar', hunter: 'Hunter (verificação)', holehe: 'holehe (contas)', leaklookup: 'Leak-Lookup', comb: 'COMB (credenciais)' }

function AddIdentityModal({ eid, onClose, onSaved }: { eid?: string; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useUIStore()
  const [type, setType] = useState<'email' | 'username'>('email')
  const [value, setValue] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    const v = value.trim(); if (!v || !eid) return
    setBusy(true)
    try { await addFinding(eid, { type, value: v, note: desc.trim() || undefined }); showToast('Adicionado', 'success'); onSaved() }
    catch { showToast('Falha ao adicionar', 'error') } finally { setBusy(false) }
  }
  return (
    <PopupModal title="Adicionar e-mail / usuário" onClose={onClose} width={480}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['email', 'username'] as const).map(t => (
          <button key={t} onClick={() => setType(t)} className="hbtn" style={{ flex: 1, justifyContent: 'center', background: type === t ? 'rgba(var(--accent-rgb),.2)' : undefined }}>{t === 'email' ? 'E-mail' : 'Usuário'}</button>
        ))}
      </div>
      <input autoFocus style={{ ...inputStyle, width: '100%', display: 'block', boxSizing: 'border-box', marginBottom: 10 }} placeholder={type === 'email' ? 'alvo@exemplo.com' : '@usuario'} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
      <textarea style={{ ...inputStyle, width: '100%', display: 'block', boxSizing: 'border-box', minHeight: 84, resize: 'vertical', marginBottom: 12, fontFamily: 'inherit' }} placeholder="Descrição sobre este e-mail/usuário (quem é, contexto, origem…)" value={desc} onChange={e => setDesc(e.target.value)} />
      <button className="hbtn" disabled={busy || !value.trim()} onClick={save} style={{ width: '100%', justifyContent: 'center', background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)', height: 34 }}>
        {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />} Adicionar
      </button>
    </PopupModal>
  )
}

function ConsultModal({ eid, initialValue, saved, onClose, onSaved }: { eid?: string; initialValue: string; saved: Finding[]; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useUIStore()
  const [value, setValue] = useState(initialValue)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [src, setSrc] = useState<Record<string, { status: 'running' | 'done' | 'error'; data?: any; error?: string }>>({})
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const isEmail = value.includes('@')
  const SOURCES = isEmail ? ['gravatar', 'hunter', 'holehe', 'leaklookup', 'comb'] : ['leaklookup', 'comb']
  const isSaved = !!value.trim() && saved.some(s => s.value.toLowerCase() === value.trim().toLowerCase())

  async function consult() {
    const v = value.trim(); if (!v) return
    setRunning(true); setDone(false); setSel({})
    setSrc(Object.fromEntries(SOURCES.map(s => [s, { status: 'running' as const }])))
    const calls: Record<string, Promise<any>> = isEmail
      ? { gravatar: gravatar(v), hunter: hunterEmail(v), holehe: holehe(v), leaklookup: leaklookup(v, 'email_address'), comb: comb(v) }
      : { leaklookup: leaklookup(v, 'username'), comb: comb(v) }
    await Promise.all(Object.entries(calls).map(([k, p]) =>
      p.then(d => setSrc(s => ({ ...s, [k]: { status: 'done', data: d } })))
        .catch(e => setSrc(s => ({ ...s, [k]: { status: 'error', error: e instanceof ApiError ? e.message : 'falha' } })))
    ))
    setRunning(false); setDone(true)
  }

  const g = src.gravatar?.data, h = src.hunter?.data, ll = src.leaklookup?.data, cb = src.comb?.data
  const leakTotal = (ll?.n ?? 0) + (cb?.count ?? 0)
  const savable = useMemo(() => {
    if (!done) return [] as { id: string; label: string; run: () => Promise<any> }[]
    const v = value.trim()
    const items: { id: string; label: string; run: () => Promise<any> }[] = []
    // só oferece adicionar o próprio e-mail/usuário se ele ainda não estiver salvo
    if (!isSaved) items.push({ id: 'self', label: `${isEmail ? 'E-mail' : 'Usuário'}: ${v}`, run: () => addFinding(eid!, { type: isEmail ? 'email' : 'username', value: v, note: h?.result ? `Hunter: ${h.result}` : undefined }) })
    if (g?.found) items.push({ id: 'gravatar', label: `Perfil Gravatar${g.displayName ? ` (${g.displayName})` : ''}`, run: () => addFinding(eid!, { type: 'profile', label: 'Gravatar', value: `Gravatar: ${g.profileUrl ?? v}`, url: g.profileUrl }) })
    if (leakTotal) items.push({ id: 'leak', label: `Vazamentos (${leakTotal} fonte(s))`, run: () => addFinding(eid!, { type: 'leak', value: `${v} (${leakTotal})`, label: v, severity: 'medium' }) })
    if (cb?.records?.length) items.push({ id: 'creds', label: `Credenciais COMB (${cb.records.length})`, run: async () => { for (const r of cb.records) if (r.email) await addFinding(eid!, { type: 'credential', value: `${r.email}:${r.passwordMasked ?? ''}`, label: r.email }) } })
    return items
  }, [done, g, h, ll, cb, value, isSaved])
  useEffect(() => { if (done) setSel(Object.fromEntries(savable.map(i => [i.id, true]))) }, [done, savable.length])

  async function saveSelected() {
    if (!eid) return
    setSaving(true)
    try { for (const it of savable) if (sel[it.id] !== false) await it.run(); showToast('Dados adicionados ao engajamento', 'success'); onSaved(); onClose() }
    catch { showToast('Falha ao salvar', 'error') } finally { setSaving(false) }
  }

  return (
    <PopupModal title="Consultar e-mail / usuário" onClose={onClose} width={700}>
      {saved.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginBottom: 5 }}>Escolher um salvo:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {saved.slice(0, 12).map(s => (
              <button key={s.id} className="hbtn" style={{ fontSize: 10.5, height: 22, background: value === s.value ? 'rgba(var(--accent-rgb),.2)' : undefined }} onClick={() => { setValue(s.value); setDone(false); setSrc({}) }}>{s.value}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input autoFocus style={inputStyle} placeholder="e-mail ou usuário novo…" value={value} onChange={e => { setValue(e.target.value); setDone(false) }} onKeyDown={e => e.key === 'Enter' && !running && consult()} />
        <button className="hbtn" onClick={consult} disabled={running || !value.trim()} style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)', minWidth: 118, justifyContent: 'center' }}>
          {running ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />} {running ? 'Consultando' : 'Consultar'}
        </button>
      </div>

      {value.trim() && !isSaved && (
        <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          Alvo novo (não salvo).
          <button className="hbtn" style={{ height: 22, fontSize: 10.5 }} onClick={async () => { if (!eid) return; await addFinding(eid, { type: isEmail ? 'email' : 'username', value: value.trim() }); showToast('Adicionado', 'success'); onSaved() }}>
            <Plus size={11} /> Adicionar como {isEmail ? 'e-mail' : 'usuário'}
          </button>
        </div>
      )}

      {(running || done) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8, marginTop: 12 }}>
          {SOURCES.map(k => {
            const st = src[k]
            return (
              <div key={k} className="block hot">
                <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
                <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {st?.status === 'running' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite', color: '#a9a4ee' }} /> : st?.status === 'done' ? <Check size={12} style={{ color: 'var(--up)' }} /> : st?.status === 'error' ? <X size={11} style={{ color: 'var(--down)' }} /> : <Clock size={11} style={{ color: 'var(--txt-3)' }} />}
                  <span style={{ fontSize: 10.5 }}>{SRC_LABEL[k] ?? k}</span>
                </div>
                <div className="bbody" style={{ fontSize: 11, color: 'var(--txt-2)', minHeight: 22 }}>
                  {st?.status === 'error' ? <span style={{ color: 'var(--down)' }}>{st.error}</span>
                    : st?.status !== 'done' ? <span style={{ color: 'var(--txt-3)' }}>consultando…</span>
                      : renderSource(k, st.data)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {done && savable.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--htxt)' }}>Adicionar ao engajamento?</div>
          <div style={{ fontSize: 11, color: 'var(--txt-3)', margin: '4px 0 8px' }}>Marque só o que faz sentido salvar.</div>
          {savable.map(it => (
            <label key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: 'var(--htxt)', cursor: 'pointer' }}>
              <input type="checkbox" checked={sel[it.id] !== false} onChange={e => setSel(s => ({ ...s, [it.id]: e.target.checked }))} />
              {it.label}
            </label>
          ))}
          <button className="hbtn" disabled={saving} onClick={saveSelected} style={{ marginTop: 10, width: '100%', justifyContent: 'center', background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)', height: 34 }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />} Salvar selecionados
          </button>
        </div>
      )}
    </PopupModal>
  )
}

export function EmailIntelPanel({ initial, eid }: { initial: string; auto?: boolean; eid?: string }) {
  const [saved, setSaved] = useState<Finding[]>([])
  const [modal, setModal] = useState<null | 'add' | 'consult'>(null)
  const [consultInit, setConsultInit] = useState('')

  async function loadSaved() {
    if (!eid) return
    try {
      const [em, us] = await Promise.all([listFindings(eid, 'email'), listFindings(eid, 'username')])
      setSaved([...em, ...us].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)))
    } catch { setSaved([]) }
  }
  useEffect(() => { loadSaved() }, [eid])

  async function removeSaved(id: string) {
    if (!eid) return
    setSaved(prev => prev.filter(s => s.id !== id))
    await deleteFinding(eid, id).catch(() => loadSaved())
  }
  const openConsult = (v = '') => { setConsultInit(v); setModal('consult') }

  return (
    <Wrap>
      <Panel title="Inteligência de E-mail & Usuários" icon={<AtSign size={13} />}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="hbtn" onClick={() => openConsult(initial && initial.includes('@') ? initial : '')} style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)' }}><Search size={13} /> Consultar</button>
            <button className="hbtn" onClick={() => setModal('add')}><Plus size={13} /> Adicionar</button>
          </div>
        }>
        {saved.length === 0
          ? <div style={{ padding: '30px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--txt-3)' }}>Nenhum e-mail/usuário. Clique em <b style={{ color: 'var(--txt-2)' }}>Adicionar</b> para registrar, ou <b style={{ color: 'var(--txt-2)' }}>Consultar</b> para investigar.</div>
          : saved.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', borderBottom: '0.5px solid var(--line)' }}>
              {f.type === 'email' ? <Mail size={13} style={{ color: '#5ad1ff', flexShrink: 0 }} /> : <User size={13} style={{ color: '#EF9F27', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value}</div>
                {f.data?.note && <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>{f.data.note}</div>}
              </div>
              <button className="hbtn" style={{ height: 24, fontSize: 10.5 }} onClick={() => openConsult(f.value)}><Search size={11} /> Consultar</button>
              <button onClick={() => removeSaved(f.id)} title="Remover" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(226,75,74,.55)', display: 'flex' }}><Trash2 size={12} /></button>
            </div>
          ))}
      </Panel>

      {modal === 'add' && <AddIdentityModal eid={eid} onClose={() => setModal(null)} onSaved={() => { loadSaved(); setModal(null) }} />}
      {modal === 'consult' && <ConsultModal eid={eid} initialValue={consultInit} saved={saved} onClose={() => setModal(null)} onSaved={loadSaved} />}
    </Wrap>
  )
}

// ─── Hunter (domínio) ────────────────────────────────────────────────────────────

export function HunterDomainPanel({ initial, eid }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain']))
  const { data, loading, error, run } = useRun<any>(hunterDomain, 'Hunter', { eid, tool: 'hunter' })
  return (
    <Wrap>
      <Panel title="Hunter — E-mails do Domínio" icon={<Mail size={13} />}
        action={data && !data.error && <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{data.organization || data.domain} · padrão {data.pattern || '—'}</span>}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="domínio (ex: empresa.com)" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
        {data?.error && <ErrBox msg={String(data.error)} />}
        {data && !data.error && (data.total === 0
          ? <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>Nenhum e-mail encontrado.</div>
          : <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(data.emails ?? []).map((e: any, i: number) => (
                <div key={i} className="rowi" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '0.5px solid var(--line)' }}>
                  <Mail size={12} style={{ color: 'var(--up)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--htxt)' }}>{e.value}</span>
                  {(e.firstName || e.position) && <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{[e.firstName, e.lastName].filter(Boolean).join(' ')}{e.position ? ` · ${e.position}` : ''}</span>}
                  <span className="tag" style={{ fontSize: 10 }}>{e.confidence}%</span>
                </div>
              ))}
            </div>
        )}
      </Panel>
    </Wrap>
  )
}

// ─── Denúncia (GoDaddy Abuse) ────────────────────────────────────────────────────

const ABUSE_TYPES = ['PHISHING', 'MALWARE', 'SPAM', 'CONTENT', 'FRAUD_WIRE', 'NETWORK_ABUSE', 'IP_BLOCK', 'A_RECORD', 'CHILD_ABUSE']

export function GodaddyAbusePanel({ initial }: { initial: string }) {
  const [type, setType] = useState('PHISHING')
  const [source, setSource] = useState(() => pickTarget(initial, ['domain', 'url', 'ip']))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!source.trim()) return
    setLoading(true); setError(null)
    try { setData(await godaddyCreateAbuse({ type, source: source.trim() })) }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Falha.'); setData(null) }
    finally { setLoading(false) }
  }
  return (
    <Wrap>
      <Panel title="Denúncia de Abuso (GoDaddy)" icon={<Flag size={13} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 5 }}>Tipo de abuso</div>
            <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, fontFamily: 'inherit', cursor: 'pointer' }}>
              {ABUSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 5 }}>Fonte (URL / IP / domínio)</div>
            <TargetChips all={parseTargets(initial)} value={source} onPick={setSource} />
            <input value={source} onChange={e => setSource(e.target.value)} placeholder="http://site-malicioso.com" style={inputStyle} />
          </div>
          <button className="hbtn" onClick={submit} disabled={loading} style={{ alignSelf: 'flex-start', background: 'rgba(240,71,106,.14)', borderColor: 'rgba(240,71,106,.4)', color: '#f4a0b0' }}>
            {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Flag size={13} />} Enviar denúncia
          </button>
        </div>
        {error && <div style={{ marginTop: 12 }}><ErrBox msg={error} /></div>}
        {data?.error && <div style={{ marginTop: 12 }}><ErrBox msg={String(data.error)} /></div>}
        {data?.ok && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(52,210,123,.1)', border: '1px solid rgba(52,210,123,.3)' }}>
            <CheckCircle size={13} style={{ color: 'var(--up)' }} />
            <span style={{ fontSize: 12, color: 'var(--up)' }}>Denúncia registrada · ticket {data.ticketId}</span>
          </div>
        )}
      </Panel>
    </Wrap>
  )
}

// ─── WhatsMyName (username em ~700 sites, via SSE) ──────────────────────────────

/** Escolhe o melhor alvo p/ username: o 1º que NÃO é ip/domain/cve (provável handle). */
function pickUsername(s: string): string {
  const ts = parseTargets(s)
  return ts.find(t => detectKind(t) === 'unknown') ?? ts[0] ?? s
}

export function WhatsMyNamePanel({ initial, eid }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickUsername(initial))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ checked: number; total: number; found: number } | null>(null)
  const [result, setResult] = useState<WmnResult | null>(null)

  async function run() {
    const handle = value.trim().replace(/^@/, '')
    if (!handle) return
    setLoading(true); setError(null); setResult(null); setProgress(null)
    const { startTask, updateTask, endTask } = useUIStore.getState()
    const taskId = startTask(`WhatsMyName: ${handle}`)
    try {
      await whatsMyNameStream(handle, e => {
        if (e.type === 'progress') {
          setProgress({ checked: e.checked, total: e.total, found: e.found })
          updateTask(taskId, { progress: { done: e.checked, total: e.total } })
        } else if (e.type === 'done') {
          setResult(e.result); setProgress({ checked: e.result.checked, total: e.result.total, found: e.result.found.length })
          if (eid) void ingestFindings(eid, 'username', handle, e.result)
        } else if (e.type === 'error') setError(e.error)
      })
    } catch {
      setError('Falha ao executar o WhatsMyName.')
    } finally {
      setLoading(false)
      endTask(taskId)
    }
  }

  const pct = progress && progress.total ? Math.round((progress.checked / progress.total) * 100) : 0
  // agrupa hits por categoria
  const byCat: Record<string, WmnHit[]> = {}
  for (const h of result?.found ?? []) (byCat[h.cat] ??= []).push(h)

  return (
    <Wrap>
      <Panel title="WhatsMyName — busca de username em ~700 sites" icon={<Search size={13} />}>
        <div style={{ marginBottom: 14 }}>
          <TargetChips all={parseTargets(initial)} value={value} onPick={setValue} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={value} onChange={e => setValue(e.target.value)} placeholder="username / @handle" style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && !loading && run()} />
            <button className="hbtn" onClick={run} disabled={loading}
              style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)', minWidth: 96, justifyContent: 'center' }}>
              {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
              {loading ? 'Buscando' : 'Buscar'}
            </button>
          </div>
        </div>

        {error && <ErrBox msg={error} />}

        {progress && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ height: 4, background: 'var(--line)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#7f77dd', transition: 'width .3s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace" }}>
              {progress.checked}/{progress.total} sites · {progress.found} perfis encontrados
            </div>
          </div>
        )}
      </Panel>

      {result && Object.keys(byCat).sort().map(cat => (
        <Panel key={cat} title={`${cat} · ${byCat[cat].length}`} icon={<Globe size={13} />}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {byCat[cat].map(h => (
              <a key={h.name} href={h.url} target="_blank" rel="noreferrer" className="hbtn"
                style={{ fontSize: 11, height: 24, textDecoration: 'none', color: 'var(--htxt)' }} title={h.url}>
                {h.name}
              </a>
            ))}
          </div>
        </Panel>
      ))}

      {result && result.found.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--txt-3)' }}>
          Nenhum perfil encontrado em {result.checked} sites checados.
        </div>
      )}
      <SavedFindings eid={eid} types={['profile']} />
    </Wrap>
  )
}

// ─── Service Scan ───────────────────────────────────────────────────────────────

export function ServiceScanPanel({ initial, eid }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain', 'ip']))
  const { data, loading, error, run } = useRun<any>((v) => serviceScan(v), 'Service Scan', { eid, tool: 'servicescan' })
  return (
    <Wrap>
      <Panel title="Service Scan — serviços e fingerprint" icon={<Server size={13} />}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="host / IP / domínio" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
        {data && (data.services ?? []).length === 0 && (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--txt-3)' }}>
            Nenhum serviço aberto nas portas checadas ({(data.scannedPorts ?? []).join(', ')}).
          </div>
        )}
      </Panel>
      {(data?.services ?? []).map((s: any) => {
        const tls = s.tls ?? s.http?.tls
        return (
          <Panel key={s.port} title={`${String(s.protocol).toUpperCase()} · porta ${s.port}`} icon={<Server size={13} />}>
            {s.http && (
              <>
                <Field k="Status" v={`HTTP ${s.http.status} · ${s.http.httpVersion}`} />
                {s.http.title && <Field k="Título" v={s.http.title} />}
                {s.http.server && <Field k="Server" v={s.http.server} />}
                {s.http.poweredBy && <Field k="X-Powered-By" v={s.http.poweredBy} />}
                <Field k="Security headers" v={`${s.http.securityScore}/6`} />
                {s.http.technologies?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '6px 0' }}>
                    {s.http.technologies.map((t: string) => <span key={t} className="tag" style={{ fontSize: 10 }}>{t}</span>)}
                  </div>
                )}
                {s.http.cookies?.length > 0 && (
                  <Field k="Cookies" v={s.http.cookies.map((c: any) => `${c.name}${c.httpOnly ? ' [HttpOnly]' : ''}${c.secure ? ' [Secure]' : ''}`).join(', ')} />
                )}
              </>
            )}
            {tls?.certificate && (
              <>
                <Field k="TLS" v={`${tls.protocol ?? ''} ${tls.cipher?.name ?? ''}`} mono />
                <Field k="Certificado (CN)" v={tls.certificate.subject} />
                <Field k="Emissor" v={tls.certificate.issuer} />
                <Field k="Válido" v={`${tls.certificate.validFrom} → ${tls.certificate.validTo}`} mono />
                {tls.certificate.altNames?.length > 0 && <Field k="SANs" v={tls.certificate.altNames.slice(0, 6).join(', ')} mono />}
                {tls.certificate.fingerprint256 && <Field k="Fingerprint" v={tls.certificate.fingerprint256} mono />}
              </>
            )}
            {s.ssh && (
              <>
                <Field k="Banner" v={s.ssh.banner} mono />
                <Field k="Software" v={s.ssh.software} />
                {s.ssh.algorithms?.kex?.length > 0 && <Field k="KEX" v={s.ssh.algorithms.kex.join(', ')} mono />}
                {s.ssh.algorithms?.hostKeys?.length > 0 && <Field k="Host keys" v={s.ssh.algorithms.hostKeys.join(', ')} mono />}
                {s.ssh.algorithms?.encryption?.length > 0 && <Field k="Cifras" v={s.ssh.algorithms.encryption.slice(0, 6).join(', ')} mono />}
              </>
            )}
            {s.ftp && (<><Field k="Banner" v={s.ftp.banner} mono /><Field k="Software" v={s.ftp.software} /></>)}
            {s.smtp && (
              <>
                <Field k="Banner" v={s.smtp.banner} mono />
                {s.smtp.features?.length > 0 && <Field k="Recursos" v={s.smtp.features.join(', ')} mono />}
              </>
            )}
          </Panel>
        )
      })}
      <SavedFindings eid={eid} types={['service','tech']} />
    </Wrap>
  )
}

// ─── Content Discovery (Gobuster-like) ───────────────────────────────────────────

function statusColor(code: number) {
  if (code >= 200 && code < 300) return 'var(--up)'
  if (code >= 300 && code < 400) return '#5ad1ff'
  if (code === 401 || code === 403) return '#f4bc6a'
  if (code >= 500) return 'var(--down)'
  return 'var(--txt-3)'
}

export function ContentDiscoveryPanel({ initial, eid }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain', 'ip']))
  const [exts, setExts] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ tested: number; total: number; found: number } | null>(null)
  const [result, setResult] = useState<ContentDiscoveryResult | null>(null)

  async function run() {
    const target = value.trim()
    if (!target) return
    setLoading(true); setError(null); setResult(null); setProgress(null)
    const { startTask, updateTask, endTask } = useUIStore.getState()
    const taskId = startTask(`Content Discovery: ${target}`)
    try {
      await contentDiscoveryStream(target, { extensions: exts.split(',').map(e => e.trim()).filter(Boolean) }, e => {
        const ev = e as ContentDiscoveryEvent
        if (ev.type === 'progress') { setProgress(ev); updateTask(taskId, { progress: { done: ev.tested, total: ev.total } }) }
        else if (ev.type === 'done') { setResult(ev.result); setProgress({ tested: ev.result.tested, total: ev.result.total, found: ev.result.found.length }); if (eid) void ingestFindings(eid, 'contentdisc', target, ev.result) }
        else if (ev.type === 'error') setError(ev.error)
      })
    } catch {
      setError('Falha no content discovery.')
    } finally {
      setLoading(false); endTask(taskId)
    }
  }

  const pct = progress && progress.total ? Math.round((progress.tested / progress.total) * 100) : 0

  return (
    <Wrap>
      <Panel title="Content Discovery — paths & arquivos" icon={<FileSearch size={13} />}>
        <TargetChips all={parseTargets(initial)} value={value} onPick={setValue} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={value} onChange={e => setValue(e.target.value)} placeholder="host / domínio / URL" style={inputStyle} onKeyDown={e => e.key === 'Enter' && !loading && run()} />
          <input value={exts} onChange={e => setExts(e.target.value)} placeholder="extensões: php,bak,zip" style={{ ...inputStyle, flex: '0 0 200px' }} />
          <button className="hbtn" onClick={run} disabled={loading} style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)', minWidth: 96, justifyContent: 'center' }}>
            {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
            {loading ? 'Buscando' : 'Buscar'}
          </button>
        </div>
        {error && <ErrBox msg={error} />}
        {result?.error && <ErrBox msg={result.error} />}
        {result?.wildcard?.detected && (
          <div style={{ fontSize: 11, color: '#f4bc6a', marginBottom: 8 }}>
            ⚠ Wildcard detectado (status {result.wildcard.status}, {result.wildcard.size}B) — falsos-positivos filtrados.
          </div>
        )}
        {progress && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ height: 4, background: 'var(--line)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#7f77dd', transition: 'width .3s ease' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace" }}>
              {progress.tested}/{progress.total} testados · {progress.found} encontrados {result?.baseUrl ? `· ${result.baseUrl}` : ''}
            </div>
          </div>
        )}
      </Panel>

      {result && result.found.length > 0 && (
        <Panel title={`Encontrados (${result.found.length})`} icon={<FileSearch size={13} />}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {result.found.map(f => (
              <a key={f.path} href={f.url} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', borderBottom: '0.5px solid var(--line)', textDecoration: 'none' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: statusColor(f.status), width: 34, flexShrink: 0 }}>{f.status}</span>
                <span style={{ fontSize: 12, color: 'var(--htxt)', flex: 1, fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/{f.path}</span>
                {f.redirect && <span style={{ fontSize: 10, color: 'var(--txt-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>→ {f.redirect}</span>}
                <span style={{ fontSize: 10.5, color: 'var(--txt-3)', flexShrink: 0 }}>{f.size}B</span>
              </a>
            ))}
          </div>
        </Panel>
      )}
      {result && result.found.length === 0 && !result.error && (
        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--txt-3)' }}>
          Nada encontrado em {result.tested} paths testados.
        </div>
      )}
      <SavedFindings eid={eid} types={['url']} />
    </Wrap>
  )
}

// ─── Screenshot Engine ────────────────────────────────────────────────────────

export function ScreenshotPanel({ initial, eid }: { initial: string; eid?: string }) {
  const { showToast } = useUIStore()
  const [value, setValue] = useState(() => pickTarget(initial, ['domain', 'ip']))
  const [useProxy, setUseProxy] = useState(false)
  const { data, loading, error, run } = useRun<ShotResult>((v) => captureScreenshot(v, true, useProxy), 'Screenshot', { eid, tool: 'capturas' })
  const [prev, setPrev] = useState<Finding[]>([])
  const [viewing, setViewing] = useState<{ id?: string; img: string; label?: string } | null>(null)

  const loadPrev = () => { if (eid) listFindings(eid, 'screenshot').then(setPrev).catch(() => setPrev([])) }
  useEffect(() => { loadPrev() }, [eid])
  useEffect(() => { if (data && !data.error) { loadPrev(); setViewing(null) } }, [data])

  async function removeShot(id: string) {
    if (!eid) return
    setPrev(prev => prev.filter(p => p.id !== id))
    setViewing(v => (v?.id === id ? null : v))
    try { await deleteFinding(eid, id); showToast('Captura apagada', 'success') }
    catch { showToast('Falha ao apagar captura', 'error'); loadPrev() }
  }

  const shownImg = viewing?.img ?? (data && !data.error ? data.screenshot : null)
  const shownLabel = viewing?.label ?? data?.finalUrl
  const gallery = prev.filter(p => p.data?.screenshot)

  return (
    <Wrap>
      <Panel title="Screenshot Engine — captura de tela" icon={<FileSearch size={13} />}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="host / domínio / URL" all={parseTargets(initial)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--txt-2)', cursor: 'pointer', marginTop: 2 }}>
          <input type="checkbox" checked={useProxy} onChange={e => setUseProxy(e.target.checked)} />
          Capturar via proxy (rotaciona pelo pool até um funcionar; requer pool validado na aba Proxies) — mais lento
        </label>
        {error && <ErrBox msg={error} />}
        {data?.error && <ErrBox msg={data.error} />}
        {data && !data.error && !viewing && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '10px 0' }}>
            {data.status != null && <Field k="Status" v={`HTTP ${data.status}`} />}
            {data.title && <Field k="Título" v={data.title} />}
            {data.server && <Field k="Server" v={data.server} />}
            {data.finalUrl && <Field k="URL final" v={data.finalUrl} mono />}
            {data.via && <Field k="Via" v={data.via} mono />}
          </div>
        )}
        {shownImg && (
          <>
            {shownLabel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace", flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shownLabel}</span>
                {viewing && <button className="hbtn" style={{ height: 22, fontSize: 10.5 }} onClick={() => setViewing(null)}>voltar à atual</button>}
                <a href={shownImg} target="_blank" rel="noreferrer" className="hbtn" style={{ height: 22, fontSize: 10.5, textDecoration: 'none' }}>abrir</a>
                {viewing?.id && <button className="hbtn" style={{ height: 22, fontSize: 10.5, borderColor: 'rgba(226,75,74,.4)', color: '#e24b4a' }} onClick={() => removeShot(viewing.id!)}>apagar</button>}
              </div>
            )}
            {/* container com scroll p/ ver a página inteira */}
            <div style={{ maxHeight: '68vh', overflow: 'auto', borderRadius: 8, border: '1px solid var(--line-2)', background: '#fff' }}>
              <img src={shownImg} alt="screenshot" style={{ width: '100%', display: 'block' }} />
            </div>
          </>
        )}
      </Panel>

      {gallery.length > 0 && (
        <Panel title={`Capturas anteriores (${gallery.length})`} icon={<FileSearch size={13} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
            {gallery.map(p => (
              <div key={p.id} style={{ position: 'relative' }}>
                <button onClick={() => setViewing({ id: p.id, img: p.data.screenshot, label: p.label || p.value })}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}>
                  <img src={p.data.screenshot} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', objectPosition: 'top', borderRadius: 6, border: '1px solid var(--line-2)' }} />
                  <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>{p.label || p.value}</div>
                </button>
                <button onClick={() => removeShot(p.id)} title="Apagar captura"
                  style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,12,16,.72)', border: '1px solid rgba(226,75,74,.4)', borderRadius: 6, cursor: 'pointer', color: '#e24b4a' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </Wrap>
  )
}

// ─── Atribuição de Domínio (WHOIS → IP → Hosting) ────────────────────────────

export function DomainAttributionPanel({ initial, eid }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain']))
  const { data, loading, error, run } = useRun<AttributionResult>(domainAttribution, 'Atribuição', { eid, tool: 'attribution' })
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => { if (data) { const t = setTimeout(() => setRefreshKey(k => k + 1), 800); return () => clearTimeout(t) } }, [data])
  const w = data?.whois
  const h = data?.hosting
  const nsList = w?.nameservers ?? []
  return (
    <Wrap>
      <Panel title="Atribuição de Domínio — WHOIS → IP → Hosting" icon={<Globe size={13} />}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="dominio.com" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
      </Panel>

      {data && (
        <>
          <Panel title="Registro — Registrador & Registrante (WHOIS / RDAP)" icon={<Globe size={13} />}>
            <Field k="Domínio" v={data.domain} mono />
            <Field k="Registrador" v={w?.registrar} />
            {w?.registrarId && <Field k="IANA ID" v={w.registrarId} mono />}
            <Field k="Registrado em" v={w?.created} />
            <Field k="Expira em" v={w?.expires} />
            {w?.updated && <Field k="Atualizado em" v={w.updated} />}
            <Field k="E-mail de abuso" v={w?.abuseEmail} mono />
            {w?.registrant && (w.registrant.name || w.registrant.org || w.registrant.email) && (
              <>
                <Field k="Registrante" v={w.registrant.name || w.registrant.org} />
                {w.registrant.email && <Field k="E-mail do registrante" v={w.registrant.email} mono />}
              </>
            )}
            <Field k="Nameservers" v={nsList.length ? <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{nsList.map(n => <span key={n}>{n}</span>)}</span> : '—'} mono />
            {!!w?.status?.length && <Field k="Status do domínio" v={w.status.join(', ')} />}
          </Panel>

          <Panel title="Servidor & Hosting (resolução DNS + ipinfo.io)" icon={<Server size={13} />}>
            <Field k="IP do servidor" v={data.ip} mono />
            <Field k="Hostname (rDNS)" v={h?.hostname} mono />
            <Field k="Provedor / Organização" v={h?.org} />
            <Field k="ASN" v={h?.asn} mono />
            <Field k="Localização física" v={[h?.city, h?.region, h?.country].filter(Boolean).join(', ') || null} />
            {h?.timezone && <Field k="Fuso horário" v={h.timezone} />}
            {h?.loc && <Field k="Coordenadas" v={h.loc} mono />}
            {h?.postal && <Field k="CEP" v={h.postal} mono />}
          </Panel>
        </>
      )}

      <SavedFindings eid={eid} types={['domain', 'host']} refreshKey={refreshKey} />
    </Wrap>
  )
}

// ─── Geo-distribuído (anti-cloaking via proxies) ─────────────────────────────

const flagEmoji = (cc?: string | null) => cc && cc.length === 2 ? cc.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0))) : ''

export function GeoDistributedPanel({ initial }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain', 'ip']))
  const { data, loading, error, run } = useRun<GeoCheckResult>((v) => geoCheck(v, 8), 'Geo-check')
  const base = data?.baseline
  return (
    <Wrap>
      <Panel title="Visão Geo-distribuída — detecção de cloaking / geo-block" icon={<Globe size={13} />}>
        <RunBar value={value} setValue={setValue} onRun={() => run(value)} loading={loading} placeholder="host / domínio / URL" all={parseTargets(initial)} />
        <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 4 }}>Busca o alvo por proxies de vários países e compara as respostas. Requer pool de proxies validado (aba Proxies da operação).</div>
        {error && <div style={{ marginTop: 10 }}><ErrBox msg={error} /></div>}
      </Panel>

      {data && (
        <Panel title={data.cloakingSuspected ? '⚠ Possível cloaking / conteúdo variável por região' : 'Conteúdo consistente entre regiões'}
          icon={<Globe size={13} />}
          action={<span style={{ fontSize: 11, color: data.cloakingSuspected ? '#ff9f5a' : 'var(--up, #4dd4a4)' }}>{data.distinctVariants} variante(s)</span>}>
          {base && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--line)', fontSize: 12 }}>
              <span className="tag" style={{ fontSize: 9 }}>DIRETO</span>
              <span style={{ flex: 1, color: 'var(--htxt)' }}>RedNest (origem)</span>
              <span style={{ color: 'var(--up, #4dd4a4)' }}>{base.status}</span>
              <span style={{ color: 'var(--txt-3)', width: 70, textAlign: 'right' }}>{base.length}B</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--txt-3)', width: 130 }}>{base.hash}</span>
            </div>
          )}
          {data.results.map((r, i) => {
            const differs = base && r.status === 200 && r.hash !== base.hash
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '0.5px solid var(--line)', fontSize: 12 }}>
                <span style={{ width: 60 }}>{flagEmoji(r.country)} {r.country}</span>
                <span style={{ flex: 1, color: 'var(--txt-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.via}>{r.title ?? r.via}</span>
                <span style={{ color: r.status === 200 ? 'var(--up, #4dd4a4)' : r.status === 0 ? '#e24b4a' : '#f4bc6a', width: 36 }}>{r.status || '×'}</span>
                <span style={{ color: 'var(--txt-3)', width: 70, textAlign: 'right' }}>{r.length != null ? `${r.length}B` : '—'}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: differs ? '#ff9f5a' : 'var(--txt-3)', width: 130 }}>{r.hash ?? '—'}{differs ? ' ≠' : ''}</span>
              </div>
            )
          })}
        </Panel>
      )}
    </Wrap>
  )
}

// ─── Crawler (Katana-like) ────────────────────────────────────────────────────

export function CrawlerPanel({ initial, eid }: { initial: string; eid?: string }) {
  const [value, setValue] = useState(() => pickTarget(initial, ['domain', 'ip']))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ visited: number; queued: number; endpoints: number } | null>(null)
  const [result, setResult] = useState<CrawlResult | null>(null)
  const [tab, setTab] = useState<'pages' | 'endpoints' | 'links' | 'forms' | 'emails'>('pages')

  async function run() {
    const target = value.trim()
    if (!target) return
    setLoading(true); setError(null); setResult(null); setProgress(null)
    const { startTask, updateTask, endTask } = useUIStore.getState()
    const taskId = startTask(`Crawler: ${target}`)
    try {
      await crawlerStream(target, {}, e => {
        const ev = e as CrawlEvent
        if (ev.type === 'progress') { setProgress(ev); updateTask(taskId, { progress: { done: ev.visited, total: ev.visited + ev.queued } }) }
        else if (ev.type === 'done') { setResult(ev.result); if (eid) void ingestFindings(eid, 'crawler', target, ev.result) }
        else if (ev.type === 'error') setError(ev.error)
      })
    } catch {
      setError('Falha no crawler.')
    } finally {
      setLoading(false); endTask(taskId)
    }
  }

  const tabs: [typeof tab, string, number][] = result ? [
    ['pages', 'Páginas', result.pages.length],
    ['endpoints', 'Endpoints', result.endpoints.length],
    ['links', 'Links', result.internalLinks.length + result.externalLinks.length],
    ['forms', 'Forms', result.forms.length],
    ['emails', 'E-mails', result.emails.length],
  ] : []

  return (
    <Wrap>
      <Panel title="Crawler — descoberta de URLs, endpoints e forms" icon={<Network size={13} />}>
        <RunBar value={value} setValue={setValue} onRun={run} loading={loading} placeholder="host / domínio / URL" all={parseTargets(initial)} />
        {error && <ErrBox msg={error} />}
        {result?.error && <ErrBox msg={result.error} />}
        {progress && (
          <div style={{ fontSize: 11, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace" }}>
            {progress.visited} páginas · {progress.queued} na fila · {progress.endpoints} endpoints {result?.base ? `· ${result.base}` : ''}
          </div>
        )}
      </Panel>

      {result && (
        <Panel title={`Resultado — ${result.pagesVisited} página(s)`} icon={<Network size={13} />}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {tabs.map(([id, label, n]) => (
              <button key={id} onClick={() => setTab(id)} className="hbtn" style={{ fontSize: 10.5, height: 22, background: tab === id ? 'rgba(var(--accent-rgb),.2)' : undefined, borderColor: tab === id ? 'rgba(var(--accent-rgb),.5)' : undefined, color: tab === id ? 'var(--htxt)' : undefined }}>
                {label} ({n})
              </button>
            ))}
          </div>
          <div>
            {tab === 'pages' && result.pages.map(p => (
              <div key={p.url} style={{ display: 'flex', gap: 8, padding: '5px 4px', borderBottom: '0.5px solid var(--line)' }}>
                <span style={{ fontSize: 10.5, color: statusColor(p.status), width: 30, flexShrink: 0, fontWeight: 700 }}>{p.status}</span>
                <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'var(--htxt)', flex: 1, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>{p.url}</a>
                {p.title && <span style={{ fontSize: 10.5, color: 'var(--txt-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>}
              </div>
            ))}
            {tab === 'endpoints' && result.endpoints.map(e => <div key={e} style={{ fontSize: 11.5, color: '#5ad1ff', padding: '4px 4px', fontFamily: "'JetBrains Mono', monospace", borderBottom: '0.5px solid var(--line)' }}>{e}</div>)}
            {tab === 'links' && [...result.internalLinks.map(l => ['int', l] as const), ...result.externalLinks.map(l => ['ext', l] as const)].map(([k, l]) => (
              <div key={l} style={{ display: 'flex', gap: 8, padding: '4px 4px', borderBottom: '0.5px solid var(--line)' }}>
                <span className="tag" style={{ fontSize: 9, color: k === 'int' ? 'var(--up)' : 'var(--txt-3)' }}>{k === 'int' ? 'interno' : 'externo'}</span>
                <a href={l} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--htxt)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>{l}</a>
              </div>
            ))}
            {tab === 'forms' && result.forms.map((f, i) => (
              <div key={i} style={{ fontSize: 11, padding: '5px 4px', borderBottom: '0.5px solid var(--line)' }}>
                <span className="tag" style={{ fontSize: 9, marginRight: 6 }}>{f.method}</span>
                <span style={{ color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace" }}>{f.action}</span>
              </div>
            ))}
            {tab === 'emails' && result.emails.map(e => <div key={e} style={{ fontSize: 11.5, color: '#e879f9', padding: '4px 4px', fontFamily: "'JetBrains Mono', monospace", borderBottom: '0.5px solid var(--line)' }}>{e}</div>)}
          </div>
        </Panel>
      )}
      <SavedFindings eid={eid} types={['url','endpoint','email']} />
    </Wrap>
  )
}

// ─── Multi-lookup (workbench OSINT) ─────────────────────────────────────────────

const LOOKUP_TOOLS = [
  { id: 'threat', label: 'Threat Intel', Icon: ShieldAlert },
  { id: 'email', label: 'E-mail Intel', Icon: AtSign },
  { id: 'hunter', label: 'Hunter (domínio)', Icon: Mail },
  { id: 'whois', label: 'WHOIS/DNS', Icon: Globe },
  { id: 'subdomains', label: 'Subdomínios', Icon: Network },
  { id: 'asn', label: 'ASN', Icon: Server },
  { id: 'checkhost', label: 'Check-Host', Icon: Activity },
  { id: 'wayback', label: 'Wayback', Icon: Clock },
  { id: 'cve', label: 'CVE', Icon: FileSearch },
  { id: 'abuse', label: 'Denúncia', Icon: Flag },
] as const

export function MultiLookupPanel({ initial }: { initial: string }) {
  const [tool, setTool] = useState<string>('threat')
  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', background: 'var(--hbg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '14px 20px 0' }}>
        {LOOKUP_TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} className="hbtn" style={{
            gap: 6,
            background: tool === t.id ? 'rgba(var(--accent-rgb),.2)' : undefined,
            borderColor: tool === t.id ? 'rgba(var(--accent-rgb),.5)' : undefined,
            color: tool === t.id ? 'var(--htxt)' : undefined,
          }}>
            <t.Icon size={12} /> {t.label}
          </button>
        ))}
      </div>
      {tool === 'threat' && <ThreatIntelPanel initial={initial} />}
      {tool === 'email' && <EmailIntelPanel initial={initial} />}
      {tool === 'hunter' && <HunterDomainPanel initial={initial} />}
      {tool === 'whois' && <WhoisPanel initial={initial} />}
      {tool === 'subdomains' && <SubdomainsPanel initial={initial} />}
      {tool === 'asn' && <AsnPanel initial={initial} />}
      {tool === 'checkhost' && <CheckHostPanel initial={initial} />}
      {tool === 'wayback' && <WaybackPanel initial={initial} />}
      {tool === 'cve' && <CvePanel initial={initial} />}
      {tool === 'abuse' && <GodaddyAbusePanel initial={initial} />}
    </div>
  )
}
