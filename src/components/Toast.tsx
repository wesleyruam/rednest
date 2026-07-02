import { useEffect } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useUIStore } from '@/store/ui'

export function Toast() {
  const { toast, clearToast } = useUIStore()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clearToast, 3500)
    return () => clearTimeout(t)
  }, [toast, clearToast])

  if (!toast) return null

  const c = {
    success: { bg: 'rgba(29,158,117,.18)', border: 'rgba(29,158,117,.45)', color: '#4dd4a4', Icon: CheckCircle },
    error:   { bg: 'rgba(226,75,74,.16)',  border: 'rgba(226,75,74,.4)',   color: '#ff8a8a', Icon: XCircle },
    info:    { bg: 'rgba(55,138,221,.14)', border: 'rgba(55,138,221,.4)',  color: '#7ab8f0', Icon: Info },
  }[toast.type]

  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', borderRadius: 8,
      background: c.bg, border: `0.5px solid ${c.border}`,
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      fontSize: 13, color: c.color,
      minWidth: 240, maxWidth: 420,
      pointerEvents: 'auto',
    }}>
      <c.Icon size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button onClick={clearToast} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.color, opacity: 0.6, padding: 2, flexShrink: 0 }}>
        <X size={12} />
      </button>
    </div>
  )
}
