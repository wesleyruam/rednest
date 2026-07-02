import { useEffect, useRef, useState } from 'react'
import {
  Loader2, RefreshCw, CheckCircle2, ChevronLeft, ChevronRight, ShieldCheck, Network,
  Play, Trash2, Upload, Plus, FlaskConical, FileText, ExternalLink,
} from 'lucide-react'
import {
  listProxies, proxyStats, refreshProxies, validateProxies, testProxy, testProxyById, importProxies, deleteProxy,
  type Proxy, type ProxyStats, type ProxyTestResult,
} from '@/services/proxies'
import { useUIStore } from '@/store/ui'

const PROTO_COLOR: Record<string, string> = { http: '#378ADD', socks4: '#EF9F27', socks5: '#1D9E75' }
const ANON_COLOR: Record<string, string> = { elite: '#1D9E75', anonymous: '#378ADD', transparent: '#e24b4a' }
const ANON_LABEL: Record<string, string> = { elite: 'Elite', anonymous: 'Anônimo', transparent: 'Transparente' }
const flag = (cc?: string | null) => cc && cc.length === 2 ? cc.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0))) : ''
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }

const STATUS_TABS = [['alive', 'Vivos'], ['all', 'Todos'], ['dead', 'Mortos']] as const
const PROTOCOLS = ['', 'http', 'socks4', 'socks5'] as const

function ProtoBadge({ p }: { p: string }) {
  const c = PROTO_COLOR[p] ?? 'var(--text-muted)'
  return <span style={{ fontSize: 11, fontWeight: 600, color: c, border: `1px solid ${c}66`, background: `${c}1a`, borderRadius: 6, padding: '3px 9px' }}>{p}</span>
}
function card(): React.CSSProperties {
  return { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 11, padding: 16 }
}

export function ProxiesTab() {
  const { showToast } = useUIStore()
  const [stats, setStats] = useState<ProxyStats | null>(null)
  const [items, setItems] = useState<Proxy[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('alive')
  const [protocol, setProtocol] = useState('')
  const [country, setCountry] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  // painel: testar um proxy
  const [testInput, setTestInput] = useState('')
  const [testRes, setTestRes] = useState<ProxyTestResult | null>(null)
  const [testing, setTesting] = useState(false)
  // painel: adicionar múltiplos
  const [multiText, setMultiText] = useState('')
  const [importing, setImporting] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadStats = () => proxyStats().then(setStats).catch(() => setStats(null))
  const load = () => {
    setLoading(true)
    listProxies({ page, pageSize: 20, status, protocol, country })
      .then(r => { setItems(r.items); setPages(r.pages); setTotal(r.total) })
      .catch(() => setItems([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [page, status, protocol, country])
  useEffect(() => { loadStats() }, [])
  useEffect(() => { setPage(1) }, [status, protocol, country])

  async function doRefresh() { setBusy('refresh'); try { const r = await refreshProxies(); showToast(`Lista atualizada: ${r.added} no pool`, 'success'); loadStats(); load() } catch { showToast('Falha ao atualizar', 'error') } finally { setBusy(null) } }
  async function doValidate() { setBusy('validate'); try { const r = await validateProxies(); showToast(`Validados ${r.checked} · ${r.alive} vivos`, 'success'); loadStats(); load() } catch { showToast('Falha ao validar', 'error') } finally { setBusy(null) } }

  async function runTest() {
    if (!testInput.trim()) return
    setTesting(true); setTestRes(null)
    try { setTestRes(await testProxy(testInput.trim())) } catch { setTestRes({ error: 'Falha no teste.' }) } finally { setTesting(false) }
  }
  async function testRow(id: string) {
    setRowBusy(id)
    try { const u = await testProxyById(id); setItems(prev => prev.map(p => p.id === id ? u : p)); showToast(u.alive ? `Vivo · ${u.latencyMs}ms` : 'Morto', u.alive ? 'success' : 'error'); loadStats() }
    catch { showToast('Falha no teste', 'error') } finally { setRowBusy(null) }
  }
  async function removeRow(id: string) {
    setItems(prev => prev.filter(p => p.id !== id))
    await deleteProxy(id).catch(() => {}); loadStats()
  }
  async function doImport(text: string) {
    if (!text.trim()) return
    setImporting(true)
    try { const r = await importProxies(text); showToast(`${r.added} adicionados (${r.invalid} inválidos) · validando…`, 'success'); setMultiText(''); loadStats(); load() }
    catch { showToast('Falha ao importar', 'error') } finally { setImporting(false) }
  }
  function onFile(file?: File | null) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showToast('Arquivo > 5MB', 'error'); return }
    const reader = new FileReader()
    reader.onload = () => doImport(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const alivePct = stats && stats.total ? (stats.alive / stats.total * 100) : 0
  const detected = multiText.split(/\r?\n/).filter(l => /^(http|socks4|socks5):\/\/[\d.]+:\d{2,5}$/i.test(l.trim())).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: 'var(--text-primary)' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(55,138,221,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Network size={18} style={{ color: 'var(--accent-blue)' }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Proxies</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>Pool global de proxies (ProxyScrape) — usado por todas as operações para roteamento e checagens geo-distribuídas.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn" onClick={doRefresh} disabled={!!busy} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{busy === 'refresh' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />} Atualizar lista</button>
          <button className="btn" onClick={doValidate} disabled={!!busy} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(55,138,221,.16)', borderColor: 'rgba(55,138,221,.4)', color: 'var(--text-primary)' }}>{busy === 'validate' || stats?.validating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />} Validar pool</button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={card()}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Vivos / Total</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{stats?.alive ?? '—'} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>/ {stats?.total ?? '—'}</span></div>
          <div style={{ fontSize: 11.5, color: alivePct < 10 ? '#e24b4a' : 'var(--text-secondary)', marginTop: 2 }}>{alivePct.toFixed(1)}% vivos</div>
          <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', marginTop: 8 }}><div style={{ width: `${alivePct}%`, height: '100%', borderRadius: 3, background: '#1D9E75' }} /></div>
        </div>
        <div style={card()}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Por protocolo (vivos)</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {(['http', 'socks4', 'socks5'] as const).map(p => (
              <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ProtoBadge p={p} /><b style={{ fontSize: 13 }}>{stats?.protocols?.[p] ?? 0}</b></span>
            ))}
          </div>
        </div>
        <div style={card()}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Top países (vivos)</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {(stats?.countries ?? []).slice(0, 5).map(c => (
              <button key={c.country} onClick={() => setCountry(country === c.country ? '' : c.country)} style={{ fontSize: 11.5, cursor: 'pointer', background: country === c.country ? 'rgba(55,138,221,.2)' : 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 9px', color: 'var(--text-primary)' }}>{flag(c.country)} {c.country} <b>{c.count}</b></button>
            ))}
            {(stats?.countries?.length ?? 0) > 5 && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', alignSelf: 'center' }}>+{(stats!.countries.length) - 5}</span>}
          </div>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {STATUS_TABS.map(([k, label]) => <button key={k} onClick={() => setStatus(k)} style={{ fontSize: 12, cursor: 'pointer', padding: '5px 14px', borderRadius: 7, border: '1px solid var(--border)', background: status === k ? 'rgba(55,138,221,.2)' : 'transparent', color: status === k ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</button>)}
        </div>
        <select value={protocol} onChange={e => setProtocol(e.target.value)} style={{ fontSize: 12, padding: '6px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-primary)', cursor: 'pointer' }}>
          {PROTOCOLS.map(p => <option key={p} value={p}>{p ? `Protocolo: ${p}` : 'Todos protocolos'}</option>)}
        </select>
        {country && <><span style={{ fontSize: 11.5, background: 'rgba(55,138,221,.2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px' }}>{flag(country)} {country} <span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setCountry('')}>✕</span></span><button onClick={() => setCountry('')} style={{ fontSize: 11.5, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Limpar</button></>}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>{total} proxies</span>
      </div>

      {/* ── Tabela ── */}
      <div style={{ ...card(), padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 90px 80px 130px 90px', gap: 8, padding: '11px 16px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)' }}>
          <span>Status</span><span>Proxy</span><span>Protocolo</span><span>Latência</span><span>País</span><span>Anonimato</span><span style={{ textAlign: 'center' }}>Ações</span>
        </div>
        {loading ? <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /></div>
          : items.length === 0 ? <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>Nenhum proxy. Clique em "Atualizar lista" e depois "Validar pool", ou adicione abaixo.</div>
          : items.map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 90px 80px 130px 90px', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: p.alive ? '#1D9E75' : '#e24b4a' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: p.alive ? '#1D9E75' : '#e24b4a', boxShadow: p.alive ? '0 0 6px #1D9E75aa' : 'none' }} />{p.alive ? 'Vivo' : 'Morto'}</span>
              <span style={{ ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.host}:{p.port}</span>
              <span><ProtoBadge p={p.protocol} /></span>
              <span style={{ color: p.latencyMs != null ? '#1D9E75' : 'var(--text-muted)', ...mono }}>{p.latencyMs != null ? `${p.latencyMs}ms` : '—'}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{p.country ? `${flag(p.country)} ${p.country}` : '—'}</span>
              <span>{p.anonymity ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: ANON_COLOR[p.anonymity] ?? 'var(--text-muted)' }}><ShieldCheck size={12} />{ANON_LABEL[p.anonymity] ?? p.anonymity}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</span>
              <span style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button onClick={() => testRow(p.id)} disabled={rowBusy === p.id} title="Testar" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent-blue)', cursor: 'pointer' }}>{rowBusy === p.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={12} />}</button>
                <button onClick={() => removeRow(p.id)} title="Remover" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: '#e24b4a', cursor: 'pointer' }}><Trash2 size={12} /></button>
              </span>
            </div>
          ))}
        {/* paginação */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ChevronLeft size={14} /> Anterior</button>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Página {page} de {pages}</span>
            <button className="btn" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Próxima <ChevronRight size={14} /></button>
          </div>
        )}
      </div>

      {/* ── Módulos: testar / adicionar / importar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {/* Testar um proxy */}
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><FlaskConical size={15} style={{ color: 'var(--accent-blue)' }} /><span style={{ fontSize: 14, fontWeight: 600 }}>Testar um proxy</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>Teste um proxy específico para verificar conectividade, latência e anonimato.</div>
          <input value={testInput} onChange={e => setTestInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !testing && runTest()} placeholder="socks4://ip:porta ou http://ip:porta" style={{ width: '100%', padding: '9px 11px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-primary)', fontSize: 12, outline: 'none', ...mono }} />
          <button onClick={runTest} disabled={testing} style={{ width: '100%', marginTop: 8, padding: '9px', borderRadius: 7, border: '1px solid var(--accent-blue)', background: 'var(--accent-blue)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{testing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={13} />} Testar proxy</button>
          {testRes && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Resultado do teste</div>
              {testRes.error ? <div style={{ fontSize: 12, color: '#e24b4a' }}>{testRes.error}</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <TRow k="Status" v={<span style={{ color: testRes.alive ? '#1D9E75' : '#e24b4a' }}>{testRes.alive ? '● Vivo' : '● Morto'}</span>} />
                  {testRes.latencyMs != null && <TRow k="Latência" v={`${testRes.latencyMs}ms`} />}
                  {testRes.exitIp && <TRow k="IP de saída" v={testRes.exitIp} />}
                  <TRow k="País" v={testRes.country ? `${flag(testRes.country)} ${testRes.country}` : '—'} />
                  {testRes.anonymity && <TRow k="Anonimato" v={<span style={{ color: ANON_COLOR[testRes.anonymity] ?? 'var(--text-muted)' }}>{ANON_LABEL[testRes.anonymity] ?? testRes.anonymity}</span>} />}
                  {testRes.protocol && <TRow k="Protocolo" v={testRes.protocol} />}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Adicionar múltiplos */}
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><Plus size={15} style={{ color: 'var(--accent-blue)' }} /><span style={{ fontSize: 14, fontWeight: 600 }}>Adicionar múltiplos proxies</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>Cole vários proxies no formato protocolo:ip:porta (http://, socks4:// ou socks5://).</div>
          <textarea value={multiText} onChange={e => setMultiText(e.target.value)} placeholder={'socks4://186.248.87.172:5678\nhttp://168.138.159.191:443\nsocks5://1.2.3.4:1080'} style={{ width: '100%', minHeight: 150, resize: 'vertical', padding: '9px 11px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-primary)', fontSize: 11.5, outline: 'none', ...mono }} />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '8px 0' }}>{detected} proxies detectados</div>
          <button onClick={() => doImport(multiText)} disabled={importing || detected === 0} style={{ width: '100%', padding: '9px', borderRadius: 7, border: '1px solid var(--accent-blue)', background: detected ? 'var(--accent-blue)' : 'rgba(55,138,221,.3)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: detected ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{importing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />} Adicionar ao pool</button>
        </div>

        {/* Importar arquivo */}
        <div style={card()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><FileText size={15} style={{ color: 'var(--accent-blue)' }} /><span style={{ fontSize: 14, fontWeight: 600 }}>Importar arquivo</span></div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>Importe uma lista de proxies via arquivo .txt (um por linha).</div>
          <input ref={fileRef} type="file" accept=".txt,text/plain" style={{ display: 'none' }} onChange={e => onFile(e.target.files?.[0])} />
          <div onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]) }}
            style={{ border: `1.5px dashed ${drag ? 'var(--accent-blue)' : 'var(--border-hover)'}`, borderRadius: 10, padding: '34px 16px', textAlign: 'center', cursor: 'pointer', background: drag ? 'rgba(55,138,221,.08)' : 'transparent' }}>
            {importing ? <Loader2 size={26} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-blue)' }} /> : <Upload size={26} style={{ color: 'var(--text-muted)' }} />}
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 10 }}>Arraste e solte o arquivo aqui<br />ou clique para selecionar</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>.txt até 5MB</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>Formato aceito:</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 9px', marginTop: 4, ...mono }}>protocolo://ip:porta (http, socks4, socks5)</div>
        </div>
      </div>

      {/* ── Aviso ── */}
      <div style={{ ...card(), display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
        <Network size={15} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Proxies públicos do ProxyScrape — use só para recon GET não autenticado. Nunca utilize para ações que exigem autenticação ou que possam violar termos de serviço.</span>
        <a href="https://github.com/ProxyScrape/free-proxy-list" target="_blank" rel="noreferrer" className="btn" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none', flexShrink: 0 }}>Saiba mais <ExternalLink size={12} /></a>
      </div>
    </div>
  )
}

function TRow({ k, v }: { k: string; v: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>{k}</span><span style={{ color: 'var(--text-primary)', ...mono }}>{v}</span></div>
}
