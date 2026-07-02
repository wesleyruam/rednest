import { Search, Sun, Bell, MoreHorizontal, ChevronRight } from 'lucide-react'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'
import { metaFor } from '@/lib/engagementMeta'
import { ActivityIndicator } from './ActivityIndicator'
import type { Engagement, Operation } from '@/types'

interface TitlebarOpsProps { mode: 'operations' }
interface TitlebarEngProps { mode: 'engagement'; operation: Operation; engagement: Engagement }
type TitlebarProps = TitlebarOpsProps | TitlebarEngProps

export function Titlebar(props: TitlebarProps) {
  const { alerts } = useDataStore()
  const { openGlobalSearch, toggleNotifications } = useUIStore()

  const unread = alerts.filter(a => !a.acknowledged).length

  return (
    <div className="titlebar">
      {/* Brand */}
      <div className="titlebar-brand">
        <span className="brand-dot" />
        <div>
          <div className="brand-name">REDNEST</div>
          <div className="brand-sub">OSINT &amp; CTI PLATFORM</div>
        </div>
      </div>

      {props.mode === 'engagement' && (
        <>
          <div className="titlebar-divider" />
          <div className="breadcrumb">
            <span className="breadcrumb-item" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {props.engagement.id.split('-')[0].toUpperCase()}_{props.engagement.id.split('-')[1].padStart(3,'0').toUpperCase()}
            </span>
            <ChevronRight size={11} className="breadcrumb-sep" />
            <span className="breadcrumb-item">{props.operation.name}</span>
            <ChevronRight size={11} className="breadcrumb-sep" />
            <span className="breadcrumb-item active" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {props.engagement.name.split('—')[0].trim()}
            </span>
            {(() => {
              const meta = metaFor(props.engagement.type)
              return (
                <span className="eng-type-pill" style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}1a` }}>
                  {meta.label}
                </span>
              )
            })()}
          </div>
        </>
      )}

      <div className="titlebar-right">
        {/* Search */}
        <button
          className="btn"
          style={{ gap: 8, width: 200, justifyContent: 'flex-start', fontSize: 12 }}
          onClick={openGlobalSearch}
        >
          <Search size={13} />
          <span style={{ color: 'var(--text-muted)' }}>Buscar IOC, e-mail, domínio...</span>
          <kbd style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--bg-hover)', border: '0.5px solid var(--border-hover)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-muted)' }}>Ctrl K</kbd>
        </button>

        <ActivityIndicator />

        <button className="btn" style={{ padding: '5px 8px' }} title="Tema">
          <Sun size={14} />
        </button>

        <button
          className="btn"
          style={{ padding: '5px 8px', position: 'relative' }}
          onClick={toggleNotifications}
          title="Notificações"
        >
          <Bell size={14} />
          {unread > 0 && (
            <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--sev-critical)' }} />
          )}
        </button>

        <button className="btn" style={{ padding: '5px 8px' }} title="Menu">
          <MoreHorizontal size={14} />
        </button>
      </div>
    </div>
  )
}
