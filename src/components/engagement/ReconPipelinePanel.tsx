import { useEffect, useRef, useState } from 'react'
import {
  Loader2, Play, GitBranch, Globe, Server, Camera, ShieldAlert, Network,
  Check, ChevronDown, Copy, X, Download, Settings, Pause, AlertTriangle,
} from 'lucide-react'
import type { Engagement } from '@/types'
import { reconPipelineStream, type PipelineEvent, type PipelinePhase } from '@/services/engagements'
import { useUIStore } from '@/store/ui'

const C = {
  txt: 'var(--text-primary)', txt2: 'var(--text-secondary)', txt3: 'var(--text-muted)',
  border: 'var(--border)', bg: 'var(--bg-surface)',
  green: '#1D9E75', purple: '#7F77DD', blue: '#378ADD', amber: '#EF9F27', red: '#e24b4a', gray: '#5d5d70',
}
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }

interface PhaseMeta { id: PipelinePhase; n: number; label: string; desc: string; Icon: any; metric: string; detail: string; source: string; color: string }
const PHASES: PhaseMeta[] = [
  { id: 'subdomains', n: 1, label: 'Subdomínios', desc: 'Fontes passivas (crt.sh, CertSpotter, Anubis…)', Icon: Network, metric: 'subdomínios', detail: 'Fontes: crt.sh, CertSpotter, Anubis', source: 'Passivos', color: C.green },
  { id: 'http', n: 2, label: 'HTTP Discovery', desc: 'Testa quais hosts respondem em HTTP/HTTPS', Icon: Globe, metric: 'hosts vivos', detail: 'Concorrência: 25', source: 'HTTP/HTTPS', color: C.green },
  { id: 'servicescan', n: 3, label: 'Service Scan', desc: 'Fingerprint de serviços e tecnologias (até 20 hosts)', Icon: Server, metric: 'hosts escaneados', detail: 'Até 20 hosts', source: 'Fingerprint', color: C.purple },
  { id: 'screenshot', n: 4, label: 'Screenshots', desc: 'Captura de screenshots (até 8 hosts)', Icon: Camera, metric: 'capturados', detail: 'Até 8 hosts', source: 'Chromium', color: C.gray },
  { id: 'vuln', n: 5, label: 'Vuln Correlation', desc: 'Correlação com CISA KEV + NVD', Icon: ShieldAlert, metric: 'CVEs encontrados', detail: 'Top 12 tecnologias', source: 'KEV + NVD', color: C.amber },
]

interface PhaseState { status: 'pending' | 'running' | 'done'; count?: number; done?: number; total?: number; startedAt?: number; durationMs?: number }
const STATUS_BADGE: Record<string, { label: string; c: string }> = {
  done: { label: 'Concluído', c: C.green }, running: { label: 'Rodando', c: C.purple }, pending: { label: 'Pendente', c: C.gray },
}
const fmtDur = (ms?: number) => ms == null ? '—' : `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, ...style }}>{children}</div>
}

// mini sparkline a partir da série da própria execução
function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 240, h = 44
  if (data.length < 2) return <div style={{ height: h, display: 'flex', alignItems: 'flex-end' }}><div style={{ height: 2, width: '100%', background: `${color}55` }} /></div>
  const max = Math.max(...data, 1), min = Math.min(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * (h - 6) - 3}`).join(' ')
  const area = `0,${h} ${pts} ${w},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }}>
      <polygon points={area} fill={`${color}22`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  )
}

export function ReconPipelinePanel({ engagement }: { engagement: Engagement }) {
  const { showToast } = useUIStore()
  const [running, setRunning] = useState(false)
  const [phases, setPhases] = useState<Record<string, PhaseState>>({})
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showConfig, setShowConfig] = useState(false)
  const [history, setHistory] = useState<Record<string, number[]>>({})
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [running])

  const metricsNow = (ph: Record<string, PhaseState>, sum: any) => ({
    subdomains: sum?.subdomains ?? ph.subdomains?.count ?? 0,
    live: sum?.live ?? ph.http?.count ?? ph.http?.done ?? 0,
    services: sum?.services ?? ph.servicescan?.done ?? ph.servicescan?.count ?? 0,
    screenshots: sum?.screenshots ?? ph.screenshot?.done ?? 0,
    cves: sum?.cves ?? ph.vuln?.count ?? 0,
  })

  // amostra a série p/ os sparklines enquanto roda
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      setHistory(h => {
        const m = metricsNow(phases, null)
        const next = { ...h }
        for (const k of Object.keys(m)) next[k] = [...(h[k] ?? []), (m as any)[k]].slice(-40)
        return next
      })
    }, 1000)
    return () => clearInterval(t)
  }, [running, phases])

  async function run() {
    abortRef.current = new AbortController()
    setRunning(true); setError(null); setSummary(null); setStartedAt(Date.now()); setHistory({})
    setPhases(Object.fromEntries(PHASES.map(p => [p.id, { status: 'pending' }])))
    const { startTask, updateTask, endTask } = useUIStore.getState()
    const taskId = startTask(`Recon Pipeline: ${engagement.target}`)
    let doneCount = 0
    try {
      await reconPipelineStream(engagement.id, (e: PipelineEvent) => {
        if (e.type === 'phase') {
          setPhases(p => {
            const prev = p[e.phase] ?? { status: 'pending' }
            const patch: PhaseState = { ...prev, status: e.status, count: e.count ?? prev.count }
            if (e.status === 'running' && !prev.startedAt) patch.startedAt = Date.now()
            if (e.status === 'done') patch.durationMs = Date.now() - (prev.startedAt ?? Date.now())
            return { ...p, [e.phase]: patch }
          })
          if (e.status === 'done') { doneCount++; updateTask(taskId, { progress: { done: doneCount, total: PHASES.length } }) }
        } else if (e.type === 'progress') {
          setPhases(p => ({ ...p, [e.phase]: { ...p[e.phase], status: 'running', done: e.done, total: e.total, count: e.found ?? p[e.phase]?.count, startedAt: p[e.phase]?.startedAt ?? Date.now() } }))
        } else if (e.type === 'complete') {
          setSummary(e.summary); showToast('Recon Pipeline concluído', 'success')
        } else if (e.type === 'error') setError(e.error)
      }, abortRef.current.signal)
    } catch {
      if (!abortRef.current?.signal.aborted) setError('Falha ao executar o pipeline.')
    } finally { setRunning(false); endTask(taskId) }
  }

  function cancel() {
    abortRef.current?.abort()
    setRunning(false)
    showToast('Execução cancelada', 'info')
  }
  function exportSummary() {
    const data = { target: engagement.target, startedAt: startedAt ? new Date(startedAt).toISOString() : null, phases, summary }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `recon-pipeline-${engagement.id}.json`; a.click(); URL.revokeObjectURL(a.href)
  }

  const elapsed = startedAt ? now - startedAt : 0
  const m = metricsNow(phases, summary)
  const started = !!startedAt
  const KPIS = [
    { label: 'Subdomínios', val: String(m.subdomains), spark: history.subdomains ?? [], color: C.green },
    { label: 'Hosts vivos', val: String(m.live), spark: history.live ?? [], color: C.green },
    { label: 'Hosts escaneados', val: `${m.services}${phases.servicescan?.total ? ` / ${phases.servicescan.total}` : ''}`, spark: history.services ?? [], color: C.purple },
    { label: 'Screenshots', val: `${m.screenshots}${phases.screenshot?.total ? ` / ${phases.screenshot.total}` : ''}`, spark: history.screenshots ?? [], color: C.gray },
    { label: 'CVEs encontrados', val: String(m.cves), spark: history.cves ?? [], color: C.amber },
  ]

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg-base)', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16, color: C.txt }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(127,119,221,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GitBranch size={18} style={{ color: C.purple }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Recon Pipeline</div>
          <div style={{ fontSize: 12.5, color: C.txt2, marginTop: 2 }}>Encadeia as engines automaticamente sobre o alvo abaixo. Cada etapa alimenta a próxima; tudo é salvo nos achados.</div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <button onClick={run} disabled={running} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.purple}`, background: running ? 'rgba(127,119,221,.18)' : C.purple, color: running ? C.purple : '#fff', fontSize: 13, fontWeight: 600, cursor: running ? 'default' : 'pointer' }}>
            {running ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Executando pipeline…</> : <><Play size={14} /> Executar pipeline</>}
          </button>
        </div>
      </div>

      {/* ── Contexto da execução ── */}
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
          <div>
            <div style={{ fontSize: 10.5, color: C.txt3, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Alvo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px' }}>
              <span style={{ flex: 1, ...mono, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{engagement.target}</span>
              <Copy size={13} style={{ color: C.txt3, cursor: 'pointer', flexShrink: 0 }} onClick={() => { navigator.clipboard.writeText(engagement.target); showToast('Copiado', 'success') }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><div style={{ fontSize: 10, color: C.txt3 }}>Iniciado em</div><div style={{ fontSize: 12.5, marginTop: 3 }}>{started ? new Date(startedAt!).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</div></div>
            <div><div style={{ fontSize: 10, color: C.txt3 }}>Executado por</div><div style={{ fontSize: 12.5, marginTop: 3 }}>operator.red</div></div>
            <div><div style={{ fontSize: 10, color: C.txt3 }}>Tempo decorrido</div><div style={{ fontSize: 12.5, marginTop: 3, ...mono }}>{started ? fmtDur(elapsed) : '—'}</div></div>
          </div>
        </div>
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <button onClick={() => setShowConfig(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: C.txt2, fontSize: 12.5 }}>
            <Settings size={13} /> <span style={{ flex: 1, textAlign: 'left' }}>Configurações</span> <ChevronDown size={14} style={{ transform: showConfig ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </button>
          {showConfig && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, fontSize: 11.5, color: C.txt2 }}>
              <div>HTTP Discovery — concorrência <b>25</b>, até <b>80</b> hosts</div>
              <div>Service Scan — até <b>20</b> hosts</div>
              <div>Screenshots — até <b>8</b> hosts</div>
              <div>Vuln Correlation — top <b>12</b> tecnologias (KEV + NVD)</div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Timeline das fases ── */}
      <Card style={{ padding: '8px 16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0' }}>
          <button onClick={() => setCollapsed(collapsed.size === PHASES.length ? new Set() : new Set(PHASES.map(p => p.id)))} style={{ fontSize: 11.5, color: C.txt3, background: 'none', border: 'none', cursor: 'pointer' }}>⇄ {collapsed.size === PHASES.length ? 'Expandir tudo' : 'Recolher tudo'}</button>
        </div>
        {PHASES.map((ph, i) => {
          const st = phases[ph.id] ?? { status: 'pending' as const }
          const badge = STATUS_BADGE[st.status]
          const pct = st.total ? Math.round(((st.done ?? 0) / st.total) * 100) : 0
          const liveDur = st.durationMs ?? (st.startedAt && st.status === 'running' ? now - st.startedAt : undefined)
          const open = !collapsed.has(ph.id)
          return (
            <div key={ph.id} style={{ display: 'flex', gap: 14 }}>
              {/* trilho */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: st.status === 'done' ? C.green : st.status === 'running' ? 'rgba(127,119,221,.18)' : 'transparent',
                  border: st.status === 'pending' ? `1.5px dashed ${C.border}` : st.status === 'running' ? `1.5px solid ${C.purple}` : 'none' }}>
                  {st.status === 'done' ? <Check size={15} color="#fff" /> : st.status === 'running' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: C.purple }} /> : <ph.Icon size={13} style={{ color: C.txt3 }} />}
                </div>
                {i < PHASES.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 34, background: st.status === 'done' ? C.green : st.status === 'running' ? `linear-gradient(${C.purple}, ${C.border})` : C.border }} />}
              </div>
              {/* conteúdo */}
              <div style={{ flex: 1, paddingBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                <ph.Icon size={18} style={{ color: st.status === 'pending' ? C.txt3 : ph.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.txt3, width: 14 }}>{ph.n}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: st.status === 'pending' ? C.txt3 : C.txt }}>{ph.label}</div>
                  <div style={{ fontSize: 11.5, color: C.txt3 }}>{ph.desc}</div>
                  {st.status === 'running' && st.total ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ flex: 1, maxWidth: 280, height: 4, background: C.border, borderRadius: 2 }}><div style={{ width: `${pct}%`, height: '100%', background: C.purple, borderRadius: 2, transition: 'width .3s' }} /></div>
                      <span style={{ fontSize: 10.5, color: C.txt3, ...mono }}>{st.done} / {st.total}</span>
                    </div>
                  ) : null}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: badge.c, border: `1px solid ${badge.c}66`, background: `${badge.c}1a`, borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>{badge.label}</span>
                <div style={{ width: 120, textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: st.status === 'pending' ? C.txt3 : C.txt }}>{st.status === 'running' && st.total ? `${st.done ?? 0}` : (st.count ?? 0)}</div>
                  <div style={{ fontSize: 10, color: C.txt3 }}>{ph.metric}</div>
                </div>
                <div style={{ width: 56, textAlign: 'right', ...mono, fontSize: 12, color: C.txt2, flexShrink: 0 }}>{fmtDur(liveDur)}</div>
                <ChevronDown size={15} style={{ color: C.txt3, flexShrink: 0, cursor: 'pointer', transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} onClick={() => setCollapsed(c => { const n = new Set(c); n.has(ph.id) ? n.delete(ph.id) : n.add(ph.id); return n })} />
              </div>
            </div>
          )
        })}
        {error && <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>⚠ {error}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <AlertTriangle size={14} style={{ color: C.amber, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 11.5, color: C.txt2 }}>Se uma etapa falhar, o pipeline continua nas demais (tolerante a falhas). Você pode cancelar a qualquer momento.</span>
          <button disabled title="Pausa estará disponível em breve" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'transparent', color: C.txt3, fontSize: 12, cursor: 'not-allowed', opacity: .6 }}><Pause size={12} /> Pausar pipeline</button>
          <button onClick={cancel} disabled={!running} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: `1px solid ${running ? C.red : C.border}`, background: 'transparent', color: running ? C.red : C.txt3, fontSize: 12, cursor: running ? 'pointer' : 'not-allowed' }}><X size={12} /> Cancelar execução</button>
        </div>
      </Card>

      {/* ── KPIs com sparklines ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {KPIS.map(k => (
          <Card key={k.label} style={{ padding: 14 }}>
            <div style={{ fontSize: 11.5, color: C.txt2 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, margin: '4px 0 6px' }}>{k.val}</div>
            <Spark data={k.spark} color={k.color} />
          </Card>
        ))}
      </div>

      {/* ── Detalhes das etapas ── */}
      <Card style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Detalhes das etapas <span style={{ fontSize: 11.5, color: C.txt3, fontWeight: 400 }}>(execução atual)</span></span>
        </div>
        {PHASES.map(ph => {
          const st = phases[ph.id] ?? { status: 'pending' as const }
          const badge = STATUS_BADGE[st.status]
          const n = st.status === 'running' && st.total ? `${st.done ?? 0}/${st.total}` : (st.count ?? 0)
          const summaryTxt = st.status === 'pending' ? 'Aguardando etapa anterior' : `${n} ${ph.metric} · ${ph.detail}`
          return (
            <div key={ph.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: `1px solid ${C.border}`, fontSize: 12.5 }}>
              {st.status === 'done' ? <Check size={15} style={{ color: C.green, flexShrink: 0 }} /> : st.status === 'running' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: C.purple, flexShrink: 0 }} /> : <ph.Icon size={14} style={{ color: C.txt3, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{ph.label}</div>
                <div style={{ fontSize: 11, color: C.txt3 }}>{summaryTxt}</div>
              </div>
              <span style={{ fontSize: 10, color: C.txt2, background: 'rgba(255,255,255,.05)', borderRadius: 5, padding: '2px 8px', flexShrink: 0 }}>{ph.source}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: badge.c, border: `1px solid ${badge.c}55`, background: `${badge.c}1a`, borderRadius: 5, padding: '2px 9px', flexShrink: 0 }}>{badge.label}</span>
              <span style={{ width: 50, textAlign: 'right', ...mono, color: C.txt2, flexShrink: 0 }}>{fmtDur(st.durationMs)}</span>
            </div>
          )
        })}
      </Card>

      {/* ── Footer ── */}
      <Card style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', fontSize: 12, color: C.txt2 }}>
        <span style={{ flex: 1 }}>Tudo salvo nos achados — veja em <b style={{ color: C.txt }}>Indicadores</b>, <b style={{ color: C.txt }}>Artefatos</b>, <b style={{ color: C.txt }}>Mídia</b> e na Visão Geral.</span>
        <button onClick={exportSummary} disabled={!started} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Download size={13} /> Exportar resumo</button>
      </Card>
    </div>
  )
}
