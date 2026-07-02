import { useState } from 'react'
import {
  Globe, Database, Eye, FileText, Download, Filter,
  Copy, Search, Users, AlertTriangle, Save, Trash2, ShieldCheck,
} from 'lucide-react'
import type { Engagement, EngagementStatus, OsintEngagementData } from '@/types'
import { useUIStore } from '@/store/ui'
import { useDataStore } from '@/store/data'
import { useAppStore } from '@/store/app'
import { ReportPanel } from '@/components/data/DataPanels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Wrap({ children }: { children: React.ReactNode }) {
  return <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>{children}</div>
}

function Block({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="block hot" style={{ marginBottom: 16 }}>
      <div className="bhead" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{title}</span>
        {action}
      </div>
      <div className="bbody">{children}</div>
    </div>
  )
}

function StatNum({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="block hot" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    </div>
  )
}

function FilterBar({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{
          padding: '3px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', border: 'none',
          background: value === o ? 'rgba(127,119,221,.25)' : 'rgba(255,255,255,.05)',
          color: value === o ? '#a89cff' : 'var(--text-muted)', textTransform: 'capitalize',
        }}>{o}</button>
      ))}
    </div>
  )
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ARTIFACTS: { id: string; name: string; type: string; size: string; date: string; tag: string; color: string }[] = []

const ARTIFACT_ICONS: Record<string, React.ElementType> = {
  screenshot: Eye, raw: FileText, json: Database, csv: FileText,
}

const INDICATOR_EXTRA: { id: string; value: string; type: string; confidence: 'Alta' | 'Média' | 'Baixa' }[] = []

const IOC_COLORS: Record<string, string> = {
  domain: '#378ADD', ip: '#8a9cff', email: '#1D9E75', perfil: '#e879f9',
}

const TIMELINE_EVENTS: { date: string; time: string; text: string; tag: string; color: string }[] = []

const MEDIA_ITEMS: { id: string; name: string; date: string; res: string; tag: string; color: string }[] = []

// ─── Atividades ───────────────────────────────────────────────────────────────

function AtividadesTab({ data }: { data: OsintEngagementData }) {
  return (
    <Wrap>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatNum label="Atividades"  value={data.recentActivities.length} accent="#1D9E75" />
        <StatNum label="Consultas"   value={data.stats.queries}           accent="#378ADD" />
        <StatNum label="Indicadores" value={data.stats.indicators}        accent="#EF9F27" />
        <StatNum label="Artefatos"   value={data.stats.artifacts}         accent="#8a9cff" />
      </div>

      <Block title="Feed de Atividades" action={<button className="btn" style={{ fontSize: 11 }}><Filter size={11} /> Filtrar</button>}>
        {data.recentActivities.map((act, i) => (
          <div key={act.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
            borderBottom: i < data.recentActivities.length - 1 ? '0.5px solid rgba(255,255,255,.05)' : 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0, marginTop: 1,
              background: `${act.tagColor}18`, border: `0.5px solid ${act.tagColor}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Globe size={13} style={{ color: act.tagColor }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 5, lineHeight: 1.4 }}>{act.text}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: act.tagColor, background: `${act.tagColor}18`, padding: '2px 7px', borderRadius: 4 }}>{act.tag}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{act.time}</span>
              </div>
            </div>
          </div>
        ))}
      </Block>
    </Wrap>
  )
}

// ─── Indicadores ─────────────────────────────────────────────────────────────

function IndicadoresTab({ data }: { data: OsintEngagementData }) {
  const { showToast } = useUIStore()
  const [filter, setFilter] = useState('todos')
  const all = [...data.indicators, ...INDICATOR_EXTRA]
  const types = ['todos', ...Array.from(new Set(all.map(i => i.type)))]
  const shown = filter === 'todos' ? all : all.filter(i => i.type === filter)

  return (
    <Wrap>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatNum label="Total"    value={all.length}                                 accent="#7F77DD" />
        <StatNum label="Domínios" value={all.filter(i => i.type === 'domain').length} accent="#378ADD" />
        <StatNum label="Perfis"   value={all.filter(i => i.type === 'perfil').length} accent="#e879f9" />
        <StatNum label="E-mails"  value={all.filter(i => i.type === 'email').length}  accent="#1D9E75" />
      </div>

      <Block title="Indicadores (IOCs)" action={<FilterBar options={types} value={filter} onChange={setFilter} />}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,.08)' }}>
              {['Valor', 'Tipo', 'Confiança', 'Ações'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((ioc, i) => {
              const c = IOC_COLORS[ioc.type] ?? '#888'
              const confColor = ioc.confidence === 'Alta' ? '#1D9E75' : ioc.confidence === 'Média' ? '#EF9F27' : '#e24b4a'
              return (
                <tr key={ioc.id} style={{ borderBottom: i < shown.length - 1 ? '0.5px solid rgba(255,255,255,.04)' : 'none' }}>
                  <td style={{ padding: '10px 10px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', fontSize: 12 }}>{ioc.value}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c, background: `${c}18`, padding: '2px 8px', borderRadius: 4, textTransform: 'capitalize' }}>{ioc.type}</span>
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: confColor, background: `${confColor}18`, padding: '2px 8px', borderRadius: 4 }}>{ioc.confidence}</span>
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => { navigator.clipboard.writeText(ioc.value); showToast('Copiado!', 'success') }}
                        style={{ background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <Copy size={11} />
                      </button>
                      <button onClick={() => showToast(`Pesquisando: ${ioc.value}`, 'info')}
                        style={{ background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <Search size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Block>
    </Wrap>
  )
}

// ─── Artefatos ────────────────────────────────────────────────────────────────

function ArtefatosTab({ data }: { data: OsintEngagementData }) {
  const { showToast } = useUIStore()
  const [filter, setFilter] = useState('todos')
  const types = ['todos', 'screenshot', 'json', 'raw', 'csv']
  const shown = filter === 'todos' ? MOCK_ARTIFACTS : MOCK_ARTIFACTS.filter(a => a.type === filter)

  return (
    <Wrap>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatNum label="Total"       value={data.stats.artifacts}                                        accent="#7F77DD" />
        <StatNum label="Screenshots" value={MOCK_ARTIFACTS.filter(a => a.type === 'screenshot').length}  accent="#378ADD" />
        <StatNum label="JSON / Raw"  value={MOCK_ARTIFACTS.filter(a => ['json','raw'].includes(a.type)).length} accent="#1D9E75" />
        <StatNum label="CSV / Dumps" value={MOCK_ARTIFACTS.filter(a => a.type === 'csv').length}          accent="#e24b4a" />
      </div>

      <Block title="Artefatos Coletados" action={<FilterBar options={types} value={filter} onChange={setFilter} />}>
        {shown.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            Nenhum artefato coletado.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {shown.map(art => {
            const Icon = ARTIFACT_ICONS[art.type] ?? FileText
            return (
              <div key={art.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: 'rgba(255,255,255,.025)', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 7,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                  background: `${art.color}18`, border: `0.5px solid ${art.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} style={{ color: art.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{art.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{art.size}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>·</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{art.date}</span>
                  </div>
                </div>
                <button onClick={() => showToast(`Baixando: ${art.name}`, 'info')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}>
                  <Download size={13} />
                </button>
              </div>
            )
          })}
        </div>
      </Block>
    </Wrap>
  )
}

// ─── Timeline ────────────────────────────────────────────────────────────────

function TimelineTab(_: { data: OsintEngagementData }) {
  const grouped = TIMELINE_EVENTS.reduce<Record<string, typeof TIMELINE_EVENTS>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <Wrap>
      <Block title="Timeline de Eventos">
        {Object.keys(grouped).length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            Nenhum evento registrado.
          </div>
        )}
        {Object.entries(grouped).map(([date, events]) => (
          <div key={date} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.1em',
              textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6,
              borderBottom: '0.5px solid rgba(255,255,255,.07)',
            }}>{date}</div>
            <div style={{ paddingLeft: 14, borderLeft: '1.5px solid rgba(127,119,221,.25)' }}>
              {events.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 14, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -20, top: 6,
                    width: 8, height: 8, borderRadius: '50%', background: ev.color,
                    boxShadow: `0 0 6px ${ev.color}66`,
                  }} />
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)', minWidth: 40, paddingTop: 1 }}>{ev.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 4 }}>{ev.text}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: ev.color, background: `${ev.color}18`, padding: '2px 7px', borderRadius: 4 }}>{ev.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Block>
    </Wrap>
  )
}

// ─── Mídia ───────────────────────────────────────────────────────────────────

function MidiaTab(_: { data: OsintEngagementData }) {
  const { showToast } = useUIStore()

  return (
    <Wrap>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatNum label="Total"   value={MEDIA_ITEMS.length} accent="#7F77DD" />
        <StatNum label="Web"     value={MEDIA_ITEMS.filter(m => m.tag === 'Web').length}  accent="#378ADD" />
        <StatNum label="Social"  value={MEDIA_ITEMS.filter(m => m.tag === 'Social').length} accent="#e879f9" />
        <StatNum label="Infra"   value={MEDIA_ITEMS.filter(m => m.tag === 'Infra').length}  accent="#8a9cff" />
      </div>

      <Block title="Galeria de Mídia">
        {MEDIA_ITEMS.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            Nenhuma mídia capturada.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {MEDIA_ITEMS.map(m => (
            <div key={m.id} style={{ borderRadius: 8, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,.08)', background: '#0c0c12' }}>
              <div style={{
                height: 100, background: `linear-gradient(135deg, ${m.color}12, ${m.color}06)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: '0.5px solid rgba(255,255,255,.06)',
              }}>
                <Eye size={22} style={{ color: `${m.color}60` }} />
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{m.res}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{m.date}</span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => showToast(`Abrindo: ${m.name}`, 'info')} className="btn" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '5px 8px' }}>
                    <Eye size={11} /> Ver
                  </button>
                  <button onClick={() => showToast('Baixando...', 'info')} className="btn" style={{ padding: '5px 8px' }}>
                    <Download size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Block>
    </Wrap>
  )
}

// ─── Relatório ────────────────────────────────────────────────────────────────

export function RelatorioTab({ engagement }: { engagement: Engagement }) {
  return <ReportPanel operationId={engagement.operationId} />
}

// ─── Configurações ────────────────────────────────────────────────────────────

const statusCopy: Record<EngagementStatus, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
}

export function ConfiguracoesTab({ engagement }: { engagement: Engagement }) {
  const { showToast, requestConfirm } = useUIStore()
  const { updateEngagement, removeEngagement } = useDataStore()
  const { backToOperations } = useAppStore()
  const [name, setName] = useState(engagement.name)
  const [target, setTarget] = useState(engagement.target)
  const [tags, setTags] = useState(engagement.tags.join(', '))
  const [status, setStatus] = useState<EngagementStatus>(engagement.status)
  const [saving, setSaving] = useState(false)

  const input: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 7,
    color: 'var(--text-primary)',
    outline: 'none',
  }

  async function save() {
    if (!name.trim() || !target.trim()) {
      showToast('Nome e alvo são obrigatórios', 'error')
      return
    }
    setSaving(true)
    try {
      await updateEngagement(engagement.id, {
        name: name.trim(),
        target: target.trim(),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        status,
      })
      showToast('Engajamento atualizado', 'success')
    } catch {
      showToast('Falha ao atualizar engajamento', 'error')
    } finally {
      setSaving(false)
    }
  }

  function destroy() {
    requestConfirm({
      title: 'Apagar engajamento',
      message: `Tem certeza que deseja apagar "${engagement.name}"? Evidências, achados e relatórios ligados ao caso podem deixar de aparecer nesta investigação.`,
      confirmLabel: 'Apagar',
      danger: true,
      onConfirm: async () => {
        try {
          await removeEngagement(engagement.id)
          showToast('Engajamento apagado', 'success')
          backToOperations()
        } catch {
          showToast('Falha ao apagar engajamento', 'error')
        }
      },
    })
  }

  return (
    <Wrap>
      <div className="hud" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, .75fr)', gap: 16, background: 'transparent' }}>
        <Block title="Identidade do Engajamento" action={
          <button className="hbtn" onClick={save} disabled={saving} style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)' }}>
            <Save size={12} /> {saving ? 'Salvando' : 'Salvar'}
          </button>
        }>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              Nome
              <input style={input} value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label>
              Status
              <select style={{ ...input, cursor: 'pointer' }} value={status} onChange={e => setStatus(e.target.value as EngagementStatus)}>
                {Object.entries(statusCopy).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Alvo
              <textarea style={{ ...input, minHeight: 86, resize: 'vertical', fontFamily: "'JetBrains Mono', monospace" }} value={target} onChange={e => setTarget(e.target.value)} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Tags
              <input style={input} value={tags} onChange={e => setTags(e.target.value)} placeholder="cti, vip, domínio, credenciais" />
            </label>
          </div>
        </Block>

        <Block title="Controles do Caso">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {[
              ['IOCs', engagement.iocCount ?? 0],
              ['Evidências', engagement.evidenceCount ?? 0],
              ['Criado', new Date(engagement.createdAt).toLocaleDateString('pt-BR')],
              ['Atualizado', new Date(engagement.updatedAt).toLocaleDateString('pt-BR')],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, background: 'rgba(255,255,255,.025)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginTop: 3 }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <button onClick={() => showToast('Dados exportados com sucesso', 'success')} className="btn" style={{ justifyContent: 'flex-start' }}>
              <Download size={13} /> Exportar pacote do caso
            </button>
            <button onClick={() => showToast('Use Monitoramento para criar checks recorrentes', 'info')} className="btn" style={{ justifyContent: 'flex-start' }}>
              <ShieldCheck size={13} /> Criar rotina de monitoramento
            </button>
          </div>
        </Block>

        <Block title="Equipe">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'operator.red', role: 'Responsável', color: '#1D9E75' },
              { name: 'analyst.alpha', role: 'Analista', color: '#378ADD' },
            ].map(m => (
              <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,.025)', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${m.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={12} style={{ color: m.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{m.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{m.role}</div>
                  </div>
                </div>
                <span style={{ fontSize: 10.5, color: m.color, background: `${m.color}18`, padding: '2px 7px', borderRadius: 4 }}>{m.role}</span>
              </div>
            ))}
            <button onClick={() => showToast('Convidar membro — em breve', 'info')} className="btn" style={{ justifyContent: 'center', marginTop: 4 }}>
              <Users size={12} /> Convidar membro
            </button>
          </div>
        </Block>

        <Block title="Zona de Perigo">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => showToast('Coleta resetada', 'info')} className="btn" style={{ justifyContent: 'flex-start' }}>
              <AlertTriangle size={13} style={{ color: '#EF9F27' }} /> Resetar coleta
            </button>
            <button onClick={destroy} className="btn" style={{ justifyContent: 'flex-start', color: '#e24b4a' }}>
              <Trash2 size={13} style={{ color: '#e24b4a' }} /> Apagar engajamento
            </button>
          </div>
        </Block>
      </div>
    </Wrap>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function OsintTabContent({ tab, engagement }: { tab: string; engagement: Engagement }) {
  const data = engagement.osintData
  if (!data) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Sem dados OSINT para este engajamento.
    </div>
  )
  switch (tab) {
    case 'Atividades':    return <AtividadesTab data={data} />
    case 'Indicadores':   return <IndicadoresTab data={data} />
    case 'Artefatos':     return <ArtefatosTab data={data} />
    case 'Timeline':      return <TimelineTab data={data} />
    case 'Mídia':         return <MidiaTab data={data} />
    case 'Relatório':     return <RelatorioTab engagement={engagement} />
    case 'Configurações': return <ConfiguracoesTab engagement={engagement} />
    default:              return null
  }
}
