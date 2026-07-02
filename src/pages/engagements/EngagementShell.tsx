import { useState } from 'react'
import { CheckCircle2, ChevronDown, FileText, PauseCircle, PlayCircle, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { EngSidebar } from '@/components/layout/EngSidebar'
import { OsintView } from './OsintView'
import { WebView } from './WebView'
import { EngagementOverview } from '@/components/engagement/EngagementOverview'
import { InvestigationTimeline } from '@/components/engagement/InvestigationTimeline'
import { FindingsView } from '@/components/engagement/FindingsView'
import { DomainView, InfraView, PersonView, OrgView, SocialView, LeakView } from './TypeViews'
import { OsintTabContent, ConfiguracoesTab } from './tabs/OsintTabs'
import { WebTabContent } from './tabs/WebTabs'
import { GenericTabContent } from './tabs/GenericTabs'
import { TypeTabContent } from './tabs/TypeTabs'
import { ReportPanel } from '@/components/data/DataPanels'
import { SidebarToolContent } from './SidebarTools'
import { metaFor } from '@/lib/engagementMeta'
import { useDataStore } from '@/store/data'
import { useAppStore } from '@/store/app'
import { useUIStore } from '@/store/ui'

const CONSULTA_OPTIONS: Record<string, string[]> = {
  osint:  ['Pesquisa OSINT', 'Google Dork', 'WHOIS Lookup', 'Busca de E-mails', 'Redes Sociais'],
  website: ['Reconhecimento Web', 'DNS Lookup', 'Scan de Portas', 'Captura de Tela', 'Análise de Headers'],
  default: ['Nova Consulta', 'Pesquisa Geral', 'WHOIS Lookup'],
}

const CONSULTA_TOOL: Record<string, string> = {
  'Pesquisa OSINT': 'pesquisa',
  'Google Dork': 'pesquisa',
  'WHOIS Lookup': 'whois',
  'Busca de E-mails': 'emails',
  'Redes Sociais': 'redes',
  'Reconhecimento Web': 'reconhecimento',
  'DNS Lookup': 'dns',
  'Scan de Portas': 'portas',
  'Captura de Tela': 'capturas',
  'Análise de Headers': 'headers',
  'Nova Consulta': 'pesquisa',
  'Pesquisa Geral': 'pesquisa',
}

const STATUS_LABEL = {
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
}

const STATUS_CLASS = {
  active: 'badge-active',
  paused: 'badge-paused',
  completed: 'badge-done',
}

export function EngagementShell() {
  const { selectedEngId, engagementTab, setEngagementTab, backToOperations } = useAppStore()
  const { engagements, operations, removeEngagement, updateEngagement } = useDataStore()
  const { showToast, requestConfirm } = useUIStore()
  const [activeTool, setActiveTool] = useState('visao-geral')
  const [consultaOpen, setConsultaOpen] = useState(false)

  const engagement = engagements.find(e => e.id === selectedEngId)
  const operation = engagement ? operations.find(o => o.id === engagement.operationId) : null

  if (!engagement || !operation) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Engajamento não encontrado
    </div>
  )

  const meta = metaFor(engagement.type)
  const createdStr = new Date(engagement.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const updatedStr = new Date(engagement.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const consultaOpts = CONSULTA_OPTIONS[engagement.type] ?? CONSULTA_OPTIONS.default
  const nextStatus = engagement.status === 'active' ? 'paused' : 'active'

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <EngSidebar engagement={engagement} activeTool={activeTool} onSelectTool={setActiveTool} />

      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Engagement header */}
        <div className="eng-header" style={{ ['--accent-c' as string]: meta.color }}>
          <div className="eng-header-top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 className="eng-title">{engagement.name}</h1>
                <span className={`badge ${STATUS_CLASS[engagement.status]}`}>{STATUS_LABEL[engagement.status]}</span>
              </div>
              <p className="eng-desc">
                <span style={{ color: meta.color, fontFamily: 'var(--font-mono)' }}>{engagement.target}</span>
                <span style={{ color: 'var(--text-muted)' }}> · </span>
                {meta.description}
              </p>
            </div>
            <div className="eng-header-actions">
              <button className="btn" onClick={() => {
                setActiveTool('visao-geral')
                setEngagementTab('Relatório')
              }}>
                <FileText size={13} /> Relatório
              </button>
              <button className="btn" onClick={() => setActiveTool('indicadores')}>
                <ShieldAlert size={13} /> Achados
              </button>
              <button
                className="btn"
                onClick={async () => {
                  try {
                    await updateEngagement(engagement.id, { status: nextStatus })
                    showToast(nextStatus === 'active' ? 'Engajamento ativado' : 'Engajamento pausado', 'success')
                  } catch {
                    showToast('Falha ao alterar status', 'error')
                  }
                }}
              >
                {engagement.status === 'active' ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                {engagement.status === 'active' ? 'Pausar' : 'Ativar'}
              </button>

              {/* Nova Consulta dropdown */}
              <div style={{ position: 'relative' }}>
                <button className="btn btn-accent" style={{ gap: 0 }} onClick={() => setConsultaOpen(v => !v)}>
                  <Plus size={13} />
                  <span style={{ marginLeft: 5 }}>Nova Consulta</span>
                  <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,.15)', margin: '0 6px' }} />
                  <ChevronDown size={12} />
                </button>
                {consultaOpen && (
                  <>
                    <div onClick={() => setConsultaOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 101,
                      background: 'var(--bg-elevated)', border: '0.5px solid var(--border-hover)',
                      borderRadius: 7, overflow: 'hidden', minWidth: 180,
                      boxShadow: '0 8px 24px rgba(0,0,0,.5)',
                    }}>
                      {consultaOpts.map(opt => (
                        <button
                          key={opt}
                          onClick={() => {
                            setConsultaOpen(false)
                            setActiveTool(CONSULTA_TOOL[opt] ?? 'pesquisa')
                          }}
                          style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12.5, color: 'var(--text-secondary)', transition: 'background 0.1s' }}
                          onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <button
                className="btn"
                title="Apagar engajamento"
                style={{ color: '#e24b4a' }}
                onClick={() => requestConfirm({
                  title: 'Apagar engajamento',
                  message: `Tem certeza que deseja apagar o engajamento "${engagement.name}"? Esta ação não pode ser desfeita.`,
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
                })}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div className="eng-header-tags">
            {engagement.tags.map(t => <span key={t} className="eng-tag">{t}</span>)}
            {engagement.tags.length === 0 && <span className="eng-tag">sem tags</span>}
          </div>

          <div className="eng-header-meta">
            <div className="eng-header-meta-item"><strong>Criado em</strong>{createdStr}</div>
            <div className="eng-header-meta-item"><strong>Atualizado</strong>{updatedStr}</div>
            <div className="eng-header-meta-item"><strong>Responsável</strong>operator.red</div>
            <div className="eng-header-meta-item"><strong>Tipo</strong><CheckCircle2 size={10} style={{ marginRight: 4, color: meta.color }} />{meta.label}</div>
          </div>

          {/* Abas são exclusivas da Visão Geral */}
          {activeTool === 'visao-geral' && (
            <div className="eng-tabs">
              {meta.tabs.map(tab => (
                <button
                  key={tab}
                  className={`eng-tab ${engagementTab === tab ? 'active' : ''}`}
                  onClick={() => setEngagementTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTool !== 'visao-geral' && (
            <SidebarToolContent tool={activeTool} engagement={engagement} />
          )}

          {activeTool === 'visao-geral' && (() => {
            const t = engagement.type
            const tab = engagementTab
            const hasTypedData = !!(engagement.osintData || engagement.webData || engagement.domainData ||
              engagement.infraData || engagement.personData || engagement.orgData || engagement.socialData || engagement.leakData)

            // Engajamento da API (sem dados tipados): abas puxam os achados salvos
            if (!hasTypedData) {
              if (tab === 'Resumo') return <EngagementOverview engagement={engagement} onNavigate={setActiveTool} />
              if (tab === 'Timeline' || tab === 'Atividades')
                return <div className="hud" style={{ flex: 1, overflow: 'auto', padding: '18px 20px', background: 'var(--hbg)' }}><InvestigationTimeline engagementId={engagement.id} /></div>
              if (tab === 'Indicadores')
                return <FindingsView engagement={engagement} title="Indicadores" types={['ioc', 'leak', 'credential', 'cve', 'host']} />
              if (tab === 'Artefatos')
                return <FindingsView engagement={engagement} title="Artefatos" types={['subdomain', 'url', 'endpoint', 'service', 'tech', 'profile']} />
              if (tab === 'Mídia' || tab === 'Capturas')
                return <FindingsView engagement={engagement} title="Mídia / Capturas" types={['screenshot']} />
              if (tab === 'Relatório') return <ReportPanel operationId={engagement.operationId} />
              if (tab === 'Configurações') return <ConfiguracoesTab engagement={engagement} />
              return <EngagementOverview engagement={engagement} onNavigate={setActiveTool} />
            }

            // Engajamentos com dados tipados (seed/mock)
            if (tab === 'Resumo') {
              if (t === 'osint'           && engagement.osintData)   return <OsintView  engagement={engagement} />
              if (t === 'website'         && engagement.webData)      return <WebView    engagement={engagement} />
              if (t === 'domain'          && engagement.domainData)   return <DomainView engagement={engagement} />
              if (t === 'infrastructure'  && engagement.infraData)    return <InfraView  engagement={engagement} />
              if (t === 'person'          && engagement.personData)   return <PersonView engagement={engagement} />
              if (t === 'organization'    && engagement.orgData)      return <OrgView    engagement={engagement} />
              if (t === 'social_profile'  && engagement.socialData)   return <SocialView engagement={engagement} />
              if (t === 'leak'            && engagement.leakData)     return <LeakView   engagement={engagement} />
              return <EngagementOverview engagement={engagement} onNavigate={setActiveTool} />
            }
            if (t === 'osint')   return <OsintTabContent tab={engagementTab} engagement={engagement} />
            if (t === 'website') return <WebTabContent   tab={engagementTab} engagement={engagement} />
            if (t === 'domain' || t === 'infrastructure' || t === 'person' ||
                t === 'organization' || t === 'social_profile' || t === 'leak') {
              return <TypeTabContent tab={engagementTab} engagement={engagement} />
            }
            return <GenericTabContent tab={engagementTab} engagement={engagement} />
          })()}
        </div>
      </div>
    </div>
  )
}
