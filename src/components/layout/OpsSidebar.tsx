import { Plus, Folder, Settings, Info, LogOut, Key, ShieldAlert, Activity, Rss, Bug, Network, FolderKanban } from 'lucide-react'
import { RedNestMark } from '@/components/brand/RedNestLogo'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'
import { useAppStore } from '@/store/app'

export function OpsSidebar() {
  const { view, selectedOpId, selectOperation, backToOperations, openApiKeys, openSettings, openIocs, openTimeline, openThreatFeeds, openVulnerabilities, openProxies, logout } = useAppStore()
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

  // top nav do rail (seções globais)
  const railNav = [
    { id: 'operations',      label: 'Operações',        Icon: FolderKanban, action: backToOperations },
    { id: 'iocs',            label: 'IOCs',             Icon: ShieldAlert,  action: openIocs },
    { id: 'timeline',        label: 'Timeline',         Icon: Activity,     action: openTimeline },
    { id: 'threat-feeds',    label: 'Threat Feeds',     Icon: Rss,          action: openThreatFeeds },
    { id: 'vulnerabilities', label: 'Vulnerabilidades', Icon: Bug,          action: openVulnerabilities },
    { id: 'proxies',         label: 'Proxies',          Icon: Network,      action: openProxies },
  ] as const

  // itens do rodapé do rail (ações)
  const railFoot = [
    { id: 'api-keys', label: 'Chaves API',     Icon: Key,      action: openApiKeys },
    { id: 'settings', label: 'Configurações',  Icon: Settings, action: openSettings },
    { id: 'about',    label: 'Sobre',          Icon: Info,     action: () => openModal('about') },
  ] as const

  const opsActive = view === 'operations' || view === 'engagement'

  return (
    <>
      {/* ---------- Rail de ícones (sidebar principal) ---------- */}
      <aside className="nav-rail">
        <div className="nav-rail-logo" title="RedNest">
          <RedNestMark size={30} bg="#08080c" />
        </div>

        <nav className="nav-rail-group">
          {railNav.map(item => {
            const isActive = view === item.id || (item.id === 'operations' && opsActive)
            return (
              <button
                key={item.id}
                className={`nav-rail-btn ${isActive ? 'active' : ''}`}
                onClick={item.action}
                title={item.label}
                aria-label={item.label}
              >
                <item.Icon size={18} />
              </button>
            )
          })}
        </nav>

        <div className="nav-rail-spacer" />

        <div className="nav-rail-group">
          {railFoot.map(item => (
            <button
              key={item.id}
              className={`nav-rail-btn ${view === item.id ? 'active' : ''}`}
              onClick={item.action}
              title={item.label}
              aria-label={item.label}
            >
              <item.Icon size={17} />
            </button>
          ))}
          <button className="nav-rail-btn danger" onClick={logout} title="Sair" aria-label="Sair">
            <LogOut size={17} />
          </button>
          <div className="nav-rail-avatar" title="operator.red · CTI Analyst">OR</div>
        </div>
      </aside>

      {/* ---------- Sub-sidebar (Operações) ---------- */}
      <aside className="ops-sidebar ops-subsidebar">
        <div className="ops-sidebar-header">
          <button className="ops-new-btn" onClick={() => openModal('new-op')}>
            <Plus size={14} />
            Nova Operação
          </button>
        </div>

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
      </aside>
    </>
  )
}
