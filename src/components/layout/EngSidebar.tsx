import { useEffect, useState } from 'react'
import { ArrowLeft, Activity } from 'lucide-react'
import { metaFor } from '@/lib/engagementMeta'
import { useAppStore } from '@/store/app'
import { getFindingCounts } from '@/services/findings'
import type { Engagement } from '@/types'

interface EngSidebarProps {
  engagement: Engagement
  activeTool: string
  onSelectTool: (id: string) => void
}

export function EngSidebar({ engagement, activeTool, onSelectTool }: EngSidebarProps) {
  const { backToOperations } = useAppStore()
  const meta = metaFor(engagement.type)
  const [findingCounts, setFindingCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    let live = true
    getFindingCounts(engagement.id)
      .then((c) => { if (live) setFindingCounts(c) })
      .catch(() => { if (live) setFindingCounts({}) })
    return () => { live = false }
  }, [engagement.id, engagement.updatedAt])

  const counts: Record<string, number> = {
    indicators: (findingCounts.ioc || 0) + (findingCounts.leak || 0) + (findingCounts.credential || 0) + (findingCounts.cve || 0) + (findingCounts.host || 0),
    artifacts: (findingCounts.subdomain || 0) + (findingCounts.url || 0) + (findingCounts.endpoint || 0) + (findingCounts.service || 0) + (findingCounts.tech || 0) + (findingCounts.profile || 0),
    evidences: engagement.evidenceCount ?? 0,
    pages: findingCounts.url || 0,
    resources: findingCounts.tech || 0,
    urls: (findingCounts.url || 0) + (findingCounts.endpoint || 0),
    endpoints: findingCounts.endpoint || 0,
  }

  return (
    <aside className="eng-sidebar" style={{ ['--accent-c' as string]: meta.color }}>
      {/* Back button at top */}
      <div style={{ padding: '8px 8px 0', flexShrink: 0 }}>
        <button className="back-btn" onClick={backToOperations}>
          <ArrowLeft size={13} />
          Voltar para Operações
        </button>

        {/* Active engagement */}
        <div className="ops-sidebar-section-label">Engajamento</div>
        <button
          className={`eng-nav-item ${activeTool === 'visao-geral' ? 'active' : ''}`}
          style={{ ['--accent-c' as string]: meta.color }}
          onClick={() => onSelectTool('visao-geral')}
        >
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: meta.color, boxShadow: `0 0 8px ${meta.color}`,
            flexShrink: 0,
          }} />
          Visão Geral
        </button>
      </div>

      {/* Sections */}
      <div className="eng-sidebar-body">
        {meta.sidebarSections.map((section) => (
          <div key={section.label}>
            <div className="eng-sidebar-section-label">{section.label}</div>
            {section.items.map(item => {
              const count = item.countKey ? counts[item.countKey] : undefined
              return (
                <button
                  key={item.id}
                  className={`eng-nav-item ${activeTool === item.id ? 'active' : ''}`}
                  onClick={() => onSelectTool(item.id)}
                >
                  <item.icon size={13} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                  {count != null && (
                    <span className="eng-nav-badge">{count.toLocaleString('pt-BR')}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="eng-sidebar-footer">
        <div className="ws-status">
          <Activity size={11} />
          <span>live</span>
        </div>
      </div>
    </aside>
  )
}
