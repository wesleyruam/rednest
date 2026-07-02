import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, ExternalLink } from 'lucide-react'
import { getNvdStats, searchCves, syncNvd, type Cve, type NvdStats } from '@/services/nvd'
import { useUIStore } from '@/store/ui'

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#e24b4a', HIGH: '#ff9f5a', MEDIUM: '#f4bc6a', LOW: '#5ad1ff', NONE: 'var(--txt-3)',
}
const SEVS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="block hot" style={{ minWidth: 0 }}>
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="bbody" style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  )
}

export function VulnerabilitiesPage() {
  const { showToast } = useUIStore()
  const [stats, setStats] = useState<NvdStats | null>(null)
  const [items, setItems] = useState<Cve[]>([])
  const [q, setQ] = useState('')
  const [severity, setSeverity] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [s, it] = await Promise.all([getNvdStats(), searchCves({ q: q || undefined, severity: severity || undefined })])
      setStats(s); setItems(it)
    } catch { /* ignore */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [severity])

  async function doSearch() {
    setLoading(true)
    try {
      const isCve = /^CVE-\d{4}-\d+$/i.test(q.trim())
      setItems(await searchCves(isCve ? { cve: q.trim() } : { q: q || undefined, severity: severity || undefined }))
    } catch { showToast('Falha na busca', 'error') } finally { setLoading(false) }
  }

  async function sync() {
    setSyncing(true)
    try {
      const r = await syncNvd()
      showToast(`NVD sincronizado: ${r.synced} CVEs`, 'success')
      await load()
    } catch { showToast('Falha ao sincronizar NVD', 'error') } finally { setSyncing(false) }
  }

  const cvssMax = stats ? Math.max(1, ...Object.values(stats.cvss)) : 1

  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', padding: '20px 24px', background: 'var(--hbg)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--htxt)' }}>Vulnerabilidades (NVD)</div>
          <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>
            Base NIST sincronizada localmente · {stats?.lastSync ? `última sync: ${new Date(stats.lastSync).toLocaleString('pt-BR')}` : 'nunca sincronizado'}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="hbtn" onClick={sync} disabled={syncing} style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)' }}>
          {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
          {syncing ? 'Sincronizando…' : 'Sincronizar NVD'}
        </button>
      </div>

      {/* Stats por severidade */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <Stat label="Total (local)" value={stats?.total ?? 0} color="var(--htxt)" />
        {SEVS.map(s => <Stat key={s} label={s} value={stats?.severity[s] ?? 0} color={SEV_COLOR[s]} />)}
      </div>

      {/* Distribuição CVSS + top vendors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="block hot">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Distribuição CVSS</div>
          <div className="bbody">
            {stats && Object.entries(stats.cvss).map(([bucket, n]) => (
              <div key={bucket} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--txt-3)', width: 44, fontFamily: "'JetBrains Mono', monospace" }}>{bucket}</span>
                <div style={{ flex: 1, height: 12, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(n / cvssMax) * 100}%`, background: bucket === '9-10' ? '#e24b4a' : bucket === '7-9' ? '#ff9f5a' : bucket === '4-7' ? '#f4bc6a' : '#5ad1ff' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--htxt)', width: 44, textAlign: 'right' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="block hot">
          <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
          <div className="bhead">Principais fabricantes</div>
          <div className="bbody" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(stats?.topVendors ?? []).map(v => (
              <button key={v.vendor} onClick={() => { setQ(v.vendor); searchCves({ q: v.vendor }).then(setItems) }} className="hbtn" style={{ fontSize: 11, height: 24 }}>
                {v.vendor} <span style={{ color: 'var(--txt-3)', marginLeft: 4 }}>{v.count}</span>
              </button>
            ))}
            {!stats?.topVendors?.length && <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>Sincronize para ver os dados.</span>}
          </div>
        </div>
      </div>

      {/* Busca + filtros */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setSeverity('')} className="hbtn" style={{ fontSize: 11, height: 26, background: !severity ? 'rgba(var(--accent-rgb),.2)' : undefined, borderColor: !severity ? 'rgba(var(--accent-rgb),.5)' : undefined }}>Todas</button>
        {SEVS.map(s => (
          <button key={s} onClick={() => setSeverity(s)} className="hbtn" style={{ fontSize: 11, height: 26, color: severity === s ? SEV_COLOR[s] : undefined, borderColor: severity === s ? SEV_COLOR[s] : undefined }}>{s}</button>
        ))}
        <div style={{ flex: 1 }} />
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder="CVE-2024-… ou produto/fornecedor"
          style={{ width: 280, padding: '6px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--htxt)', fontSize: 12.5, outline: 'none' }} />
        <button className="hbtn" onClick={doSearch}>Buscar</button>
      </div>

      {/* Lista */}
      <div className="block hot">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bbody">
          {loading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--txt-3)' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : items.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--txt-3)' }}>
              Nenhuma CVE. Clique em <b>Sincronizar NVD</b> ou busque uma CVE específica (busca ao vivo).
            </div>
          ) : items.map(c => (
            <div key={c.cveId} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: '0.5px solid var(--line)' }}>
              <span style={{ flexShrink: 0, width: 50, textAlign: 'center', fontSize: 13, fontWeight: 700, color: SEV_COLOR[c.cvssSeverity ?? 'NONE'] }}>{c.cvssScore ?? '—'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace" }}>{c.cveId}</span>
                  {c.cvssSeverity && <span className="tag" style={{ fontSize: 9, color: SEV_COLOR[c.cvssSeverity], borderColor: `${SEV_COLOR[c.cvssSeverity]}55`, background: `${SEV_COLOR[c.cvssSeverity]}1a` }}>{c.cvssSeverity}</span>}
                  {c.cwe && <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{c.cwe}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--txt-2)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</div>
                {c.vendors.length > 0 && <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 3 }}>{c.vendors.slice(0, 6).join(', ')}{c.published ? ` · ${new Date(c.published).toLocaleDateString('pt-BR')}` : ''}</div>}
              </div>
              <a href={`https://nvd.nist.gov/vuln/detail/${c.cveId}`} target="_blank" rel="noreferrer" style={{ color: 'var(--txt-3)', flexShrink: 0 }}><ExternalLink size={13} /></a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
