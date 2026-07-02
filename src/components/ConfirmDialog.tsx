import { useState } from 'react'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import { useUIStore } from '@/store/ui'

export function ConfirmDialog() {
  const { confirm, closeConfirm } = useUIStore()
  const [loading, setLoading] = useState(false)

  if (!confirm) return null
  const danger = confirm.danger ?? true
  const accent = danger ? '#e24b4a' : 'rgba(var(--accent-rgb),1)'

  async function run() {
    if (!confirm) return
    setLoading(true)
    try {
      await confirm.onConfirm()
      closeConfirm()
    } finally {
      setLoading(false)
    }
  }

  function cancel() {
    if (loading) return
    closeConfirm()
  }

  return (
    <>
      <div
        onClick={cancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', zIndex: 7000 }}
      />
      <div
        role="dialog"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 'min(420px, 92vw)', zIndex: 7001, borderRadius: 12, overflow: 'hidden',
          background: 'var(--bg-elevated)', border: '0.5px solid var(--border-hover)',
          boxShadow: '0 24px 64px rgba(0,0,0,.7)',
        }}
      >
        <div style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: `${accent}1a`, border: `1px solid ${accent}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={18} style={{ color: accent }} />
            </div>
            <h2 style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
              {confirm.title}
            </h2>
            <button onClick={cancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}>
              <X size={15} />
            </button>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
            {confirm.message}
          </p>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={cancel} disabled={loading} style={{ padding: '7px 16px', fontSize: 12.5 }}>
              Cancelar
            </button>
            <button
              onClick={run}
              disabled={loading}
              style={{
                padding: '7px 18px', fontSize: 12.5, fontWeight: 600, borderRadius: 7, cursor: loading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                background: danger ? 'rgba(226,75,74,.16)' : 'rgba(var(--accent-rgb),.16)',
                border: `1px solid ${danger ? 'rgba(226,75,74,.5)' : 'rgba(var(--accent-rgb),.5)'}`,
                color: danger ? '#ff7a86' : 'var(--htxt)',
              }}
            >
              {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              {confirm.confirmLabel ?? 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
