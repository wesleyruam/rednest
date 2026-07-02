import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useUIStore } from '@/store/ui'

/** Indicador global no titlebar: mostra spinner + nº de tarefas em andamento e,
 *  ao clicar, lista cada uma (com progresso quando disponível). */
export function ActivityIndicator() {
  const { tasks } = useUIStore()
  const [open, setOpen] = useState(false)

  if (tasks.length === 0) return null

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn"
        style={{ padding: '5px 10px', gap: 7, color: '#a9a4ee', borderColor: 'rgba(127,119,221,.4)', background: 'rgba(127,119,221,.12)' }}
        onClick={() => setOpen(v => !v)}
        title={`${tasks.length} tarefa(s) em andamento`}
      >
        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 12 }}>{tasks.length}</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 101, width: 280,
            background: 'var(--bg-elevated)', border: '0.5px solid var(--border-hover)',
            borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          }}>
            <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '0.5px solid var(--border)' }}>
              Em andamento ({tasks.length})
            </div>
            <div style={{ maxHeight: 280, overflow: 'auto' }}>
              {tasks.map(t => {
                const pct = t.progress && t.progress.total ? Math.round((t.progress.done / t.progress.total) * 100) : null
                return (
                  <div key={t.id} style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: '#a9a4ee', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
                      {pct != null && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{pct}%</span>}
                    </div>
                    {pct != null && (
                      <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#7f77dd', transition: 'width .3s ease' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
