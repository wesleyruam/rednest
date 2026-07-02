import { ChevronRight, Server, Globe, Eye, Share2, Database, User, Building2, Activity, Clock, Shield, Search, Zap, Layers } from 'lucide-react'
import type { Engagement } from '@/types'
import { useEngagementStatus } from '@/store/data'
import { useUIStore } from '@/store/ui'
import { metaFor } from '@/lib/engagementMeta'

// ─── Tool definitions per engagement type ──────────────────────────────────

type ToolDef = { icon: React.ElementType; label: string; desc: string; color: string }

const TYPE_TOOLS: Record<string, ToolDef[]> = {
  osint: [
    { icon: Search,   label: 'Google Dork',    desc: 'Busca avançada e operadores', color: '#1D9E75' },
    { icon: Globe,    label: 'WHOIS Lookup',   desc: 'Dados de registro de domínio', color: '#378ADD' },
    { icon: Share2,   label: 'Redes Sociais',  desc: 'Perfis e menções públicas',   color: '#e879f9' },
    { icon: Database, label: 'Vazamentos',     desc: 'Busca em bases de breach',    color: '#e24b4a' },
    { icon: Eye,      label: 'OSINT Framework', desc: 'Metodologia estruturada',    color: '#EF9F27' },
    { icon: Layers,   label: 'Shodan',         desc: 'Dispositivos e serviços',     color: '#8a9cff' },
  ],
  website: [
    { icon: Globe,   label: 'DNS Lookup',    desc: 'Registros DNS e resolução',   color: '#5ad1ff' },
    { icon: Server,  label: 'Scan de Portas', desc: 'Portas e serviços expostos',  color: '#8a9cff' },
    { icon: Layers,  label: 'Tecnologias',   desc: 'Stack e versões detectadas',  color: '#EF9F27' },
    { icon: Shield,  label: 'Headers HTTP',  desc: 'Cabeçalhos de segurança',     color: '#1D9E75' },
    { icon: Search,  label: 'Crawl / Fuzz',  desc: 'Diretórios e endpoints',      color: '#378ADD' },
    { icon: Eye,     label: 'SSL/TLS',       desc: 'Certificado e configuração',  color: '#e879f9' },
  ],
  domain: [
    { icon: Globe,  label: 'WHOIS',          desc: 'Registro e proprietário',    color: '#378ADD' },
    { icon: Server, label: 'DNS Passivo',    desc: 'Histórico de registros DNS', color: '#8a9cff' },
    { icon: Layers, label: 'Subdomínios',    desc: 'Enumeração e brute-force',   color: '#1D9E75' },
    { icon: Search, label: 'Wayback Machine', desc: 'Histórico de conteúdo',    color: '#EF9F27' },
  ],
  infrastructure: [
    { icon: Server,   label: 'Port Scan',    desc: 'Portas e serviços ativos',    color: '#8a9cff' },
    { icon: Globe,    label: 'ASN Lookup',   desc: 'Rede e provedor do IP',       color: '#378ADD' },
    { icon: Zap,      label: 'Geolocalização', desc: 'Localização física',        color: '#EF9F27' },
    { icon: Activity, label: 'Traceroute',   desc: 'Rota de rede até o alvo',    color: '#1D9E75' },
    { icon: Database, label: 'Shodan',       desc: 'Reconhecimento passivo',      color: '#e24b4a' },
    { icon: Layers,   label: 'BGP Routing',  desc: 'Roteamento e prefixos',       color: '#5ad1ff' },
  ],
  organization: [
    { icon: Building2, label: 'CNPJ / Registro', desc: 'Dados cadastrais',          color: '#EF9F27' },
    { icon: User,      label: 'Responsáveis',    desc: 'Sócios e diretores',         color: '#e879f9' },
    { icon: Globe,     label: 'Domínios',        desc: 'Ativos web da organização',  color: '#378ADD' },
    { icon: Share2,    label: 'Redes Sociais',   desc: 'Perfis corporativos',        color: '#8a9cff' },
  ],
  person: [
    { icon: User,     label: 'Identidade',       desc: 'CPF e documentos',             color: '#e879f9' },
    { icon: Share2,   label: 'Redes Sociais',    desc: 'Perfis e atividade online',    color: '#8a9cff' },
    { icon: Globe,    label: 'E-mail & Telefone', desc: 'Contatos vinculados',         color: '#378ADD' },
    { icon: Database, label: 'Vazamentos',        desc: 'Dados em breaches',           color: '#e24b4a' },
    { icon: Search,   label: 'Vínculos',          desc: 'Relações e conexões',         color: '#1D9E75' },
  ],
  social_profile: [
    { icon: User,     label: 'Dados do Perfil', desc: 'Bio, foto e info pública',   color: '#e879f9' },
    { icon: Activity, label: 'Atividade',       desc: 'Posts e engajamento',         color: '#8a9cff' },
    { icon: Share2,   label: 'Conexões',        desc: 'Seguidores e seguidos',       color: '#378ADD' },
    { icon: Search,   label: 'Menções',         desc: 'Citações e tags',             color: '#1D9E75' },
    { icon: Clock,    label: 'Histórico',       desc: 'Timeline de atividade',       color: '#EF9F27' },
  ],
  leak: [
    { icon: Database, label: 'Credenciais',  desc: 'Usuários e senhas expostos', color: '#e24b4a' },
    { icon: Shield,   label: 'Hashes',       desc: 'Análise e cracking',         color: '#EF9F27' },
    { icon: Layers,   label: 'Alcance',      desc: 'Volume e abrangência',       color: '#8a9cff' },
    { icon: Search,   label: 'Origem',       desc: 'Fonte do vazamento',         color: '#378ADD' },
    { icon: User,     label: 'Notificação',  desc: 'Comunicar afetados',         color: '#1D9E75' },
  ],
}

const DEFAULT_TOOLS: ToolDef[] = [
  { icon: Search, label: 'Pesquisa Geral',  desc: 'Busca ampla sobre o alvo', color: '#7F77DD' },
  { icon: Globe,  label: 'WHOIS',           desc: 'Dados de registro',        color: '#378ADD' },
  { icon: Eye,    label: 'OSINT',           desc: 'Informações públicas',     color: '#1D9E75' },
]

// ─── Sub-components ────────────────────────────────────────────────────────

function StatNum({ title, value, sub, accent }: { title: string; value: number; sub: string; accent: string }) {
  return (
    <div className="block hot" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>
    </div>
  )
}

function StatInfo({ title, value, dot, sub }: { title: string; value: string; dot?: string; sub?: string }) {
  return (
    <div className="block hot" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: sub ? 5 : 0 }}>
        {dot && (
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: dot,
            boxShadow: `0 0 7px ${dot}88`, flexShrink: 0,
          }} />
        )}
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: mono ? 11 : 12,
        color: 'var(--text-secondary)',
        fontFamily: mono ? "'JetBrains Mono', monospace" : undefined,
        textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</span>
    </div>
  )
}

function ToolBtn({ tool, onClick }: { tool: ToolDef; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        background: 'rgba(255,255,255,.028)', border: '0.5px solid rgba(255,255,255,.07)',
        borderRadius: 7, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
        width: '100%',
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,.052)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,.13)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,.028)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 7, flexShrink: 0,
        background: `${tool.color}18`, border: `0.5px solid ${tool.color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <tool.icon size={14} style={{ color: tool.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{tool.label}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{tool.desc}</div>
      </div>
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function GenericEngView({ engagement }: { engagement: Engagement }) {
  const status = useEngagementStatus(engagement)
  const { showToast } = useUIStore()
  const meta = metaFor(engagement.type)
  const tools = TYPE_TOOLS[engagement.type] ?? DEFAULT_TOOLS
  const isActive = status === 'active'

  const createdAt = new Date(engagement.createdAt)
  const updatedAt = new Date(engagement.updatedAt)
  const daysSince = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)))

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

      {/* ─── Stats row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatNum  title="IOCs"      value={engagement.iocCount}      sub="indicadores mapeados"  accent="#e24b4a" />
        <StatNum  title="Evidências" value={engagement.evidenceCount} sub="artefatos coletados"   accent="#EF9F27" />
        <StatInfo title="Status"    value={isActive ? 'Ativo' : 'Pausado'} dot={isActive ? '#34d27b' : '#e0b341'} />
        <StatInfo title="Iniciado há" value={`${daysSince}d`} sub={createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} />
      </div>

      {/* ─── Main grid ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Description */}
          <div className="block hot" style={{ padding: '16px' }}>
            <div className="bhead" style={{ marginBottom: 10 }}>Sobre este Engajamento</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {meta.description}
            </div>
          </div>

          {/* Tool grid */}
          <div className="block hot">
            <div className="bhead">Ferramentas Recomendadas</div>
            <div className="bbody">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {tools.map(tool => (
                  <ToolBtn
                    key={tool.label}
                    tool={tool}
                    onClick={() => showToast(`Iniciando: ${tool.label}`, 'info')}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Target */}
          <div className="block hot" style={{ padding: '16px' }}>
            <div className="bhead" style={{ marginBottom: 10 }}>Alvo</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5,
              color: 'var(--text-primary)', marginBottom: 10,
              wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              {engagement.target}
            </div>
            {engagement.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {engagement.tags.map(t => (
                  <span key={t} className="eng-tag">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="block hot">
            <div className="bhead">Informações</div>
            <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <MetaRow label="ID"          value={engagement.id}     mono />
              <MetaRow label="Tipo"        value={meta.label} />
              <MetaRow label="Criado em"   value={createdAt.toLocaleDateString('pt-BR')} />
              <MetaRow label="Atualizado"  value={updatedAt.toLocaleDateString('pt-BR')} />
              <MetaRow label="Responsável" value="operator.red" />
            </div>
          </div>

          {/* Coleta CTA */}
          <div className="block hot" style={{ padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.22, userSelect: 'none' }}>📡</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Coleta não iniciada
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6, maxWidth: 220, margin: '0 auto 14px' }}>
              Selecione uma ferramenta e inicie a coleta de dados sobre o alvo.
            </div>
            <button
              className="btn btn-accent"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => showToast('Iniciando coleta de dados...', 'info')}
            >
              <ChevronRight size={13} />
              Iniciar Coleta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
