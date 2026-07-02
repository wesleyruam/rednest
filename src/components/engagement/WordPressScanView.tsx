import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Download, Plus, ChevronDown, ChevronRight, Play, Loader2, Check, Globe,
  Users, Puzzle, Palette, AlertTriangle, ShieldAlert, RefreshCw, X,
} from 'lucide-react'
import { wpscanStream, type WpScanResult, type WpScanEvent } from '@/services/integrations'
import { ingestFindings, listFindings, type Finding } from '@/services/findings'
import { parseTargets } from '@/components/enrichment/EnrichmentTools'
import { useUIStore } from '@/store/ui'

// ── fases do scan ───────────────────────────────────────────────────────────────
const PHASES = [
  { id: 'detect', label: 'Detecção & versão' },
  { id: 'users', label: 'Usuários' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'themes', label: 'Temas' },
  { id: 'interesting', label: 'Achados interessantes' },
  { id: 'leaks', label: 'Config backups & DB dumps' },
  { id: 'vuln', label: 'Correlação CVE (NVD+KEV)' },
] as const

const SEV: Record<string, { label: string; c: string }> = {
  critical: { label: 'Crítica', c: '#e24b4a' },
  high: { label: 'Alta', c: '#e24b4a' },
  medium: { label: 'Média', c: '#EF9F27' },
  low: { label: 'Baixa', c: '#378ADD' },
}
const sevOf = (s?: string) => SEV[s ?? ''] ?? { label: 'Informativo', c: 'var(--text-muted)' }

const C = {
  bg: 'var(--bg-surface)', elev: 'var(--bg-elevated)', border: 'var(--border)',
  txt: 'var(--text-primary)', txt2: 'var(--text-secondary)', txt3: 'var(--text-muted)',
  blue: '#378ADD', green: '#1D9E75', amber: '#EF9F27', red: '#e24b4a', purple: '#7F77DD',
}
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }

// ── card primitivo ───────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, ...style }}>{children}</div>
}
function CardHead({ icon, title, count, right }: { icon: React.ReactNode; title: string; count?: number; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.blue, display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.txt }}>{title}{count != null ? ` (${count})` : ''}</span>
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  )
}
const seeAll = (onClick?: () => void) => <button onClick={onClick} style={{ fontSize: 11.5, color: C.blue, background: 'none', border: 'none', cursor: 'pointer' }}>Ver todos</button>

// ── view principal ───────────────────────────────────────────────────────────────
export function WordPressScanView({ initial, eid }: { initial: string; eid?: string }) {
  const [targets, setTargets] = useState<string[]>(() => parseTargets(initial))
  const [value, setValue] = useState(() => { const t = parseTargets(initial)[0] ?? initial; return /^https?:\/\//.test(t) ? t : `https://${t}` })
  const [aggressive, setAggressive] = useState(true)
  const [useProxy, setUseProxy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phases, setPhases] = useState<Record<string, WpScanEvent & { type: 'phase' }>>({})
  const [r, setR] = useState<Partial<WpScanResult> | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const startRef = useRef(0)

  useEffect(() => {
    if (!loading) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500)
    return () => clearInterval(t)
  }, [loading])

  async function run() {
    const target = value.trim()
    if (!target) return
    setLoading(true); setError(null); setR(null); setPhases({}); setElapsed(0); startRef.current = Date.now()
    const { startTask, endTask } = useUIStore.getState()
    const taskId = startTask(`WordPress Scan: ${target}`)
    try {
      await wpscanStream(target, { aggressive, proxy: useProxy }, e => {
        if (e.type === 'phase') setPhases(p => ({ ...p, [e.phase]: e }))
        else if (e.type === 'partial') setR(prev => ({ ...(prev ?? {}), ...e.patch }))
        else if (e.type === 'done') {
          setR(e.result)
          if (e.result.error) setError(e.result.error)
          else if (!e.result.isWordPress) setError('O alvo não aparenta ser WordPress.')
          if (eid && e.result.isWordPress) { void ingestFindings(eid, 'wpscan', target, e.result); setTimeout(() => setRefreshKey(k => k + 1), 900) }
        }
        else if (e.type === 'error') setError(e.error)
      })
    } catch { setError('Falha no scan.') } finally { setLoading(false); endTask(taskId) }
  }

  function exportJson() {
    if (!r) return
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `wpscan-${(value || 'target').replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '_')}.json`
    a.click(); URL.revokeObjectURL(a.href)
  }

  const users = r?.users ?? [], plugins = r?.plugins ?? [], themes = r?.themes ?? []
  const interesting = r?.interesting ?? [], cfg = r?.configBackups ?? [], db = r?.dbExports ?? [], vulns = r?.vulns ?? []
  const leaks = [...cfg.map(x => ({ ...x, kind: 'wp-config backup' })), ...db.map(x => ({ ...x, kind: 'database export' }))]

  // estado das fases p/ o stepper
  const phaseState = (id: string): 'done' | 'running' | 'pending' => {
    const st = phases[id]?.status
    if (st === 'done') return 'done'
    if (st === 'running') return 'running'
    return 'pending'
  }
  const currentIdx = PHASES.reduce((acc, p, i) => (phaseState(p.id) !== 'pending' ? i : acc), -1)
  const currentPhase = PHASES.find(p => phaseState(p.id) === 'running')
  const phaseCount = (id: string): string => {
    const st = phases[id]
    if (id === 'detect') return r?.version?.number ? `WordPress ${r.version.number}` : (r?.isWordPress ? 'detectado' : '')
    if (st?.status === 'running' && st.done != null && st.total != null) return `${st.done}/${st.total}`
    const n = id === 'users' ? users.length : id === 'plugins' ? plugins.length : id === 'themes' ? themes.length
      : id === 'interesting' ? interesting.length : id === 'leaks' ? leaks.length : id === 'vuln' ? vulns.length : (st?.total ?? '')
    return String(n ?? '')
  }
  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg-base)', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(55,138,221,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Globe size={18} style={{ color: C.blue }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.txt }}>WordPress Scan</div>
          <div style={{ fontSize: 12.5, color: C.txt2, marginTop: 2 }}>Scanner completo de sites WordPress com detecção de versões, usuários, plugins, temas e vulnerabilidades.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn" disabled style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: .6 }}><FileText size={13} /> Relatório</button>
          <button className="btn" onClick={exportJson} disabled={!r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Download size={13} /> Exportar JSON</button>
          <button className="btn" onClick={() => { setR(null); setPhases({}); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(55,138,221,.16)', borderColor: 'rgba(55,138,221,.4)', color: C.txt }}><Plus size={13} /> Nova Consulta <ChevronDown size={12} /></button>
        </div>
      </div>

      {/* ── Execução ── */}
      <Card>
        <CardHead icon={<Globe size={14} />} title="WordPress Engine — scanner (motor estilo WPScan)" />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, color: C.txt3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Alvos</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {targets.map(t => {
                const active = value.replace(/^https?:\/\//, '') === t
                return (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 7, fontSize: 11.5, cursor: 'pointer', border: `1px solid ${active ? 'rgba(127,119,221,.5)' : C.border}`, background: active ? 'rgba(127,119,221,.15)' : 'transparent', ...mono }}>
                    <span onClick={() => setValue(/^https?:\/\//.test(t) ? t : `https://${t}`)} style={{ color: active ? C.txt : C.txt2 }}>{t}</span>
                    <X size={11} style={{ color: C.txt3 }} onClick={() => setTargets(ts => ts.filter(x => x !== t))} />
                  </span>
                )
              })}
              <button onClick={() => { const v = value.trim().replace(/^https?:\/\//, ''); if (v && !targets.includes(v)) setTargets(ts => [...ts, v]) }}
                style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.txt2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && run()} placeholder="https://alvo.com"
              style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: C.txt, fontSize: 13, outline: 'none', ...mono }} />
            <button onClick={run} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 20px', borderRadius: 8, border: `1px solid ${C.blue}`, background: C.blue, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />} Consultar
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', gap: 9, cursor: 'pointer' }}>
              <input type="checkbox" checked={aggressive} onChange={e => setAggressive(e.target.checked)} style={{ marginTop: 2 }} />
              <span><span style={{ fontSize: 12.5, color: C.txt }}>Modo completo</span><br /><span style={{ fontSize: 11, color: C.txt3 }}>Habilita brute de wordlist (plugins/temas, config backups, dumps de DB).</span></span>
            </label>
            <label style={{ display: 'flex', gap: 9, cursor: 'pointer' }}>
              <input type="checkbox" checked={useProxy} onChange={e => setUseProxy(e.target.checked)} style={{ marginTop: 2 }} />
              <span><span style={{ fontSize: 12.5, color: C.txt }}>Rotear por proxy</span><br /><span style={{ fontSize: 11, color: C.txt3 }}>Anonimiza a origem via pool de proxies.</span></span>
            </label>
          </div>
          {error && <div style={{ fontSize: 12.5, color: C.red, background: 'rgba(226,75,74,.1)', border: '1px solid rgba(226,75,74,.3)', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
        </div>
      </Card>

      {/* ── Progresso (stepper) ── */}
      {(loading || r) && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px' }}>
            <RefreshCw size={14} style={{ color: C.blue }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.txt }}>Progresso do scan</span>
            {loading && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', color: C.green, background: 'rgba(29,158,117,.15)', border: '1px solid rgba(29,158,117,.4)', borderRadius: 5, padding: '2px 7px' }}>AO VIVO</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 28, textAlign: 'right' }}>
              <div><div style={{ fontSize: 10, color: C.txt3 }}>Tempo decorrido</div><div style={{ fontSize: 13, color: C.txt, ...mono }}>{fmtTime(elapsed)}</div></div>
              <div><div style={{ fontSize: 10, color: C.txt3 }}>Fase atual</div><div style={{ fontSize: 13, color: C.txt }}>{currentPhase?.label ?? (r ? 'Concluído' : '—')}</div></div>
            </div>
          </div>
          <div style={{ display: 'flex', padding: '8px 16px 18px' }}>
            {PHASES.map((ph, i) => {
              const st = phaseState(ph.id)
              return (
                <div key={ph.id} style={{ flex: 1, position: 'relative', textAlign: 'center' }}>
                  {i > 0 && <div style={{ position: 'absolute', top: 13, left: 0, width: '50%', height: 2, background: currentIdx >= i ? C.green : C.border }} />}
                  {i < PHASES.length - 1 && <div style={{ position: 'absolute', top: 13, left: '50%', width: '50%', height: 2, background: currentIdx > i ? C.green : C.border }} />}
                  <div style={{ position: 'relative', width: 28, height: 28, margin: '0 auto', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: st === 'done' ? C.green : st === 'running' ? C.blue : 'var(--bg-base)',
                    border: st === 'pending' ? `2px solid ${C.border}` : 'none' }}>
                    {st === 'done' ? <Check size={15} color="#fff" /> : st === 'running' ? <Loader2 size={15} color="#fff" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.txt3 }} />}
                  </div>
                  <div style={{ fontSize: 11, color: st === 'pending' ? C.txt3 : C.txt, marginTop: 8, padding: '0 4px' }}>{ph.label}</div>
                  <div style={{ fontSize: 10.5, color: st === 'pending' ? C.txt3 : C.blue, marginTop: 2, ...mono }}>{phaseCount(ph.id)}</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── KPI strip ── */}
      {r?.isWordPress && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          <Kpi icon={<Globe size={16} />} title="WordPress" big={<span style={{ fontSize: 12.5, color: C.green, fontWeight: 700 }}>DETECTADO</span>}
            extra={<div style={{ marginTop: 8 }}><div style={{ fontSize: 10, color: C.txt3 }}>Confiança</div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ flex: 1, height: 5, borderRadius: 3, background: C.border }}><div style={{ width: `${r.confidence ?? 0}%`, height: '100%', borderRadius: 3, background: C.green }} /></div><span style={{ fontSize: 11, color: C.txt }}>{r.confidence ?? 0}%</span></div></div>} />
          <Kpi icon={<Users size={16} />} title="Usuários" num={users.length} sub="Encontrados" />
          <Kpi icon={<Puzzle size={16} />} title="Plugins" num={plugins.length} sub="Identificados" />
          <Kpi icon={<Palette size={16} />} title="Temas" num={themes.length} sub="Identificados" />
          <Kpi icon={<AlertTriangle size={16} color={C.amber} />} title="Achados" num={interesting.length} sub="Importantes" numColor={C.amber} />
          <Kpi icon={<ShieldAlert size={16} color={C.red} />} title="Vulnerabilidades" num={vulns.length} sub="Correlacionadas" numColor={C.red} />
        </div>
      )}

      {/* ── Resultados ── */}
      {r?.isWordPress && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.txt }}>Resultados do scan</span>
            <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.txt3, display: 'flex', alignItems: 'center', gap: 6 }}>Última atualização: agora <RefreshCw size={12} /></span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {/* Core */}
            <Card>
              <CardHead icon={<Globe size={14} />} title="Core" />
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Row k="Versão" v={r.version?.number ?? '—'} />
                <Row k="Fonte da versão" v={r.version?.source ?? '—'} />
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: C.txt3 }}>Confiança</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.border }}><div style={{ width: `${r.confidence ?? 0}%`, height: '100%', borderRadius: 3, background: C.green }} /></div>
                    <span style={{ fontSize: 12, color: C.txt }}>{r.confidence ?? 0}%</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Usuários */}
            <Card>
              <CardHead icon={<Users size={14} />} title="Usuários" count={users.length} right={users.length > 5 ? seeAll() : undefined} />
              <div style={{ padding: '8px 16px 14px' }}>
                {users.slice(0, 5).map((usr, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: i < Math.min(5, users.length) - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <Users size={13} style={{ color: C.txt3, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: C.txt, ...mono }}>{usr.login ?? `id:${usr.id}`}</span>
                    <span style={{ fontSize: 11.5, color: C.txt3, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.displayName ? `${usr.displayName} · ` : ''}{usr.source}</span>
                  </div>
                ))}
                {users.length > 5 && <div style={{ fontSize: 11.5, color: C.blue, paddingTop: 8 }}>+ {users.length - 5} usuários</div>}
                {users.length === 0 && <div style={{ fontSize: 12, color: C.txt3, padding: '8px 0' }}>Nenhum usuário.</div>}
              </div>
            </Card>

            {/* Plugins */}
            <Card>
              <CardHead icon={<Puzzle size={14} />} title="Plugins" count={plugins.length} right={plugins.length > 5 ? seeAll() : undefined} />
              <ItemList items={plugins} kindLabel="plugins" />
            </Card>

            {/* Temas */}
            <Card>
              <CardHead icon={<Palette size={14} />} title="Temas" count={themes.length} right={themes.length > 5 ? seeAll() : undefined} />
              <ItemList items={themes} kindLabel="temas" />
            </Card>

            {/* Achados interessantes */}
            <Card>
              <CardHead icon={<AlertTriangle size={14} />} title="Achados interessantes" count={interesting.length} right={interesting.length > 5 ? seeAll() : undefined} />
              <div style={{ padding: '8px 16px 14px' }}>
                {interesting.slice(0, 5).map((it, i) => {
                  const s = sevOf(it.severity)
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 9.5, fontWeight: 600, color: s.c, background: `${s.c}1a`, border: `1px solid ${s.c}55`, borderRadius: 5, padding: '2px 7px', height: 'fit-content', flexShrink: 0 }}>{s.label}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: C.txt }}>{it.description.split(' — ')[0].split(' (')[0]}</div>
                        <a href={it.url} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: C.txt3, ...mono, wordBreak: 'break-all' }}>{it.url}</a>
                      </div>
                    </div>
                  )
                })}
                {interesting.length > 5 && <div style={{ fontSize: 11.5, color: C.blue, paddingTop: 8 }}>+ {interesting.length - 5} achados</div>}
                {interesting.length === 0 && <div style={{ fontSize: 12, color: C.txt3, padding: '8px 0' }}>Nada relevante.</div>}
              </div>
            </Card>

            {/* Vazamentos */}
            <Card>
              <CardHead icon={<ShieldAlert size={14} color={C.red} />} title="Vazamentos — config backups & DB dumps" count={leaks.length} right={leaks.length > 5 ? seeAll() : undefined} />
              <div style={{ padding: '8px 16px 14px' }}>
                {leaks.slice(0, 5).map((l, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12.5, color: C.red, display: 'flex', alignItems: 'center', gap: 6 }}><ShieldAlert size={12} /> {l.kind === 'database export' ? l.url.split('/').pop() : l.url.split('/').pop()}</div>
                    <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 10.5, color: C.txt3, ...mono, wordBreak: 'break-all' }}>{l.url}</a>
                  </div>
                ))}
                {leaks.length > 5 && <div style={{ fontSize: 11.5, color: C.blue, paddingTop: 8 }}>Ver todos</div>}
                {leaks.length === 0 && <div style={{ fontSize: 12, color: C.txt3, padding: '8px 0' }}>Nenhum vazamento exposto.</div>}
              </div>
            </Card>
          </div>

          {/* ── Vulnerabilidades (tabela) ── */}
          {vulns.length > 0 && (
            <Card>
              <CardHead icon={<ShieldAlert size={14} />} title="Vulnerabilidades correlacionadas" count={vulns.length} right={vulns.length > 5 ? <button style={{ fontSize: 11.5, color: C.blue, background: 'none', border: 'none', cursor: 'pointer' }}>Ver todas</button> : undefined} />
              <div style={{ padding: '6px 16px 14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 170px 1fr 110px 150px', gap: 10, padding: '8px 0', fontSize: 10, color: C.txt3, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  <span>Fonte</span><span>CVE</span><span>Produto / Versão</span><span>Severidade</span><span>CVSS</span>
                </div>
                {vulns.slice(0, 5).map((v, i) => {
                  const s = sevOf(v.severity)
                  const src = (v.source || '').toUpperCase()
                  const srcC = src === 'KEV' ? C.red : C.blue
                  return (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 170px 1fr 110px 150px', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.border}`, fontSize: 12, alignItems: 'center' }}>
                      <span><span style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', background: srcC, borderRadius: 4, padding: '2px 7px' }}>{src}</span></span>
                      <a href={`https://nvd.nist.gov/vuln/detail/${v.cve}`} target="_blank" rel="noreferrer" style={{ color: C.txt, ...mono, textDecoration: 'none' }}>{v.cve}</a>
                      <span style={{ color: C.txt2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.product}{v.version ? ` ≤ ${v.version}` : ''}</span>
                      <span><span style={{ fontSize: 10.5, color: s.c, border: `1px solid ${s.c}55`, background: `${s.c}1a`, borderRadius: 5, padding: '2px 9px' }}>{s.label}</span></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: C.txt, width: 26, ...mono }}>{v.score ?? '—'}</span>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: C.border }}><div style={{ width: `${((v.score ?? 0) / 10) * 100}%`, height: '100%', borderRadius: 3, background: s.c }} /></div>
                      </span>
                    </div>
                  )
                })}
                {vulns.length > 5 && <div style={{ fontSize: 11.5, color: C.blue, paddingTop: 10 }}>+ {vulns.length - 5} vulnerabilidades</div>}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Já coletado ── */}
      <CollectedPanel eid={eid} refreshKey={refreshKey} />
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────────
function Kpi({ icon, title, num, sub, big, extra, numColor }: { icon: React.ReactNode; title: string; num?: number; sub?: string; big?: React.ReactNode; extra?: React.ReactNode; numColor?: string }) {
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: C.blue, display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 11.5, color: C.txt2 }}>{title}</span>
      </div>
      {big ?? <div style={{ fontSize: 28, fontWeight: 700, color: numColor ?? C.txt, marginTop: 6 }}>{num ?? 0}</div>}
      {sub && <div style={{ fontSize: 11, color: C.txt3, marginTop: 2 }}>{sub}</div>}
      {extra}
    </Card>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}><span style={{ color: C.txt3 }}>{k}</span><span style={{ color: C.txt, ...mono }}>{v}</span></div>
}

function ItemList({ items, kindLabel }: { items: { slug: string; version: string | null; source: string }[]; kindLabel: string }) {
  return (
    <div style={{ padding: '8px 16px 14px' }}>
      {items.slice(0, 5).map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < Math.min(5, items.length) - 1 ? `1px solid ${C.border}` : 'none' }}>
          <span style={{ fontSize: 12, color: C.txt, ...mono, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.slug}</span>
          {p.version && <span style={{ fontSize: 11.5, color: C.txt2, ...mono }}>{p.version}</span>}
          <span style={{ fontSize: 10.5, color: C.txt3, width: 92, textAlign: 'right' }}>{p.source}</span>
        </div>
      ))}
      {items.length > 5 && <div style={{ fontSize: 11.5, color: C.blue, paddingTop: 8 }}>+ {items.length - 5} {kindLabel}</div>}
      {items.length === 0 && <div style={{ fontSize: 12, color: C.txt3, padding: '8px 0' }}>Nenhum {kindLabel.replace(/s$/, '')}.</div>}
    </div>
  )
}

// ── Já coletado (com abas) ────────────────────────────────────────────────────────
const TAB_TYPES: Record<string, string[]> = {
  all: ['tech', 'user', 'endpoint', 'leak', 'cve'],
  tec: ['tech'], users: ['user'], endpoints: ['endpoint'], leaks: ['leak'], cves: ['cve'],
}
function CollectedPanel({ eid, refreshKey }: { eid?: string; refreshKey: number }) {
  const [items, setItems] = useState<Finding[]>([])
  const [tab, setTab] = useState('all')
  const [open, setOpen] = useState(true)
  const [limit, setLimit] = useState(6)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  useEffect(() => { setLimit(6) }, [tab])
  useEffect(() => {
    if (!eid) return
    Promise.all(TAB_TYPES.all.map(t => listFindings(eid, t)))
      .then(all => setItems(all.flat().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))))
      .catch(() => setItems([]))
  }, [eid, refreshKey])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    for (const [k, types] of Object.entries(TAB_TYPES)) if (k !== 'all') c[k] = items.filter(i => types.includes(i.type)).length
    return c
  }, [items])
  const shown = items.filter(i => TAB_TYPES[tab].includes(i.type))
  const TABS: [string, string][] = [['all', 'Todos'], ['tec', 'Tec'], ['users', 'Usuários'], ['endpoints', 'Endpoints'], ['leaks', 'Vazamentos'], ['cves', 'CVEs']]
  if (!eid || items.length === 0) return null
  const fmt = (s: string) => new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: `1px solid ${C.border}` }}>
        <ChevronDown size={14} style={{ color: C.blue }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.txt }}>Já coletado ({items.length})</span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.txt3, cursor: 'pointer' }} onClick={() => setExpanded(expanded.size === shown.length ? new Set() : new Set(shown.map(i => i.id)))}>⇄ Expandir tudo</span>
        <span style={{ fontSize: 11.5, color: C.txt3, cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>{open ? 'Ocultar' : 'Mostrar'}</span>
      </div>
      {open && (
        <div style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{ fontSize: 11.5, cursor: 'pointer', padding: '5px 12px', borderRadius: 7, border: 'none', background: tab === k ? C.purple : 'rgba(255,255,255,.05)', color: tab === k ? '#fff' : C.txt2 }}>{label} ({counts[k] ?? 0})</button>
            ))}
          </div>
          {shown.slice(0, limit).map(f => {
            const isOpen = expanded.has(f.id)
            return (
              <div key={f.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <div onClick={() => setExpanded(p => { const n = new Set(p); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n })} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', cursor: 'pointer', fontSize: 12 }}>
                  <ChevronRight size={12} style={{ color: C.txt3, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
                  <span style={{ color: C.txt, minWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label ? `${f.label}` : f.value}</span>
                  <span style={{ fontSize: 9.5, color: C.txt2, background: 'rgba(255,255,255,.05)', borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>{f.type === 'endpoint' ? 'Endpoint' : f.type === 'tech' ? 'Tec' : f.type === 'user' ? 'User' : f.type === 'leak' ? 'Vazamento' : f.type}</span>
                  <span style={{ flex: 1, color: C.txt3, ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.value}</span>
                  <span style={{ fontSize: 11, color: C.txt3, flexShrink: 0 }}>{fmt(f.createdAt)}</span>
                  <ChevronDown size={12} style={{ color: C.txt3, flexShrink: 0 }} />
                </div>
                {isOpen && (
                  <div style={{ padding: '4px 0 10px 26px', fontSize: 11.5, color: C.txt2 }}>
                    {f.source && <div>Fonte: {f.source}</div>}
                    {f.target && <div style={mono}>Vínculo: {f.target}</div>}
                    {f.severity && <div>Severidade: {f.severity}</div>}
                    {f.data && Object.entries(f.data).filter(([k, v]) => k !== 'screenshot' && v != null && v !== '').slice(0, 12).map(([k, v]) => <div key={k}>{k}: {Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>)}
                  </div>
                )}
              </div>
            )
          })}
          {shown.length > limit && (
            <button onClick={() => setLimit(l => l + 50)} style={{ fontSize: 11.5, color: C.blue, background: 'none', border: 'none', cursor: 'pointer', paddingTop: 10 }}>
              + {shown.length - limit} itens
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
