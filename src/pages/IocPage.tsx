import { useState, useMemo, useEffect } from 'react'
import {
  Search, Plus, Copy, Trash2, ExternalLink, X, Check,
  Globe, Mail, Hash, Link, User, CreditCard, Phone, Server, ShieldAlert,
  Share2, Upload, Download, Loader2,
  type LucideIcon,
} from 'lucide-react'
import type { IOC, IOCType, IOCThreatLevel } from '@/types'
import { listIocs, createIoc, deleteIoc as apiDeleteIoc, enrichIoc, type CreateIocInput } from '@/services/iocs'
import { mispPush, mispPull } from '@/services/misp'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'

// IOCs que podem ser enriquecidos pelos endpoints externos
const ENRICHABLE = new Set<IOCType>(['ip', 'domain', 'url', 'cve', 'email'])

function verdictColor(v: string): string {
  return v === 'malicious' ? 'var(--down)' : v === 'suspicious' ? 'var(--med)' : 'var(--up)'
}
function verdictLabel(v: string): string {
  return v === 'malicious' ? 'Malicioso' : v === 'suspicious' ? 'Suspeito' : 'Limpo'
}

// Painel do modal: chama o endpoint que PERSISTE o enriquecimento e exibe o resultado
function IocEnrichView({ ioc, onResult }: { ioc: IOC; onResult: (u: IOC) => void }) {
  const [data, setData] = useState<any>((ioc as any).enrichment ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true); setError(null)
    try {
      const updated = await enrichIoc(ioc.id)
      setData((updated as any).enrichment ?? null)
      onResult(updated as IOC)
    } catch {
      setError('Falha ao enriquecer.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void run() }, [])

  const Field = ({ k, v }: { k: string; v: any }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '0.5px solid var(--line)' }}>
      <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: 'var(--htxt)', textAlign: 'right', wordBreak: 'break-all' }}>{v ?? '—'}</span>
    </div>
  )

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
      {loading && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--txt-3)', fontSize: 13 }}>Consultando integrações…</div>}
      {error && <div style={{ color: 'var(--down)', fontSize: 12.5 }}>{error}</div>}
      {!loading && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.verdict && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 9, background: `${verdictColor(data.verdict)}1f`, border: `1px solid ${verdictColor(data.verdict)}55` }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: verdictColor(data.verdict) }}>{verdictLabel(data.verdict)}</span>
              <span style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>score {data.score}/100</span>
            </div>
          )}
          {data.cvss != null && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: data.cvss >= 7 ? 'var(--down)' : 'var(--med)', fontFamily: "'Space Grotesk', sans-serif" }}>CVSS {data.cvss}</div>
              <p style={{ fontSize: 12.5, color: 'var(--txt-2)', lineHeight: 1.6 }}>{data.description}</p>
            </div>
          )}
          {data.abuseipdb && <div><div style={{ fontSize: 11, color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: 4 }}>AbuseIPDB</div><Field k="Score" v={`${data.abuseipdb.score ?? 0}%`} /><Field k="ISP" v={data.abuseipdb.isp} /><Field k="País" v={data.abuseipdb.country} /></div>}
          {data.virustotal && <div><div style={{ fontSize: 11, color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: 4 }}>VirusTotal</div><Field k="Maliciosos" v={data.virustotal.malicious} /><Field k="Suspeitos" v={data.virustotal.suspicious} /></div>}
          {data.email && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: 4 }}>E-mail</div>
              <Field k="Gravatar" v={data.email.gravatar?.found ? data.email.gravatar.displayName || 'perfil' : 'sem perfil'} />
              <Field k="Hunter" v={data.email.hunter?.result} />
              <Field k="Leak-Lookup (fontes)" v={data.email.leaklookup?.n} />
              <Field k="COMB (vazamentos)" v={data.email.comb?.count} />
            </div>
          )}
          <button className="hbtn" onClick={run} disabled={loading} style={{ alignSelf: 'flex-start' }}>Reexecutar</button>
        </div>
      )}
      {!loading && !data && !error && <div style={{ color: 'var(--txt-3)', fontSize: 12.5 }}>Sem resultado.</div>}
    </div>
  )
}

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_META: Record<IOCType, { label: string; color: string; bg: string; Icon: LucideIcon }> = {
  domain:      { label: 'DOM',    color: '#5ad1ff', bg: 'rgba(90,209,255,.12)',   Icon: Globe },
  ip:          { label: 'IP',     color: '#a09ae8', bg: 'rgba(127,119,221,.12)', Icon: Server },
  email:       { label: 'EMAIL',  color: '#e879f9', bg: 'rgba(232,121,249,.12)', Icon: Mail },
  url:         { label: 'URL',    color: '#EF9F27', bg: 'rgba(239,159,39,.12)',  Icon: Link },
  hash_sha256: { label: 'SHA256', color: '#1D9E75', bg: 'rgba(29,158,117,.12)',  Icon: Hash },
  hash_sha1:   { label: 'SHA1',   color: '#1D9E75', bg: 'rgba(29,158,117,.12)',  Icon: Hash },
  hash_md5:    { label: 'MD5',    color: '#1D9E75', bg: 'rgba(29,158,117,.12)',  Icon: Hash },
  username:    { label: 'USER',   color: '#8a9cff', bg: 'rgba(138,156,255,.12)', Icon: User },
  cve:         { label: 'CVE',    color: '#e24b4a', bg: 'rgba(226,75,74,.12)',   Icon: ShieldAlert },
  wallet:      { label: 'WALLET', color: '#f4bc6a', bg: 'rgba(239,159,39,.12)', Icon: CreditCard },
  phone:       { label: 'TEL',    color: '#888',    bg: 'rgba(255,255,255,.06)', Icon: Phone },
  asn:         { label: 'ASN',    color: '#888',    bg: 'rgba(255,255,255,.06)', Icon: Server },
}

const SEV_META: Record<IOCThreatLevel, { label: string; color: string; cls: string }> = {
  critical:      { label: 'Crítico',      color: 'var(--crit)', cls: 'crit' },
  high:          { label: 'Alto',         color: 'var(--high)', cls: 'high' },
  medium:        { label: 'Médio',        color: 'var(--med)',  cls: 'med'  },
  low:           { label: 'Baixo',        color: 'var(--low)',  cls: 'low'  },
  informational: { label: 'Informativo',  color: 'var(--txt-3)', cls: ''    },
}

const ALL_TYPES: IOCType[] = [
  'domain', 'ip', 'email', 'url', 'hash_sha256', 'hash_sha1', 'hash_md5',
  'username', 'cve', 'wallet', 'phone', 'asn',
]
const ALL_SEVS: IOCThreatLevel[] = ['critical', 'high', 'medium', 'low', 'informational']

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: IOCType }) {
  const m = TYPE_META[type]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      color: m.color, background: m.bg, letterSpacing: '.04em',
      fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
    }}>
      {m.label}
    </span>
  )
}

function SevDot({ level }: { level: IOCThreatLevel }) {
  const m = SEV_META[level]
  return (
    <span className={`sev ${m.cls}`} style={{ fontSize: 10 }}>{m.label}</span>
  )
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="hbtn"
      style={{ width: 24, height: 24, padding: 0, justifyContent: 'center', flexShrink: 0 }}
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check size={10} style={{ color: 'var(--up)' }} /> : <Copy size={10} />}
    </button>
  )
}

// ─── Add IOC Form ─────────────────────────────────────────────────────────────

function AddIocForm({ onAdd, onCancel }: { onAdd: (input: CreateIocInput) => void; onCancel: () => void }) {
  const operations = useDataStore(s => s.operations)
  const [value,   setValue]   = useState('')
  const [type,    setType]    = useState<IOCType>('domain')
  const [sev,     setSev]     = useState<IOCThreatLevel>('medium')
  const [opId,    setOpId]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [source,  setSource]  = useState('')
  const [tagStr,  setTagStr]  = useState('')

  useEffect(() => { if (!opId && operations[0]) setOpId(operations[0].id) }, [operations])

  const inp: React.CSSProperties = {
    padding: '7px 10px', background: 'rgba(255,255,255,.04)',
    border: '0.5px solid var(--line)', borderRadius: 6,
    color: 'var(--htxt)', fontSize: 12, outline: 'none', fontFamily: 'inherit',
  }
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }

  function submit() {
    if (!value.trim() || !opId) return
    onAdd({
      value: value.trim(),
      type,
      threatLevel: sev,
      tags: tagStr.split(',').map(t => t.trim()).filter(Boolean),
      operationId: opId,
      description: desc.trim(),
      source: source.trim() || 'Manual',
    })
  }

  return (
    <div style={{
      margin: '0 0 16px',
      background: 'rgba(127,119,221,.06)',
      border: '0.5px solid rgba(127,119,221,.25)',
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#a09ae8', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Adicionar IOC
        <button onClick={onCancel} className="hbtn" style={{ padding: '2px 6px' }}><X size={12} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <input
          style={{ ...inp, fontFamily: "'JetBrains Mono', monospace" }}
          placeholder="Valor do indicador (domínio, IP, hash...)"
          value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <select style={sel} value={type} onChange={e => setType(e.target.value as IOCType)}>
          {ALL_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label} — {t}</option>)}
        </select>
        <select style={sel} value={sev} onChange={e => setSev(e.target.value as IOCThreatLevel)}>
          {ALL_SEVS.map(s => <option key={s} value={s}>{SEV_META[s].label}</option>)}
        </select>
        <select style={sel} value={opId} onChange={e => setOpId(e.target.value)}>
          {operations.length === 0 && <option value="">Nenhuma operação</option>}
          {operations.map(op => <option key={op.id} value={op.id}>{op.name.slice(0, 28)}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <input style={inp} placeholder="Descrição do IOC" value={desc} onChange={e => setDesc(e.target.value)} />
        <input style={inp} placeholder="Fonte (ex: VirusTotal)" value={source} onChange={e => setSource(e.target.value)} />
        <input style={inp} placeholder="Tags (vírgula)" value={tagStr} onChange={e => setTagStr(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="btn" style={{ padding: '6px 16px', fontSize: 12 }}>Cancelar</button>
        <button onClick={submit} className="btn btn-accent" style={{ padding: '6px 16px', fontSize: 12 }}>
          <Plus size={12} /> Adicionar
        </button>
      </div>
    </div>
  )
}

// ─── MISP (sync) ────────────────────────────────────────────────────────────────

function MispModal({ defaultOpId, onClose }: { defaultOpId: string; onClose: () => void }) {
  const operations = useDataStore(s => s.operations)
  const { showToast } = useUIStore()
  const [opId, setOpId] = useState(defaultOpId || operations[0]?.id || '')
  const [busy, setBusy] = useState<'push' | 'pull' | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function push() {
    if (!opId) return
    setBusy('push'); setResult(null)
    try {
      const r = await mispPush(opId)
      if (r.configured === false) setResult('⚠️ MISP não configurado. Adicione a chave em Chaves API no formato URL|API_KEY.')
      else if (r.error) setResult('Erro: ' + (typeof r.error === 'string' ? r.error : JSON.stringify(r.error)))
      else { setResult(`✅ Exportado: evento MISP #${r.eventId} · ${r.exported} IOC(s) (${r.skipped} ignorados).`); showToast('IOCs enviados ao MISP', 'success') }
    } catch { setResult('Falha na chamada.') } finally { setBusy(null) }
  }
  async function pull() {
    if (!opId) return
    setBusy('pull'); setResult(null)
    try {
      const r = await mispPull(opId, { limit: 200 })
      if (r.configured === false) setResult('⚠️ MISP não configurado. Adicione a chave em Chaves API no formato URL|API_KEY.')
      else if (r.error) setResult('Erro: ' + (typeof r.error === 'string' ? r.error : JSON.stringify(r.error)))
      else { setResult(`✅ Importado: ${r.imported} novo(s) IOC(s) de ${r.fetched} atributo(s) (${r.skipped} já existiam).`); showToast('IOCs importados do MISP', 'success') }
    } catch { setResult('Falha na chamada.') } finally { setBusy(null) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, 96vw)', background: 'var(--hbg)', border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <Share2 size={14} style={{ color: 'rgba(var(--accent-rgb),1)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--htxt)' }}>Sincronizar com MISP</span>
          <div style={{ flex: 1 }} />
          <button className="hbtn" style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }} onClick={onClose}><X size={13} /></button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 5 }}>Operação</div>
            <select value={opId} onChange={e => setOpId(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--htxt)', fontSize: 12.5, cursor: 'pointer' }}>
              {operations.length === 0 && <option value="">Nenhuma operação</option>}
              {operations.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="hbtn" disabled={!opId || busy !== null} onClick={push} style={{ flex: 1, justifyContent: 'center', background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)' }}>
              {busy === 'push' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={13} />} Enviar IOCs → MISP
            </button>
            <button className="hbtn" disabled={!opId || busy !== null} onClick={pull} style={{ flex: 1, justifyContent: 'center' }}>
              {busy === 'pull' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />} Importar ← MISP
            </button>
          </div>
          {result && <div style={{ fontSize: 12, color: 'var(--txt-2)', background: 'rgba(255,255,255,.03)', border: '0.5px solid var(--line)', borderRadius: 8, padding: '10px 12px', lineHeight: 1.5 }}>{result}</div>}
          <div style={{ fontSize: 10.5, color: 'var(--txt-3)', lineHeight: 1.5 }}>
            <strong>Enviar</strong>: cria um evento MISP com os IOCs da operação. <strong>Importar</strong>: traz atributos do MISP como novos IOCs (sem duplicar).
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function IocPage() {
  const operations = useDataStore(s => s.operations)
  const { showToast, requestConfirm } = useUIStore()
  const [iocs,        setIocs]        = useState<IOC[]>([])
  const [query,       setQuery]       = useState('')
  const [typeFilter,  setTypeFilter]  = useState<IOCType | 'all'>('all')
  const [sevFilter,   setSevFilter]   = useState<IOCThreatLevel | 'all'>('all')
  const [opFilter,    setOpFilter]    = useState<string>('all')
  const [showAdd,     setShowAdd]     = useState(false)
  const [enrich,      setEnrich]      = useState<IOC | null>(null)
  const [mispOpen,    setMispOpen]    = useState(false)
  const [sortBy,      setSortBy]      = useState<'lastSeen' | 'firstSeen' | 'threatLevel'>('lastSeen')

  const sevOrder: Record<IOCThreatLevel, number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 }

  const filtered = useMemo(() => {
    return iocs
      .filter(i => typeFilter === 'all' || i.type === typeFilter)
      .filter(i => sevFilter === 'all'  || i.threatLevel === sevFilter)
      .filter(i => opFilter === 'all'   || i.operationId === opFilter)
      .filter(i => !query || i.value.toLowerCase().includes(query.toLowerCase())
                          || i.description.toLowerCase().includes(query.toLowerCase())
                          || i.tags.some(t => t.toLowerCase().includes(query.toLowerCase())))
      .sort((a, b) => {
        if (sortBy === 'threatLevel') return sevOrder[a.threatLevel] - sevOrder[b.threatLevel]
        return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime()
      })
  }, [iocs, query, typeFilter, sevFilter, opFilter, sortBy])

  const stats = useMemo(() => ({
    total:    iocs.length,
    critical: iocs.filter(i => i.threatLevel === 'critical').length,
    high:     iocs.filter(i => i.threatLevel === 'high').length,
    medium:   iocs.filter(i => i.threatLevel === 'medium').length,
    low:      iocs.filter(i => i.threatLevel === 'low' || i.threatLevel === 'informational').length,
  }), [iocs])

  function fmtDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  useEffect(() => {
    listIocs().then(setIocs).catch(() => setIocs([]))
  }, [])

  async function deleteIoc(id: string) {
    setIocs(prev => prev.filter(i => i.id !== id))
    try { await apiDeleteIoc(id) } catch { showToast('Falha ao remover IOC', 'error') }
  }

  async function addIoc(input: CreateIocInput) {
    try {
      const created = await createIoc(input)
      setIocs(prev => [created, ...prev])
      setShowAdd(false)
      showToast('IOC adicionado', 'success')
    } catch {
      showToast('Falha ao adicionar IOC', 'error')
    }
  }

  const opName = (id: string) => operations.find(o => o.id === id)?.name.slice(0, 22) ?? id

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{
        padding: '14px 24px', borderBottom: '0.5px solid var(--border)',
        background: 'var(--bg-surface)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Indicadores de Comprometimento
          </h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            IOCs coletados em todas as operações
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn"
            style={{ padding: '6px 14px', fontSize: 12 }}
            onClick={() => setMispOpen(true)}
            title="Sincronizar IOCs com MISP"
          >
            <Share2 size={12} /> MISP
          </button>
          <button
            className="btn btn-accent"
            style={{ padding: '6px 14px', fontSize: 12 }}
            onClick={() => setShowAdd(v => !v)}
          >
            <Plus size={12} /> Adicionar IOC
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'flex', borderBottom: '0.5px solid var(--border)',
        background: 'var(--bg-surface)', flexShrink: 0,
      }}>
        {[
          { label: 'Total',    value: stats.total,    color: 'var(--text-primary)' },
          { label: 'Críticos', value: stats.critical,  color: 'var(--crit)' },
          { label: 'Altos',    value: stats.high,      color: 'var(--high)' },
          { label: 'Médios',   value: stats.medium,    color: 'var(--med)' },
          { label: 'Baixo / Info', value: stats.low,   color: 'var(--low)' },
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

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

        {/* Add form */}
        {showAdd && <AddIocForm onAdd={addIoc} onCancel={() => setShowAdd(false)} />}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text" placeholder="Buscar por valor, descrição ou tag..." value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px 7px 30px',
                background: 'rgba(255,255,255,.04)', border: '0.5px solid var(--line)',
                borderRadius: 7, color: 'var(--htxt)', fontSize: 12, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Severity chips */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', ...ALL_SEVS] as const).map(s => {
              const active = sevFilter === s
              const label = s === 'all' ? 'Todas' : SEV_META[s].label
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

          {/* Operation filter */}
          <select
            value={opFilter} onChange={e => setOpFilter(e.target.value)}
            style={{
              padding: '6px 10px', background: 'rgba(255,255,255,.04)',
              border: '0.5px solid var(--line)', borderRadius: 7,
              color: 'var(--htxt)', fontSize: 12, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="all">Todas as operações</option>
            {operations.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
          </select>

          {/* Sort */}
          <select
            value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{
              padding: '6px 10px', background: 'rgba(255,255,255,.04)',
              border: '0.5px solid var(--line)', borderRadius: 7,
              color: 'var(--htxt)', fontSize: 12, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="lastSeen">Mais recentes</option>
            <option value="firstSeen">1ª vez visto</option>
            <option value="threatLevel">Severidade</option>
          </select>

          {(query || typeFilter !== 'all' || sevFilter !== 'all' || opFilter !== 'all') && (
            <button
              onClick={() => { setQuery(''); setTypeFilter('all'); setSevFilter('all'); setOpFilter('all') }}
              style={{ padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, background: 'rgba(226,75,74,.1)', color: '#e24b4a', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={10} /> Limpar
            </button>
          )}
        </div>

        {/* Type filter row */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
          <button
            onClick={() => setTypeFilter('all')}
            style={{ padding: '3px 9px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 10.5, background: typeFilter === 'all' ? 'rgba(127,119,221,.2)' : 'rgba(255,255,255,.04)', color: typeFilter === 'all' ? '#a09ae8' : 'var(--text-muted)' }}
          >
            Todos
          </button>
          {ALL_TYPES.map(t => {
            const m = TYPE_META[t]
            const active = typeFilter === t
            const count = iocs.filter(i => i.type === t).length
            if (!count) return null
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{
                  padding: '3px 9px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 10.5,
                  background: active ? m.bg : 'rgba(255,255,255,.04)',
                  color: active ? m.color : 'var(--text-muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {m.label} <span style={{ opacity: .6 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: 10, border: '0.5px solid var(--border)', overflow: 'hidden' }}>

          {/* Table head */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr 90px 160px 90px 90px 28px 28px 28px 28px',
            padding: '8px 14px', borderBottom: '0.5px solid var(--border)',
            background: 'rgba(255,255,255,.02)',
          }}>
            {['Tipo', 'Valor / Descrição', 'Ameaça', 'Operação', '1ª vez', 'Última vez', '', '', '', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum IOC encontrado para os filtros aplicados.
            </div>
          ) : (
            filtered.map((ioc, i) => {
              const sev = SEV_META[ioc.threatLevel]
              return (
                <div
                  key={ioc.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 90px 160px 90px 90px 28px 28px 28px 28px',
                    padding: '9px 14px', alignItems: 'center',
                    borderBottom: i < filtered.length - 1 ? '0.5px solid var(--line)' : 'none',
                    borderLeft: `2px solid ${sev.color}`,
                    transition: 'background .1s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <TypeBadge type={ioc.type} />

                  <div style={{ overflow: 'hidden', paddingRight: 12 }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5,
                      color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: 2,
                    }}>
                      {ioc.value}
                    </div>
                    {ioc.description && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ioc.description}
                      </div>
                    )}
                    {ioc.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                        {ioc.tags.map(t => (
                          <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,.05)', color: 'var(--text-muted)' }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <SevDot level={ioc.threatLevel} />

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opName(ioc.operationId)}
                  </div>

                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmtDate(ioc.firstSeen)}
                  </div>

                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmtDate(ioc.lastSeen)}
                  </div>

                  {ENRICHABLE.has(ioc.type) ? (
                    <button
                      className="hbtn"
                      style={{ width: 24, height: 24, padding: 0, justifyContent: 'center', flexShrink: 0, color: 'rgba(var(--accent-rgb),1)' }}
                      title="Enriquecer (threat intel)"
                      onClick={() => setEnrich(ioc)}
                    >
                      <ShieldAlert size={11} />
                    </button>
                  ) : <span />}

                  <CopyBtn value={ioc.value} />

                  <button
                    className="hbtn"
                    style={{ width: 24, height: 24, padding: 0, justifyContent: 'center', flexShrink: 0 }}
                    title="Ver no VirusTotal"
                    onClick={() => window.open(`https://www.virustotal.com/gui/search/${encodeURIComponent(ioc.value)}`, '_blank')}
                  >
                    <ExternalLink size={10} />
                  </button>

                  <button
                    className="hbtn"
                    style={{ width: 24, height: 24, padding: 0, justifyContent: 'center', flexShrink: 0, color: 'rgba(226,75,74,.5)' }}
                    onClick={() => requestConfirm({
                      title: 'Apagar IOC',
                      message: `Apagar o indicador "${ioc.value}"? Esta ação não pode ser desfeita.`,
                      confirmLabel: 'Apagar',
                      danger: true,
                      onConfirm: () => deleteIoc(ioc.id),
                    })}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
          {filtered.length} de {iocs.length} indicadores
        </div>
      </div>

      {enrich && (
        <div
          onClick={() => setEnrich(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 'min(820px, 96vw)', height: 'min(80vh, 640px)', display: 'flex', flexDirection: 'column', background: 'var(--hbg)', border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
              <ShieldAlert size={14} style={{ color: 'rgba(var(--accent-rgb),1)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--htxt)' }}>Enriquecer IOC</span>
              <span style={{ fontSize: 11.5, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace" }}>{enrich.value}</span>
              <div style={{ flex: 1 }} />
              <button className="hbtn" style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }} onClick={() => setEnrich(null)}><X size={13} /></button>
            </div>
            <IocEnrichView ioc={enrich} onResult={(u) => { setIocs(prev => prev.map(i => i.id === u.id ? u : i)); setEnrich(u) }} />
          </div>
        </div>
      )}

      {mispOpen && (
        <MispModal
          defaultOpId={opFilter !== 'all' ? opFilter : ''}
          onClose={() => { setMispOpen(false); listIocs().then(setIocs).catch(() => {}) }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
