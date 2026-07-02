import { useEffect, useState } from 'react'
import { Pencil, FileText, Plus, ChevronDown, MoreVertical, Network, Bell, Archive, Users, Trash2, Check } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { listTimeline } from '@/services/coredata'
import { useAppStore } from '@/store/app'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'
import { EngagementMap } from './EngagementMap'
import { OpKpiStrip, EngagementsGrid, AlvosTab, ActivitiesTab, ReportsTab, EvidenceTab, SettingsTab } from './OperationTabs'
import { NotesPanel } from '@/components/engagement/NotesPanel'
import { ComplaintsTab } from './ComplaintsTab'
import type { TimelineEvent } from '@/types'

const tabList = ['Visão Geral', 'Engajamentos', 'Alvos', 'Atividades', 'Anotações', 'Denúncias', 'Relatórios', 'Evidências', 'Configurações']

const typeColors: Record<string, string> = {
  osint: '#1D9E75', domain: '#378ADD', website: '#5ad1ff',
  infrastructure: '#8a9cff', organization: '#EF9F27', person: '#e879f9',
  social_profile: '#e879f9', leak: '#e24b4a',
}
const typeLabels: Record<string, string> = {
  osint: 'OSINT', domain: 'Domínio', website: 'Web',
  infrastructure: 'Infraestrutura', organization: 'Organização',
  person: 'Pessoa', social_profile: 'Social', leak: 'Vazamento',
}

function statusStyle(s: string) {
  if (s === 'active') return { background: 'rgba(29,158,117,.14)', color: '#4dd4a4', border: '0.5px solid rgba(29,158,117,.3)' }
  if (s === 'paused') return { background: 'rgba(239,159,39,.12)', color: '#f4bc6a', border: '0.5px solid rgba(239,159,39,.3)' }
  return { background: 'rgba(55,138,221,.12)', color: '#7ab8f0', border: '0.5px solid rgba(55,138,221,.3)' }
}

export function OperationDetail() {
  const { selectedOpId, operationDetailTab, setOperationDetailTab, openEngagement } = useAppStore()
  const { operations, engagements, removeEngagement, updateOperation } = useDataStore()
  const { openModal, showToast, requestConfirm } = useUIStore()
  const [statusMenu, setStatusMenu] = useState(false)

  async function changeStatus(status: 'active' | 'completed' | 'archived') {
    setStatusMenu(false)
    if (!selectedOpId) return
    const labels: Record<string, string> = { active: 'Em andamento', completed: 'Concluída', archived: 'Arquivada' }
    try {
      await updateOperation(selectedOpId, { status })
      showToast(`Operação marcada como ${labels[status]}`, 'success')
    } catch {
      showToast('Falha ao alterar status', 'error')
    }
  }

  function handleDeleteEngagement(id: string, name: string) {
    requestConfirm({
      title: 'Apagar engajamento',
      message: `Tem certeza que deseja apagar o engajamento "${name}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Apagar',
      danger: true,
      onConfirm: async () => {
        try {
          await removeEngagement(id)
          showToast('Engajamento apagado', 'success')
        } catch {
          showToast('Falha ao apagar engajamento', 'error')
        }
      },
    })
  }

  const [opEvents, setOpEvents] = useState<TimelineEvent[]>([])
  useEffect(() => {
    if (!selectedOpId) { setOpEvents([]); return }
    listTimeline(selectedOpId).then(setOpEvents).catch(() => setOpEvents([]))
  }, [selectedOpId])

  const op = operations.find(o => o.id === selectedOpId)
  if (!op) return null

  const opEngagements = engagements.filter(e => e.operationId === selectedOpId)

  const typeData = opEngagements.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1
    return acc
  }, {})
  const donutData = Object.entries(typeData).map(([type, count]) => ({
    name: typeLabels[type] ?? type, value: count, color: typeColors[type] ?? '#888',
  }))

  const createdStr = new Date(op.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 0', background: 'var(--bg-surface)', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge" style={statusStyle(op.status)}>
              {op.status === 'active' ? 'Ativa' : op.status === 'paused' ? 'Pausada' : op.status === 'archived' ? 'Arquivada' : 'Concluída'}
            </span>
            <h1 style={{ fontSize: 17, fontWeight: 600, color: '#e9e9f1', fontFamily: "'Space Grotesk', sans-serif" }}>{op.name}</h1>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button className="btn" onClick={() => openModal('edit-op', op.id)}>
              <Pencil size={13} /> Editar
            </button>
            <button className="btn" onClick={() => showToast('Gerando relatório da operação...', 'info')}>
              <FileText size={13} /> Relatório
            </button>
            <button className="btn btn-accent" style={{ gap: 0 }} onClick={() => openModal('new-eng', op.id)}>
              <Plus size={13} />
              <span style={{ marginLeft: 5 }}>Novo Engajamento</span>
              <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,.15)', margin: '0 6px' }} />
              <ChevronDown size={12} />
            </button>
            <div style={{ position: 'relative' }}>
              <button className="btn" style={{ padding: '5px 8px' }} onClick={() => setStatusMenu(v => !v)} title="Alterar status">
                <MoreVertical size={13} />
              </button>
              {statusMenu && (
                <>
                  <div onClick={() => setStatusMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 101, minWidth: 190, background: 'var(--bg-elevated)', border: '0.5px solid var(--border-hover)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 12px 32px -12px rgba(0,0,0,.8)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '9px 12px 5px' }}>Alterar status</div>
                    {([
                      ['active', 'Em andamento', '#4dd4a4'],
                      ['completed', 'Concluída', '#7ab8f0'],
                      ['archived', 'Arquivada', '#888'],
                    ] as const).map(([val, label, color]) => (
                      <button key={val} onClick={() => changeStatus(val)} disabled={op.status === val}
                        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 12px', background: 'transparent', border: 'none', cursor: op.status === val ? 'default' : 'pointer', color: op.status === val ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: 12.5, textAlign: 'left' }}
                        onMouseEnter={e => { if (op.status !== val) e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{label}</span>
                        {op.status === val && <Check size={13} style={{ color: 'var(--text-muted)' }} />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, fontSize: 11.5, color: 'var(--text-secondary)' }}>
          <span>Criada em <strong style={{ color: 'var(--text-primary)' }}>{createdStr}</strong></span>
          <span>•</span>
          <span>Atualizada há 2 min</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {tabList.map(tab => (
            <button
              key={tab}
              onClick={() => setOperationDetailTab(tab)}
              style={{
                padding: '7px 14px', fontSize: 12.5, fontWeight: 500,
                color: operationDetailTab === tab ? '#378ADD' : 'var(--text-muted)',
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${operationDetailTab === tab ? '#378ADD' : 'transparent'}`,
                cursor: 'pointer', transition: 'color 0.12s, border-color 0.12s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Visão Geral ── */}
      {operationDetailTab === 'Visão Geral' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', gap: 0 }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <OpKpiStrip operation={op} engagements={opEngagements} events={opEvents} />
            <div className="card">
              <div className="card-header">
                <Network size={12} style={{ color: '#7F77DD' }} />
                <span className="card-title">Mapa de Engajamentos</span>
              </div>
              <div style={{ height: 300 }}>
                <EngagementMap engagements={opEngagements} opName={op.name} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Atividades Recentes</span>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {opEvents.slice(0, 6).map(ev => (
                    <div key={ev.id} style={{ display: 'flex', gap: 10, padding: '7px 12px', borderBottom: '0.5px solid var(--border)', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0, width: 36 }}>
                        {new Date(ev.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', flex: 1, lineHeight: 1.4 }}>{ev.title}</span>
                    </div>
                  ))}
                  <button className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 11, margin: '6px 0 0' }}
                    onClick={() => setOperationDetailTab('Atividades')}>
                    Ver todas atividades →
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <Network size={12} style={{ color: '#378ADD' }} />
                  <span className="card-title">Engajamentos</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{opEngagements.length}</span>
                </div>
                <div>
                  {opEngagements.map(eng => {
                    const color = typeColors[eng.type] ?? '#888'
                    return (
                      <div
                        key={eng.id}
                        className="rowi"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', borderBottom: '0.5px solid var(--border)', transition: 'background 0.12s' }}
                        onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,.025)')}
                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <button
                          onClick={() => openEngagement(eng.id)}
                          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                        >
                          <div style={{ fontSize: 11.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eng.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{eng.target}</div>
                        </button>
                        <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: `${color}18`, color, border: `0.5px solid ${color}44`, flexShrink: 0 }}>
                          {typeLabels[eng.type]}
                        </span>
                        <button
                          onClick={() => handleDeleteEngagement(eng.id, eng.name)}
                          title="Apagar engajamento"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(226,75,74,.6)', padding: 4, display: 'flex', flexShrink: 0 }}
                          onMouseOver={e => (e.currentTarget.style.color = '#e24b4a')}
                          onMouseOut={e => (e.currentTarget.style.color = 'rgba(226,75,74,.6)')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )
                  })}
                  {opEngagements.length === 0 && (
                    <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      Nenhum engajamento.{' '}
                      <button onClick={() => openModal('new-eng', op.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7ab8f0', fontSize: 12 }}>Criar um →</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right info panel */}
          <div style={{ width: 240, flexShrink: 0, borderLeft: '0.5px solid var(--border)', overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Informações da Operação</div>
              {[
                { label: 'Nome', value: op.name },
                { label: 'Objetivo', value: op.description },
                { label: 'Status', value: op.status === 'active' ? 'Ativa' : op.status === 'paused' ? 'Pausada' : op.status === 'archived' ? 'Arquivada' : 'Concluída' },
                { label: 'Criada em', value: createdStr },
                { label: 'Progresso Geral', value: null },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{row.label}</div>
                  {row.value != null ? (
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{row.value}</div>
                  ) : (
                    <div>
                      <div className="progress-bar" style={{ marginBottom: 2 }}>
                        <div className="progress-bar-fill" style={{ width: `${op.progress}%`, background: 'linear-gradient(90deg, #7F77DD99, #7F77DD)' }} />
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{op.progress}%</div>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {op.tags.map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(127,119,221,.12)', color: '#a9a4ee', border: '0.5px solid rgba(127,119,221,.3)' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Resumo</div>
              {[
                { icon: Network, label: 'Engajamentos ativos', value: opEngagements.length, color: '#378ADD' },
                { icon: Bell,    label: 'Alertas ativos',       value: op.alertCount, color: op.alertCount > 0 ? '#e24b4a' : undefined },
                { icon: Archive, label: 'Evidências coletadas', value: op.evidenceCount, color: '#1D9E75' },
                { icon: Users,   label: 'Relatórios gerados',   value: op.reportCount, color: '#EF9F27' },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    <row.icon size={12} style={{ color: 'var(--text-muted)' }} />
                    {row.label}
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: row.color ?? 'var(--text-primary)' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {donutData.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Tipos de Alvos</div>
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value">
                      {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0d0d13', border: '0.5px solid #1e1e24', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {donutData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Engajamentos ── */}
      {operationDetailTab === 'Engajamentos' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Todos os Engajamentos ({opEngagements.length})</span>
            <button className="btn btn-accent" style={{ fontSize: 12 }} onClick={() => openModal('new-eng', op.id)}>
              <Plus size={13} /> Novo Engajamento
            </button>
          </div>
          <EngagementsGrid engagements={opEngagements} onOpen={openEngagement} />
          {opEngagements.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0' }}>
              <Network size={32} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13 }}>Nenhum engajamento para esta operação.</div>
              <button className="btn btn-accent" style={{ margin: '12px auto 0', fontSize: 12 }} onClick={() => openModal('new-eng', op.id)}>
                <Plus size={13} /> Criar primeiro engajamento
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Atividades (Event Viewer) ── */}
      {operationDetailTab === 'Atividades' && <ActivitiesTab events={opEvents} />}

      {/* ── Alvos (entidades unificadas) ── */}
      {operationDetailTab === 'Alvos' && <AlvosTab operationId={op.id} />}

      {/* ── Anotações ── */}
      {operationDetailTab === 'Anotações' && <NotesPanel operationId={op.id} />}

      {/* ── Denúncias ── */}
      {operationDetailTab === 'Denúncias' && <ComplaintsTab operationId={op.id} />}

      {/* ── Relatórios ── */}
      {operationDetailTab === 'Relatórios' && <ReportsTab operationId={op.id} />}

      {/* ── Evidências ── */}
      {operationDetailTab === 'Evidências' && <EvidenceTab operationId={op.id} />}

      {/* ── Configurações ── */}
      {operationDetailTab === 'Configurações' && <SettingsTab />}
    </div>
  )
}
