import type { Engagement } from '@/types'
import { RelatorioTab, ConfiguracoesTab } from './OsintTabs'
import { EvidenciasTab } from './WebTabs'

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyTab({ tab }: { tab: string }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
      <div className="block hot" style={{ marginBottom: 16 }}>
        <div className="bhead">{tab}</div>
        <div className="bbody">
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
            Sem dados para exibir.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function GenericTabContent({ tab, engagement }: { tab: string; engagement: Engagement }) {
  if (tab === 'Relatório')     return <RelatorioTab engagement={engagement} />
  if (tab === 'Configurações') return <ConfiguracoesTab engagement={engagement} />
  if (tab === 'Evidências')    return <EvidenciasTab engagement={engagement} />
  return <EmptyTab tab={tab} />
}
