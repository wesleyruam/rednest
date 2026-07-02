import type { Engagement } from '@/types'
import { ConfiguracoesTab } from './tabs/OsintTabs'
import {
  ThreatIntelPanel, WhoisPanel, SubdomainsPanel, AsnPanel,
  CheckHostPanel, WaybackPanel, MultiLookupPanel,
  EmailIntelPanel, HunterDomainPanel, GodaddyAbusePanel,
  WhatsMyNamePanel, ServiceScanPanel, ContentDiscoveryPanel, CrawlerPanel, ScreenshotPanel,
  DomainAttributionPanel, GeoDistributedPanel,
} from '@/components/enrichment/EnrichmentTools'
import { WordPressScanView } from '@/components/engagement/WordPressScanView'
import { EvidencePanel, MonitorsPanel } from '@/components/data/DataPanels'
import { FindingsView } from '@/components/engagement/FindingsView'
import { ReconPipelinePanel } from '@/components/engagement/ReconPipelinePanel'
import { NotesPanel } from '@/components/engagement/NotesPanel'
import { PersonDossier } from '@/components/engagement/PersonDossier'

// ─── Router ───────────────────────────────────────────────────────────────────

export function SidebarToolContent({ tool, engagement }: { tool: string; engagement: Engagement }) {
  const target = engagement.target
  const eid = engagement.id

  // Coleções (Dados Coletados) — achados salvos, navegáveis
  if (tool === 'indicadores') return <FindingsView engagement={engagement} title="Indicadores" types={['ioc', 'leak', 'credential', 'cve', 'host']} />
  if (tool === 'artefatos')   return <FindingsView engagement={engagement} title="Artefatos" types={['subdomain', 'url', 'endpoint', 'service', 'tech']} />
  if (tool === 'vazamentos')  return <FindingsView engagement={engagement} title="Vazamentos & Credenciais" types={['leak', 'credential']} />
  if (tool === 'redes')       return <FindingsView engagement={engagement} title="Perfis & Redes Sociais" types={['profile']} />
  if (tool === 'tecnologias') return <FindingsView engagement={engagement} title="Tecnologias" types={['tech']} />
  if (tool === 'urls' || tool === 'paginas') return <FindingsView engagement={engagement} title="URLs & Páginas" types={['url']} />
  if (tool === 'endpoints' || tool === 'recursos') return <FindingsView engagement={engagement} title="Endpoints & Recursos" types={['endpoint', 'url']} />
  if (tool === 'evidencias')  return <EvidencePanel engagement={engagement} />
  if (tool === 'anotacoes')   return <NotesPanel operationId={engagement.operationId} engagementId={engagement.id} />
  if (tool === 'pessoas')     return <PersonDossier engagement={engagement} />
  if (tool === 'config' || tool === 'permissoes') return <ConfiguracoesTab engagement={engagement} />

  // Monitoramento
  if (tool === 'monitor' || tool === 'monitor-mudancas' || tool === 'monitor-conteudo' || tool === 'alertas')
    return <MonitorsPanel engagement={engagement} />

  // Recon Pipeline (encadeia as engines)
  if (tool === 'pipeline')     return <ReconPipelinePanel engagement={engagement} />

  // Ferramentas (rodam as engines; resultados são salvos como achados)
  if (tool === 'pesquisa' || tool === 'reconhecimento') return <MultiLookupPanel initial={target} />
  if (tool === 'hosts')        return <ThreatIntelPanel initial={target} eid={eid} />
  if (tool === 'asn')          return <AsnPanel initial={target} eid={eid} />
  if (tool === 'subdominios')  return <SubdomainsPanel initial={target} eid={eid} />
  if (tool === 'attribution')  return <DomainAttributionPanel initial={target} eid={eid} />
  if (tool === 'wpscan')       return <WordPressScanView initial={target} eid={eid} />
  if (tool === 'geocheck')     return <GeoDistributedPanel initial={target} eid={eid} />
  if (tool === 'wayback')      return <WaybackPanel initial={target} eid={eid} />
  if (tool === 'emails')       return <EmailIntelPanel initial={target} eid={eid} />
  if (tool === 'username')     return <WhatsMyNamePanel initial={target} eid={eid} />
  if (tool === 'servicescan')  return <ServiceScanPanel initial={target} eid={eid} />
  if (tool === 'contentdisc')  return <ContentDiscoveryPanel initial={target} eid={eid} />
  if (tool === 'crawler')      return <CrawlerPanel initial={target} eid={eid} />
  if (tool === 'capturas')     return <ScreenshotPanel initial={target} eid={eid} />
  if (tool === 'hunter')       return <HunterDomainPanel initial={target} eid={eid} />
  if (tool === 'abuse')        return <GodaddyAbusePanel initial={target} />
  if (tool === 'dns' || tool === 'whois' || tool === 'website' || tool === 'dominios')
    return <WhoisPanel initial={target} eid={eid} />
  if (tool === 'portas')       return <CheckHostPanel initial={target} defaultKind="tcp" />
  if (tool === 'ssl' || tool === 'headers') return <ServiceScanPanel initial={target} eid={eid} />

  // Fallback: mostra os achados gerais
  return <FindingsView engagement={engagement} title="Achados" types={['subdomain', 'host', 'email', 'username', 'profile', 'service', 'url', 'endpoint', 'ioc', 'leak', 'credential', 'cve', 'tech', 'screenshot']} />
}
