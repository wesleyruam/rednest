import { X, Bell, CheckCheck } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useDataStore } from '@/store/data'

function sevColor(s: string) {
  if (s === 'critical') return { color: '#f0476a', bg: 'rgba(240,71,106,.14)', border: 'rgba(240,71,106,.4)' }
  if (s === 'high')     return { color: '#fb923c', bg: 'rgba(251,146,60,.12)', border: 'rgba(251,146,60,.4)' }
  if (s === 'medium')   return { color: '#e0b341', bg: 'rgba(224,179,65,.1)',  border: 'rgba(224,179,65,.35)' }
  return                       { color: '#3fb6f5', bg: 'rgba(63,182,245,.1)',  border: 'rgba(63,182,245,.35)' }
}
function sevLabel(s: string) {
  return s === 'critical' ? 'Crítico' : s === 'high' ? 'Alto' : s === 'medium' ? 'Médio' : 'Baixo'
}
function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `há ${d}d`
  if (h > 0) return `há ${h}h`
  return 'agora'
}

export function Notifications() {
  const { notificationsOpen, closeNotifications } = useUIStore()
  const { alerts, markAlertRead, markAllAlertsRead } = useDataStore()

  if (!notificationsOpen) return null

  const unread = alerts.filter(a => !a.acknowledged).length

  return (
    <>
      <div onClick={closeNotifications} style={{ position: 'fixed', inset: 0, zIndex: 3999 }} />
      <div style={{
        position: 'fixed', top: 36, right: 0, width: 360, height: 'calc(100vh - 36px)',
        background: 'var(--bg-elevated)', borderLeft: '0.5px solid var(--border-hover)',
        zIndex: 4000, display: 'flex', flexDirection: 'column',
        boxShadow: '-16px 0 48px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Notificações</span>
            {unread > 0 && (
              <span style={{ fontSize: 10.5, background: 'rgba(240,71,106,.16)', color: '#f0476a', border: '0.5px solid rgba(240,71,106,.4)', borderRadius: 10, padding: '1px 8px' }}>{unread}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={() => markAllAlertsRead()}>
              <CheckCheck size={12} /> Marcar lidas
            </button>
            <button className="btn" style={{ padding: '4px 8px' }} onClick={closeNotifications}>
              <X size={13} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {alerts.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              Nenhuma notificação.
            </div>
          )}
          {alerts.map(alert => {
            const isRead = alert.acknowledged
            const sc = sevColor(alert.severity)
            return (
              <div
                key={alert.id}
                onClick={() => markAlertRead(alert.id)}
                style={{
                  padding: '12px 16px', borderBottom: '0.5px solid var(--border)',
                  cursor: 'pointer', opacity: isRead ? 0.5 : 1,
                  background: isRead ? 'transparent' : 'rgba(255,255,255,.018)',
                  transition: 'opacity 0.15s, background 0.1s',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                onMouseOut={e => (e.currentTarget.style.background = isRead ? 'transparent' : 'rgba(255,255,255,.018)')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                    {!isRead && <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />}
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alert.title}
                    </span>
                  </div>
                  <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: sc.bg, color: sc.color, border: `0.5px solid ${sc.border}`, flexShrink: 0 }}>
                    {sevLabel(alert.severity)}
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 4px' }}>{alert.description}</p>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{timeAgo(alert.timestamp)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
