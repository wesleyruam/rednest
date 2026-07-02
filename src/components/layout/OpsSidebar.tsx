import { Plus, Folder, Settings, Info, LogOut, Key, ShieldAlert, Activity, Rss, Bug, Network } from 'lucide-react'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'
import { useAppStore } from '@/store/app'

export function OpsSidebar() {
  const { view, selectedOpId, selectOperation, openApiKeys, openSettings, openIocs, openTimeline, openThreatFeeds, openVulnerabilities, openProxies, logout } = useAppStore()
  const { operations } = useDataStore()
  const { filterFolder, setFilterFolder, openModal } = useUIStore()

  const active   = operations.filter(o => o.status === 'active')
  const done     = operations.filter(o => o.status === 'completed')
  const archived = operations.filter(o => o.status === 'archived')

  const displayed = filterFolder === 'all'       ? operations
                  : filterFolder === 'active'    ? active
                  : filterFolder === 'completed' ? done
                  : archived

  const folders = [
    { key: 'active',    label: 'Ativas',     count: active.length },
    { key: 'completed', label: 'Concluídas', count: done.length },
    { key: 'archived',  label: 'Arquivadas', count: archived.length },
  ] as const

  const navItems = [
    { id: 'iocs',     label: 'IOCs',     Icon: ShieldAlert, action: openIocs },
    { id: 'timeline', label: 'Timeline', Icon: Activity,    action: openTimeline },
    { id: 'threat-feeds', label: 'Threat Feeds', Icon: Rss, action: openThreatFeeds },
    { id: 'vulnerabilities', label: 'Vulnerabilidades', Icon: Bug, action: openVulnerabilities },
    { id: 'proxies', label: 'Proxies', Icon: Network, action: openProxies },
  ] as const

  return (
    <aside className="ops-sidebar">
      {/* New Op button */}
      <div className="ops-sidebar-header">
        <button className="ops-new-btn" onClick={() => openModal('new-op')}>
          <Plus size={14} />
          Nova Operação
        </button>
      </div>

      {/* Quick nav: grid 2×2 para caber todos os atalhos sem cortar */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '0.5px solid var(--border)',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
      }}>
        {navItems.map(item => {
          const isActive = view === item.id
          return (
            <button
              key={item.id}
              onClick={item.action}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
                padding: '6px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: isActive ? 'rgba(127,119,221,.15)' : 'rgba(255,255,255,.03)',
                color: isActive ? '#a09ae8' : 'var(--text-muted)',
                fontSize: 11, fontWeight: isActive ? 600 : 400,
                transition: 'all .15s',
              }}
              onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.06)' }}
              onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
              title={item.label}
            >
              <item.Icon size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Operations list */}
      <div className="ops-sidebar-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px 4px' }}>
          <div className="ops-sidebar-section-label" style={{ padding: 0 }}>Operações</div>
          {filterFolder !== 'all' && (
            <button
              onClick={() => setFilterFolder('all')}
              style={{ fontSize: 9.5, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px' }}
            >
              ✕ {filterFolder === 'active' ? 'Ativas' : filterFolder === 'completed' ? 'Concluídas' : 'Arquivadas'}
            </button>
          )}
        </div>
        {displayed.map(op => (
          <button
            key={op.id}
            className={`ops-sidebar-item ${selectedOpId === op.id && view === 'operations' ? 'active' : ''}`}
            onClick={() => { selectOperation(op.id) }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background:
                  op.status === 'active'    ? 'var(--accent-green)' :
                  op.status === 'paused'    ? 'var(--accent-amber)' :
                  op.status === 'completed' ? 'var(--accent-blue)'  : 'var(--text-muted)',
              }}
            />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {op.name}
            </span>
            {op.status !== 'active' && (
              <span style={{
                fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                background: op.status === 'paused' ? 'rgba(239,159,39,.15)' : 'rgba(55,138,221,.12)',
                color: op.status === 'paused' ? '#f4bc6a' : '#7ab8f0',
                flexShrink: 0,
              }}>
                {op.status === 'paused' ? 'Pausada' : 'Concluída'}
              </span>
            )}
          </button>
        ))}

        {/* Folders */}
        <div className="ops-sidebar-section-label" style={{ marginTop: 16 }}>Pastas</div>
        {folders.map(f => (
          <button
            key={f.key}
            className="ops-sidebar-folder"
            onClick={() => setFilterFolder(filterFolder === f.key ? 'all' : f.key)}
            style={{ background: filterFolder === f.key ? 'rgba(127,119,221,.08)' : undefined }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Folder size={13} style={{ color: filterFolder === f.key ? '#7F77DD' : 'var(--text-muted)' }} />
              <span style={{ color: filterFolder === f.key ? '#a9a4ee' : undefined }}>{f.label}</span>
            </div>
            <span className="ops-folder-count">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="ops-sidebar-footer">
        <div className="user-card">
          <div className="user-avatar"><span>OR</span></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">operator.red</div>
            <div className="user-role">CTI Analyst</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button className="btn" style={{ padding: '4px 8px', flex: 1, justifyContent: 'center' }} onClick={openApiKeys} title="Chaves API">
            <Key size={13} />
          </button>
          <button className="btn" style={{ padding: '4px 8px', flex: 1, justifyContent: 'center' }} onClick={openSettings} title="Configurações">
            <Settings size={13} />
          </button>
          <button className="btn" style={{ padding: '4px 8px', flex: 1, justifyContent: 'center' }} onClick={() => openModal('about')} title="Sobre">
            <Info size={13} />
          </button>
          <button className="btn btn-danger" style={{ padding: '4px 8px', flex: 1, justifyContent: 'center' }} onClick={logout} title="Sair">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
