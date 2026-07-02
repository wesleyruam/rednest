import { useEffect, useState } from 'react'
import {
  Loader2, Globe, Server, Mail, AtSign, User, ShieldAlert, Database, Link2,
  Network, Camera, Bug, KeyRound, ExternalLink, RefreshCw, Plus, Trash2, X,
} from 'lucide-react'
import type { Engagement } from '@/types'
import { listFindings, addFinding, deleteFinding, type Finding } from '@/services/findings'
import { useUIStore } from '@/store/ui'

const TYPE_META: Record<string, { label: string; Icon: any; color: string }> = {
  subdomain:  { label: 'Subdomínios',  Icon: Globe,       color: '#5ad1ff' },
  host:       { label: 'Hosts / IPs',  Icon: Server,      color: '#8a9cff' },
  email:      { label: 'E-mails',      Icon: Mail,        color: '#5ad1ff' },
  username:   { label: 'Usuários',     Icon: AtSign,      color: '#EF9F27' },
  profile:    { label: 'Perfis',       Icon: User,        color: '#e879f9' },
  service:    { label: 'Serviços',     Icon: Server,      color: '#8a9cff' },
  url:        { label: 'URLs',         Icon: Link2,       color: '#5ad1ff' },
  endpoint:   { label: 'Endpoints',    Icon: Network,     color: '#5ad1ff' },
  ioc:        { label: 'IOCs',         Icon: ShieldAlert, color: '#a09ae8' },
  leak:       { label: 'Vazamentos',   Icon: Database,    color: '#e24b4a' },
  credential: { label: 'Credenciais',  Icon: KeyRound,    color: '#e24b4a' },
  cve:        { label: 'CVEs',         Icon: Bug,         color: '#ff9f5a' },
  screenshot: { label: 'Capturas',     Icon: Camera,      color: '#e879f9' },
  tech:       { label: 'Tecnologias',  Icon: Server,      color: '#4dd4a4' },
}

function sevColor(s?: string | null) {
  if (s === 'high' || s === 'critical') return 'var(--down)'
  if (s === 'medium') return '#f4bc6a'
  return 'var(--txt-3)'
}

function linkFor(f: Finding): string | null {
  if (f.type === 'url' || f.type === 'screenshot') return f.value
  if (f.type === 'subdomain' || f.type === 'host') return null
  if (f.type === 'cve') return `https://nvd.nist.gov/vuln/detail/${f.value}`
  if (f.type === 'profile' && f.data?.url) return f.data.url
  if (f.type === 'profile' && typeof f.value === 'string' && f.value.includes('http')) {
    const m = f.value.match(/https?:\/\/\S+/)
    return m ? m[0] : null
  }
  return null
}

const inp: React.CSSProperties = { padding: '8px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--htxt)', fontSize: 12.5, outline: 'none', fontFamily: 'inherit', width: '100%' }

export function FindingsView({ engagement, types, title }: { engagement: Engagement; types: string[]; title: string }) {
  const { showToast } = useUIStore()
  const [items, setItems] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: types[0], label: '', value: '', url: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const all = await Promise.all(types.map(t => listFindings(engagement.id, t)))
      setItems(all.flat().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [engagement.id, types.join(',')])

  async function add() {
    const value = form.value.trim()
    if (!value) { showToast('Informe o valor (URL, @usuário, host…)', 'error'); return }
    setBusy(true)
    try {
      const url = form.url.trim() || (value.startsWith('http') ? value : undefined)
      await addFinding(engagement.id, { type: form.type, value, label: form.label.trim() || undefined, url })
      showToast('Adicionado', 'success'); setForm({ type: types[0], label: '', value: '', url: '' }); setShowForm(false); load()
    } catch { showToast('Falha ao adicionar', 'error') } finally { setBusy(false) }
  }
  async function remove(id: string) {
    setItems(prev => prev.filter(f => f.id !== id))
    try { await deleteFinding(engagement.id, id) } catch { load() }
  }

  const present = types.filter(t => items.some(i => i.type === t))
  const shown = active === 'all' ? items : items.filter(i => i.type === active)

  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', padding: '18px 20px', background: 'var(--hbg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--htxt)' }}>{title}</span>
        <span className="tag">{items.length}</span>
        <div style={{ flex: 1 }} />
        <button className="hbtn" onClick={() => setShowForm(v => !v)} style={{ height: 26, gap: 5, background: showForm ? 'rgba(var(--accent-rgb),.2)' : undefined }}>
          <Plus size={12} /> Adicionar
        </button>
        <button className="hbtn" onClick={load} style={{ height: 26 }}>
          {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
        </button>
      </div>

      {showForm && (
        <div className="block hot">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Plus size={13} /><span style={{ flex: 1 }}>Adicionar manualmente</span><X size={14} style={{ cursor: 'pointer', color: 'var(--txt-3)' }} onClick={() => setShowForm(false)} /></div>
          <div className="bbody" style={{ display: 'grid', gridTemplateColumns: types.length > 1 ? '140px 1fr 1fr' : '1fr 1fr', gap: 8 }}>
            {types.length > 1 && (
              <select style={{ ...inp, cursor: 'pointer' }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {types.map(t => <option key={t} value={t}>{TYPE_META[t]?.label ?? t}</option>)}
              </select>
            )}
            <input style={inp} placeholder={form.type === 'profile' ? 'Rede / plataforma (ex.: Instagram)' : 'Rótulo (opcional)'} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            <input style={{ ...inp, fontFamily: "'JetBrains Mono', monospace" }} placeholder={form.type === 'profile' ? 'URL ou @usuário' : 'Valor (URL, host, e-mail…)'} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} onKeyDown={e => e.key === 'Enter' && !busy && add()} />
            <input style={{ ...inp, gridColumn: types.length > 1 ? '2 / -1' : '1 / -1', fontFamily: "'JetBrains Mono', monospace" }} placeholder="URL do perfil (opcional — para o botão abrir)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            <button className="hbtn" disabled={busy} onClick={add} style={{ gridColumn: '1 / -1', justifyContent: 'center', background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)', height: 32 }}>
              {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />} Adicionar
            </button>
          </div>
        </div>
      )}

      {present.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setActive('all')} className="hbtn" style={{ fontSize: 10.5, height: 22, background: active === 'all' ? 'rgba(var(--accent-rgb),.2)' : undefined }}>Tudo ({items.length})</button>
          {present.map(t => {
            const m = TYPE_META[t]
            return <button key={t} onClick={() => setActive(t)} className="hbtn" style={{ fontSize: 10.5, height: 22, background: active === t ? 'rgba(var(--accent-rgb),.2)' : undefined }}>{m?.label ?? t} ({items.filter(i => i.type === t).length})</button>
          })}
        </div>
      )}

      <div className="block hot">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bbody">
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--txt-3)' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : shown.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--txt-3)' }}>
              Nada coletado ainda. Rode as ferramentas (ou o Auto-enriquecimento) e os achados aparecem aqui.
            </div>
          ) : shown.some(f => f.type === 'screenshot' && f.data?.screenshot) && active === 'screenshot' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {shown.filter(f => f.type === 'screenshot').map(f => (
                <a key={f.id} href={f.data?.screenshot || f.value} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  {f.data?.screenshot
                    ? <img src={f.data.screenshot} alt="" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line-2)' }} />
                    : <div style={{ height: 120, borderRadius: 8, border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt-3)' }}><Camera size={20} /></div>}
                  <div style={{ fontSize: 10.5, color: 'var(--htxt)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>{f.label || f.value}</div>
                </a>
              ))}
            </div>
          ) : shown.map(f => {
            const m = TYPE_META[f.type] ?? { label: f.type, Icon: Database, color: 'var(--txt-3)' }
            const link = linkFor(f)
            return (
              <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid var(--line)' }}>
                <m.Icon size={13} style={{ color: m.color, flexShrink: 0 }} />
                <span className="tag" style={{ fontSize: 9, flexShrink: 0, color: m.color, borderColor: `${m.color}44`, background: `${m.color}12` }}>{m.label}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.label ? <span style={{ color: 'var(--txt-2)', fontFamily: 'inherit' }}>{f.label} · </span> : null}{f.value}
                </span>
                {f.severity && <span style={{ fontSize: 10, color: sevColor(f.severity), flexShrink: 0 }}>{f.severity}</span>}
                {f.source && <span style={{ fontSize: 9.5, color: 'var(--txt-3)', flexShrink: 0 }}>{f.source}</span>}
                {link && <a href={link} target="_blank" rel="noreferrer" style={{ color: 'var(--txt-3)', flexShrink: 0 }}><ExternalLink size={12} /></a>}
                <button onClick={() => remove(f.id)} title="Remover" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(226,75,74,.55)', display: 'flex', flexShrink: 0, padding: 0 }}><Trash2 size={12} /></button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
