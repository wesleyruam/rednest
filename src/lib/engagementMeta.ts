import { Globe, Eye, Server, Users, User, Database, Share2, Building2, Mail, Flag, Network, GitBranch, StickyNote } from 'lucide-react'
import type { EngagementType } from '@/types'

export interface EngagementTypeMeta {
  label: string
  color: string
  icon: React.ElementType
  description: string
  sidebarSections: SidebarSection[]
  tabs: string[]
  accentRgb: string
}

export interface SidebarSection {
  label: string
  items: SidebarItem[]
}

export interface SidebarItem {
  id: string
  label: string
  icon: React.ElementType
  countKey?: string
}

const sidebarSectionsOsint: SidebarSection[] = [
  {
    label: 'Ferramentas OSINT',
    items: [
      { id: 'pesquisa', label: 'Pesquisa Avançada', icon: Eye },
      { id: 'dominios', label: 'WHOIS & DNS', icon: Globe },
      { id: 'subdominios', label: 'Subdomínios', icon: Globe },
      { id: 'wayback', label: 'Wayback Machine', icon: Globe },
      { id: 'pessoas', label: 'Pessoa (Dossiê)', icon: User },
      { id: 'emails', label: 'E-mails & Usuários', icon: Users },
      { id: 'username', label: 'Username Search', icon: User },
      { id: 'redes', label: 'Redes Sociais', icon: Share2 },
      { id: 'vazamentos', label: 'Vazamentos', icon: Database },
      { id: 'google', label: 'Google Dorks', icon: Eye },
    ],
  },
  {
    label: 'Dados Coletados',
    items: [
      { id: 'indicadores', label: 'Indicadores', icon: Eye, countKey: 'indicators' },
      { id: 'artefatos', label: 'Artefatos', icon: Database, countKey: 'artifacts' },
      { id: 'anotacoes', label: 'Anotações', icon: StickyNote, countKey: 'notes' },
      { id: 'evidencias', label: 'Evidências', icon: Database, countKey: 'evidences' },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { id: 'config', label: 'Configurações', icon: Server },
      { id: 'permissoes', label: 'Permissões', icon: User },
    ],
  },
]

const sidebarSectionsWeb: SidebarSection[] = [
  {
    label: 'Ferramentas Web',
    items: [
      { id: 'pipeline', label: 'Recon Pipeline', icon: GitBranch },
      { id: 'reconhecimento', label: 'Reconhecimento', icon: Eye },
      { id: 'attribution', label: 'Atribuição de Domínio', icon: Globe },
      { id: 'wpscan', label: 'WordPress Scan', icon: Server },
      { id: 'geocheck', label: 'Visão Geo-distribuída', icon: Globe },
      { id: 'website', label: 'Análise de Website', icon: Globe },
      { id: 'tecnologias', label: 'Tecnologias', icon: Server },
      { id: 'dns', label: 'DNS & Infraestrutura', icon: Server },
      { id: 'subdominios', label: 'Subdomínios', icon: Globe },
      { id: 'servicescan', label: 'Service Scan', icon: Server },
      { id: 'contentdisc', label: 'Content Discovery', icon: Eye },
      { id: 'crawler', label: 'Crawler', icon: Network },
      { id: 'portas', label: 'Check-Host (distribuído)', icon: Server },
      { id: 'wayback', label: 'Wayback (Histórico)', icon: Globe },
      { id: 'capturas', label: 'Capturas de Tela', icon: Eye },
    ],
  },
  {
    label: 'Monitoramento',
    items: [
      { id: 'monitor', label: 'Monitoramento', icon: Eye },
      { id: 'abuse', label: 'Denúncia (GoDaddy)', icon: Flag },
    ],
  },
  {
    label: 'Dados Coletados',
    items: [
      { id: 'paginas', label: 'Páginas', icon: Globe, countKey: 'pages' },
      { id: 'recursos', label: 'Recursos', icon: Server, countKey: 'resources' },
      { id: 'urls', label: 'URLs', icon: Globe, countKey: 'urls' },
      { id: 'endpoints', label: 'Endpoints', icon: Server, countKey: 'endpoints' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { id: 'anotacoes', label: 'Anotações', icon: StickyNote, countKey: 'notes' },
      { id: 'evidencias', label: 'Evidências', icon: Database, countKey: 'evidences' },
      { id: 'config', label: 'Configurações', icon: Server },
    ],
  },
]

const sidebarSectionsInfra: SidebarSection[] = [
  {
    label: 'Ferramentas de Infra',
    items: [
      { id: 'pipeline', label: 'Recon Pipeline', icon: GitBranch },
      { id: 'hosts', label: 'Threat Intel', icon: Eye },
      { id: 'servicescan', label: 'Service Scan', icon: Server },
      { id: 'portas', label: 'Check-Host (distribuído)', icon: Server },
      { id: 'asn', label: 'ASN & Roteamento', icon: Globe },
    ],
  },
  {
    label: 'Dados Coletados',
    items: [
      { id: 'indicadores', label: 'Indicadores', icon: Eye, countKey: 'indicators' },
      { id: 'evidencias', label: 'Evidências', icon: Database, countKey: 'evidences' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { id: 'monitor', label: 'Monitoramento', icon: Eye },
      { id: 'anotacoes', label: 'Anotações', icon: StickyNote, countKey: 'notes' },
      { id: 'config', label: 'Configurações', icon: Server },
    ],
  },
]

const sidebarSectionsDomain: SidebarSection[] = [
  {
    label: 'Investigação de Domínio',
    items: [
      { id: 'pipeline', label: 'Recon Pipeline', icon: GitBranch },
      { id: 'attribution', label: 'Atribuição de Domínio', icon: Globe },
      { id: 'wpscan', label: 'WordPress Scan', icon: Server },
      { id: 'geocheck', label: 'Visão Geo-distribuída', icon: Globe },
      { id: 'whois', label: 'WHOIS & DNS', icon: Globe },
      { id: 'subdominios', label: 'Subdomínios', icon: Globe },
      { id: 'contentdisc', label: 'Content Discovery', icon: Eye },
      { id: 'crawler', label: 'Crawler', icon: Network },
      { id: 'capturas', label: 'Captura de Tela', icon: Eye },
      { id: 'hunter', label: 'E-mails (Hunter)', icon: Mail },
      { id: 'hosts', label: 'Threat Intel', icon: Eye },
      { id: 'servicescan', label: 'Service Scan', icon: Server },
      { id: 'asn', label: 'ASN & Rede', icon: Server },
      { id: 'portas', label: 'Check-Host (distribuído)', icon: Server },
      { id: 'wayback', label: 'Wayback Machine', icon: Globe },
      { id: 'abuse', label: 'Denúncia (GoDaddy)', icon: Flag },
    ],
  },
  {
    label: 'Dados Coletados',
    items: [
      { id: 'indicadores', label: 'Indicadores', icon: Eye, countKey: 'indicators' },
      { id: 'evidencias', label: 'Evidências', icon: Database, countKey: 'evidences' },
    ],
  },
  {
    label: 'Operação',
    items: [
      { id: 'monitor', label: 'Monitoramento', icon: Eye },
      { id: 'anotacoes', label: 'Anotações', icon: StickyNote, countKey: 'notes' },
      { id: 'config', label: 'Configurações', icon: Server },
    ],
  },
]

export const ENGAGEMENT_META: Record<EngagementType, EngagementTypeMeta> = {
  osint: {
    label: 'OSINT',
    color: '#1D9E75',
    accentRgb: '29,158,117',
    icon: Eye,
    description: 'Coleta e correlação de informações publicamente disponíveis sobre o alvo — domínios, e-mails, perfis sociais e infraestruturas relacionadas.',
    sidebarSections: sidebarSectionsOsint,
    tabs: ['Resumo', 'Atividades', 'Indicadores', 'Artefatos', 'Timeline', 'Mídia', 'Relatório', 'Configurações'],
  },
  website: {
    label: 'Web',
    color: '#5ad1ff',
    accentRgb: '90,209,255',
    icon: Globe,
    description: 'Reconhecimento e análise do website alvo — infraestrutura, tecnologias, conteúdo e exposição de risco.',
    sidebarSections: sidebarSectionsWeb,
    tabs: ['Resumo', 'Reconhecimento', 'Tecnologias', 'Conteúdo', 'Vulnerabilidades', 'Infraestrutura', 'Monitoramento', 'Evidências', 'Relatório', 'Configurações'],
  },
  domain: {
    label: 'Domínio',
    color: '#378ADD',
    accentRgb: '55,138,221',
    icon: Globe,
    description: 'Investigação de domínio: registros WHOIS, histórico de DNS, subdomínios e infraestrutura associada.',
    sidebarSections: sidebarSectionsDomain,
    tabs: ['Resumo', 'DNS', 'Whois', 'Infraestrutura', 'Histórico', 'Evidências', 'Relatório', 'Configurações'],
  },
  infrastructure: {
    label: 'Infra',
    color: '#8a9cff',
    accentRgb: '138,156,255',
    icon: Server,
    description: 'Mapeamento de infraestrutura de rede: IPs, ASNs, portas expostas, serviços e redes associadas ao alvo.',
    sidebarSections: sidebarSectionsInfra,
    tabs: ['Resumo', 'Hosts', 'Portas', 'Certificados', 'Tráfego', 'Evidências', 'Relatório', 'Configurações'],
  },
  organization: {
    label: 'Organização',
    color: '#EF9F27',
    accentRgb: '239,159,39',
    icon: Building2,
    description: 'Investigação de organização: dados corporativos, responsáveis, ativos digitais e vínculos associados.',
    sidebarSections: sidebarSectionsOsint,
    tabs: ['Resumo', 'Pessoas', 'Domínios', 'Perfis', 'Vazamentos', 'Evidências', 'Relatório', 'Configurações'],
  },
  person: {
    label: 'Pessoa',
    color: '#e879f9',
    accentRgb: '232,121,249',
    icon: User,
    description: 'Investigação de pessoa física: identidade, contatos, presença online, vínculos e histórico de exposição.',
    sidebarSections: sidebarSectionsOsint,
    tabs: ['Resumo', 'Identidade', 'Redes Sociais', 'E-mails', 'Vazamentos', 'Evidências', 'Relatório', 'Configurações'],
  },
  social_profile: {
    label: 'Social',
    color: '#e879f9',
    accentRgb: '232,121,249',
    icon: Share2,
    description: 'Análise de perfil em rede social: histórico de publicações, seguidores, conexões e vínculos de influência.',
    sidebarSections: sidebarSectionsOsint,
    tabs: ['Resumo', 'Perfil', 'Conteúdo', 'Conexões', 'Atividades', 'Evidências', 'Relatório', 'Configurações'],
  },
  leak: {
    label: 'Vazamento',
    color: '#e24b4a',
    accentRgb: '226,75,74',
    icon: Database,
    description: 'Análise de vazamento de dados: credenciais expostas, alcance do breach, atribuição e impacto nos afetados.',
    sidebarSections: sidebarSectionsOsint,
    tabs: ['Resumo', 'Registros', 'Análise', 'Atribuição', 'Evidências', 'Relatório', 'Configurações'],
  },
}

export const metaFor = (type: EngagementType): EngagementTypeMeta =>
  ENGAGEMENT_META[type] ?? ENGAGEMENT_META.osint
