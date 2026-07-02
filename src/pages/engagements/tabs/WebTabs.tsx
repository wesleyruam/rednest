import type { Engagement } from '@/types'
import { RelatorioTab, ConfiguracoesTab } from './OsintTabs'
import { EvidencePanel } from '@/components/data/DataPanels'

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyWebTab({ title }: { title: string }) {
  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', padding: '18px 20px', background: 'var(--hbg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="block hot">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead"><span className="t">{title}</span></div>
        <div className="bbody">
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--txt-3)' }}>
            Sem dados para exibir.
          </div>
        </div>
      </div>
    </div>
  )
}

// Evidências — agora consome o backend (upload/list/download/delete)
export function EvidenciasTab({ engagement }: { engagement: Engagement }) {
  return <EvidencePanel engagement={engagement} />
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function WebTabContent({ tab, engagement }: { tab: string; engagement: Engagement }) {
  const data = engagement.webData
  switch (tab) {
    case 'Evidências':       return <EvidenciasTab engagement={engagement} />
    case 'Relatório':        return <RelatorioTab engagement={engagement} />
    case 'Configurações':    return <ConfiguracoesTab engagement={engagement} />
  }
  if (!data) return (
    <div className="hud" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--hbg)', color: 'var(--txt-3)' }}>
      Sem dados Web para este engajamento.
    </div>
  )
  switch (tab) {
    case 'Reconhecimento':   return <EmptyWebTab title="Reconhecimento" />
    case 'Tecnologias':      return <EmptyWebTab title="Tecnologias" />
    case 'Conteúdo':         return <EmptyWebTab title="Conteúdo" />
    case 'Vulnerabilidades': return <EmptyWebTab title="Vulnerabilidades" />
    case 'Infraestrutura':   return <EmptyWebTab title="Infraestrutura" />
    case 'Monitoramento':    return <EmptyWebTab title="Monitoramento" />
    default:                 return null
  }
}
