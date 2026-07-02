import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, ShieldAlert, Rss, Database, AlertTriangle, ExternalLink } from 'lucide-react'
import { getThreatFeedStats, listThreatFeed, syncThreatFeeds, type ThreatFeedItem, type ThreatFeedStats } from '@/services/threatfeeds'
import { useUIStore } from '@/store/ui'

const FILTERS = [
  { id: '', label: 'Tudo' },
  { id: 'kev', label: 'CISA KEV' },
  { id: 'ioc', label: 'IOCs' },
  { id: 'advisory', label: 'Advisories' },
]

function Stat({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className="block hot" style={{ minWidth: 0 }}>
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="bbody" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--txt-3)' }}>{icon}{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  )
}

export function ThreatFeedsPage() {
  const { showToast } = useUIStore()
  const [stats, setStats] = useState<ThreatFeedStats | null>(null)
  const [items, setItems] = useState<ThreatFeedItem[]>([])
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [s, it] = await Promise.all([getThreatFeedStats(), listThreatFeed({ type: type || undefined, q: q || undefined })])
      setStats(s); setItems(it)
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [type])

  async function sync() {
    setSyncing(true)
    try {
      const r = await syncThreatFeeds()
      showToast(`Sincronizado: ${r.kev} KEV, ${r.rss} advisories, ${r.iocs} IOCs`, 'success')
      await load()
    } catch {
      showToast('Falha ao sincronizar feeds', 'error')
    } finally { setSyncing(false) }
  }

  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--hbg)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--htxt)' }}>Threat Feeds</div>
          <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>
            Inteligência centralizada e normalizada · {stats?.lastSync ? `última sync: ${new Date(stats.lastSync).toLocaleString('pt-BR')}` : 'nunca sincronizado'}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="hbtn" onClick={sync} disabled={syncing} style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)' }}>
          {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
          {syncing ? 'Sincronizando…' : 'Sincronizar'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        <Stat label="Total" value={stats?.total ?? 0} icon={<Database size={12} />} color="var(--htxt)" />
        <Stat label="CISA KEV" value={stats?.kev ?? 0} icon={<ShieldAlert size={12} />} color="#f4bc6a" />
        <Stat label="IOCs" value={stats?.iocs ?? 0} icon={<AlertTriangle size={12} />} color="#5ad1ff" />
        <Stat label="Advisories" value={stats?.advisories ?? 0} icon={<Rss size={12} />} color="#a9a4ee" />
        <Stat label="Ransomware (KEV)" value={stats?.ransomware ?? 0} icon={<ShieldAlert size={12} />} color="var(--down)" />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setType(f.id)} className="hbtn" style={{ fontSize: 11, height: 26, background: type === f.id ? 'rgba(var(--accent-rgb),.2)' : undefined, borderColor: type === f.id ? 'rgba(var(--accent-rgb),.5)' : undefined, color: type === f.id ? 'var(--htxt)' : undefined }}>
            {f.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="buscar CVE, produto, IOC…"
          style={{ width: 260, padding: '6px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--htxt)', fontSize: 12.5, outline: 'none' }} />
      </div>

      <div className="block hot">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bbody">
          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--txt-3)' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : items.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--txt-3)' }}>
              Nenhum item. Clique em <b>Sincronizar</b> para baixar CISA KEV + feeds RSS.
            </div>
          ) : items.map(it => (
            <div key={it.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '0.5px solid var(--line)' }}>
              <span className="tag" style={{ fontSize: 9, flexShrink: 0, marginTop: 2, color: it.type === 'kev' ? '#f4bc6a' : it.type === 'ioc' ? '#5ad1ff' : '#a9a4ee' }}>
                {it.type === 'kev' ? 'KEV' : it.type === 'ioc' ? (it.iocType ?? 'IOC').toUpperCase() : 'RSS'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: 'var(--htxt)' }}>
                  {it.indicator && <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#7ab8f0', marginRight: 6 }}>{it.indicator}</span>}
                  {it.title}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginTop: 2 }}>
                  {it.vendor && `${it.vendor} ${it.product ?? ''} · `}
                  {it.severity === 'ransomware' && <span style={{ color: 'var(--down)' }}>ransomware · </span>}
                  {it.source}{it.publishedAt ? ` · ${new Date(it.publishedAt).toLocaleDateString('pt-BR')}` : ''}
                </div>
              </div>
              {it.url && <a href={it.url} target="_blank" rel="noreferrer" style={{ color: 'var(--txt-3)', flexShrink: 0 }}><ExternalLink size={13} /></a>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
