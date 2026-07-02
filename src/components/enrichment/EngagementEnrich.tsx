import { useState } from 'react'
import { Sparkles, Loader2, ShieldAlert, Globe, Network, Server, AtSign, CheckCircle2, XCircle, Circle, Search } from 'lucide-react'
import type { Engagement } from '@/types'
import { enrichEngagementStream, type EnrichStreamEvent } from '@/services/engagements'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'

function verdictColor(v: string) {
  return v === 'malicious' ? 'var(--down)' : v === 'suspicious' ? 'var(--med)' : 'var(--up)'
}

function Block({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="block hot">
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="bhead" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{icon}<span>{title}</span></div>
      <div className="bbody">{children}</div>
    </div>
  )
}
function Field({ k, v }: { k: string; v: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '0.5px solid var(--line)' }}>
      <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: 'var(--htxt)', textAlign: 'right', wordBreak: 'break-all' }}>{v ?? '—'}</span>
    </div>
  )
}

type StepStatus = 'pending' | 'running' | 'done' | 'error'
interface StepState {
  label: string
  tokenIdx: number
  status: StepStatus
  progress?: { checked: number; total: number; found: number }
}
interface PipelineState {
  tokens: { idx: number; value: string; kind: string; note?: string }[]
  steps: Record<string, StepState>
  order: string[]
}

export function EngagementEnrichPanel({ engagement }: { engagement: Engagement }) {
  const { replaceEngagement } = useDataStore()
  const { showToast } = useUIStore()
  const [loading, setLoading] = useState(false)
  const [pipeline, setPipeline] = useState<PipelineState | null>(null)
  const data = (engagement as any).enrichment as any

  async function run() {
    setLoading(true)
    setPipeline(null)
    try {
      await enrichEngagementStream(engagement.id, (e: EnrichStreamEvent) => {
        if (e.type === 'start') {
          const steps: PipelineState['steps'] = {}
          e.steps.forEach(s => { steps[s.key] = { label: s.label, tokenIdx: s.tokenIdx, status: 'pending' } })
          setPipeline({ tokens: e.tokens, steps, order: e.steps.map(s => s.key) })
        } else if (e.type === 'step') {
          setPipeline(p => p ? {
            ...p,
            steps: { ...p.steps, [e.key]: { ...p.steps[e.key], status: e.status, progress: e.progress ?? p.steps[e.key].progress } },
          } : p)
        } else if (e.type === 'complete') {
          replaceEngagement(e.engagement)
          showToast('Engajamento enriquecido', 'success')
        } else if (e.type === 'error') {
          showToast(`Falha ao enriquecer: ${e.error}`, 'error')
        }
      })
    } catch {
      showToast('Falha ao enriquecer', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', padding: '18px 20px', background: 'var(--hbg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--htxt)' }}>Auto-enriquecimento</div>
          <div style={{ fontSize: 11.5, color: 'var(--txt-3)' }}>Roda as integrações sobre <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{engagement.target}</span> conforme o tipo do engajamento.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="hbtn" onClick={run} disabled={loading}
          style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)' }}>
          {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} />}
          {loading ? 'Enriquecendo…' : data ? 'Reexecutar' : 'Auto-enriquecer'}
        </button>
      </div>

      {!data && !loading && !pipeline && (
        <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--txt-3)' }}>
          Nenhum enriquecimento ainda. Clique em “Auto-enriquecer”.
        </div>
      )}

      {pipeline && <Pipeline pipeline={pipeline} />}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(data.targets ?? [data]).map((t: any, i: number) => (
            <TargetSection key={i} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'running') return <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: '#7f77dd' }} />
  if (status === 'done') return <CheckCircle2 size={13} style={{ color: 'var(--up)' }} />
  if (status === 'error') return <XCircle size={13} style={{ color: 'var(--down)' }} />
  return <Circle size={13} style={{ color: 'var(--txt-3)', opacity: 0.5 }} />
}

function Pipeline({ pipeline }: { pipeline: PipelineState }) {
  const total = pipeline.order.length
  const done = pipeline.order.filter(k => { const s = pipeline.steps[k].status; return s === 'done' || s === 'error' }).length
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="block hot">
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="bhead" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Sparkles size={12} /><span>Pipeline de enriquecimento</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{done}/{total}</span>
      </div>
      <div className="bbody">
        <div style={{ height: 4, background: 'var(--line)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#7f77dd', transition: 'width .3s ease' }} />
        </div>
        {pipeline.tokens.map(tk => {
          const meta = KIND_META[tk.kind] ?? KIND_META.unknown
          const keys = pipeline.order.filter(k => pipeline.steps[k].tokenIdx === tk.idx)
          return (
            <div key={tk.idx} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace" }}>{tk.value}</span>
                <span className="tag" style={{ fontSize: 9.5, color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}1a` }}>{meta.label}</span>
              </div>
              {tk.note
                ? <div style={{ fontSize: 11.5, color: 'var(--txt-3)', paddingLeft: 4 }}>{tk.note}</div>
                : keys.map(k => {
                    const st = pipeline.steps[k]
                    return (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 4px 4px' }}>
                        <StepStatusIcon status={st.status} />
                        <span style={{ fontSize: 12, color: st.status === 'pending' ? 'var(--txt-3)' : 'var(--htxt)' }}>{st.label}</span>
                        {st.progress && st.status === 'running' && (
                          <span style={{ fontSize: 10.5, color: 'var(--txt-3)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {st.progress.checked}/{st.progress.total} · {st.progress.found} encontrados
                          </span>
                        )}
                        {st.status === 'error' && <span style={{ fontSize: 10.5, color: 'var(--down)' }}>falhou</span>}
                      </div>
                    )
                  })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const KIND_META: Record<string, { label: string; color: string }> = {
  ip: { label: 'IP', color: '#8a9cff' },
  email: { label: 'E-MAIL', color: '#e879f9' },
  domain: { label: 'DOMÍNIO', color: '#5ad1ff' },
  username: { label: 'USUÁRIO', color: '#EF9F27' },
  unknown: { label: '—', color: '#888' },
}

function TargetSection({ t }: { t: any }) {
  const meta = KIND_META[t.kind] ?? KIND_META.unknown
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--htxt)', fontFamily: "'JetBrains Mono', monospace" }}>{t.value}</span>
        <span className="tag" style={{ fontSize: 10, color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}1a` }}>{meta.label}</span>
      </div>
      {t.note && <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>{t.note}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {t.threatIntel && (
          <Block title="Threat Intel" icon={<ShieldAlert size={12} />}>
            {t.threatIntel.verdict && (
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: verdictColor(t.threatIntel.verdict) }}>
                {t.threatIntel.verdict} · score {t.threatIntel.score}
              </div>
            )}
            {t.threatIntel.virustotal && <Field k="VT maliciosos" v={t.threatIntel.virustotal.malicious} />}
            {t.threatIntel.abuseipdb && <Field k="AbuseIPDB" v={`${t.threatIntel.abuseipdb.score ?? 0}%`} />}
            {t.threatIntel.otx && <Field k="OTX pulses" v={t.threatIntel.otx.pulses} />}
          </Block>
        )}
        {t.asn && (
          <Block title="ASN / Rede" icon={<Network size={12} />}>
            <Field k="ASN" v={t.asn.asn ? `AS${t.asn.asn}` : '—'} />
            <Field k="Org" v={t.asn.org} />
            <Field k="País" v={t.asn.country} />
          </Block>
        )}
        {t.whois && (
          <Block title="WHOIS / DNS" icon={<Globe size={12} />}>
            <Field k="Registrador" v={t.whois.registrar} />
            <Field k="Criado" v={t.whois.created} />
            <Field k="A" v={(t.whois.dns?.A ?? []).join(', ')} />
          </Block>
        )}
        {t.subdomains && (
          <Block title="Subdomínios" icon={<Network size={12} />}>
            <Field k="Encontrados" v={t.subdomains.names?.length ?? 0} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {(t.subdomains.names ?? []).slice(0, 12).map((n: string) => <span key={n} className="tag" style={{ fontSize: 10 }}>{n}</span>)}
            </div>
          </Block>
        )}
        {t.hunter && (
          <Block title="Hunter (e-mails)" icon={<Server size={12} />}>
            <Field k="Organização" v={t.hunter.organization} />
            <Field k="E-mails" v={t.hunter.total} />
            <Field k="Padrão" v={t.hunter.pattern} />
          </Block>
        )}
        {t.email && (
          <Block title="E-mail Intel" icon={<AtSign size={12} />}>
            <Field k="Gravatar" v={t.email.gravatar?.found ? 'perfil' : 'sem perfil'} />
            <Field k="Hunter" v={t.email.hunter?.result} />
            <Field k="Leak-Lookup (fontes)" v={t.email.leaklookup?.n} />
            <Field k="COMB (vazamentos)" v={t.email.comb?.count} />
          </Block>
        )}
        {(t.kind === 'username') && (
          <Block title="Usuário / Credenciais" icon={<AtSign size={12} />}>
            <Field k="Leak-Lookup (fontes)" v={t.leaklookup?.n} />
            <Field k="COMB (vazamentos)" v={t.comb?.count} />
          </Block>
        )}
        {t.whatsmyname && (
          <Block title="Presença em sites (WhatsMyName)" icon={<Search size={12} />}>
            <Field k="Perfis encontrados" v={t.whatsmyname.found?.length ?? 0} />
            <Field k="Sites checados" v={`${t.whatsmyname.checked ?? 0}/${t.whatsmyname.total ?? 0}`} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {(t.whatsmyname.found ?? []).slice(0, 40).map((h: any) => (
                <a key={h.name} href={h.url} target="_blank" rel="noreferrer" className="tag"
                  style={{ fontSize: 10, textDecoration: 'none', color: 'var(--htxt)' }} title={`${h.cat} · ${h.url}`}>
                  {h.name}
                </a>
              ))}
            </div>
            {(t.whatsmyname.found?.length ?? 0) > 40 && (
              <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginTop: 4 }}>+{t.whatsmyname.found.length - 40} outros</div>
            )}
          </Block>
        )}
      </div>
    </div>
  )
}
