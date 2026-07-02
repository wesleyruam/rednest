import { Target, Network, Eye, Bell, FileText } from 'lucide-react'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'
import { useAppStore } from '@/store/app'
import type { Operation } from '@/types'

function statusStyle(status: string) {
  if (status === 'active')    return { background: 'rgba(29,158,117,.14)', color: '#4dd4a4', border: '0.5px solid rgba(29,158,117,.3)' }
  if (status === 'paused')    return { background: 'rgba(239,159,39,.12)', color: '#f4bc6a', border: '0.5px solid rgba(239,159,39,.3)' }
  if (status === 'completed') return { background: 'rgba(55,138,221,.12)', color: '#7ab8f0', border: '0.5px solid rgba(55,138,221,.3)' }
  return {}
}
const statusLabel: Record<string, string> = { active: 'Ativa', paused: 'Pausada', completed: 'Concluída', archived: 'Arquivada' }

function OperationCard({ op }: { op: Operation }) {
  const { selectedOpId, selectOperation } = useAppStore()
  const isSelected = selectedOpId === op.id
  const pri = op.priority
  const priColor = pri === 'critical' ? '#e24b4a' : pri === 'high' ? '#EF9F27' : pri === 'medium' ? '#639922' : '#378ADD'

  return (
    <button
      onClick={() => selectOperation(op.id)}
      style={{
        width: '100%', background: isSelected ? 'rgba(127,119,221,.08)' : 'var(--bg-elevated)',
        border: `0.5px solid ${isSelected ? 'rgba(127,119,221,.4)' : 'var(--border)'}`,
        borderRadius: 8, padding: '12px 14px', textAlign: 'left',
        cursor: 'pointer', transition: 'all 0.12s', marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Eye size={13} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#e9e9f1' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {op.name}
            </div>
          </div>
        </div>
        <span className="badge" style={statusStyle(op.status)}>{statusLabel[op.status]}</span>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {op.description}
      </p>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
        {op.tags.map(tag => (
          <span key={tag} style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 4, background: 'rgba(255,255,255,.04)', border: '0.5px solid var(--border-hover)', color: 'var(--text-muted)' }}>
            {tag}
          </span>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Progresso</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{op.progress}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${op.progress}%`, background: `linear-gradient(90deg, ${priColor}99, ${priColor})` }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
          {new Date(op.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
        <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Network size={11} /> {op.engagementCount}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Bell size={11} style={{ color: op.alertCount > 0 ? '#e24b4a' : undefined }} /> {op.alertCount}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><FileText size={11} /> {op.reportCount}</span>
        </div>
      </div>
    </button>
  )
}

export function OperationsPanel() {
  const { operations, stats } = useDataStore()
  const { filterFolder } = useUIStore()

  const filtered = filterFolder === 'all' ? operations
    : operations.filter(o => o.status === (filterFolder === 'completed' ? 'completed' : filterFolder === 'archived' ? 'archived' : 'active'))

  const headerLabel = filterFolder === 'all' ? 'Todas as Operações'
    : filterFolder === 'active' ? 'Operações Ativas'
    : filterFolder === 'completed' ? 'Operações Concluídas'
    : 'Operações Arquivadas'

  return (
    <div style={{ width: 340, minWidth: 340, display: 'flex', flexDirection: 'column', borderRight: '0.5px solid var(--border)', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Stats */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface)' }}>
        {[
          { icon: Target, label: 'OPERAÇÕES ATIVAS', value: stats?.activeOperations ?? 0, color: '#7F77DD' },
          { icon: Network, label: 'ENGAJAMENTOS',     value: stats?.engagements ?? 0, color: '#1D9E75' },
          { icon: Eye,    label: 'ALVOS',             value: stats?.targetsMonitored ?? 0, color: '#378ADD' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: '10px 12px', borderRight: '0.5px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <s.icon size={12} style={{ color: s.color }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e9e9f1', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ padding: '12px 14px 8px', borderBottom: '0.5px solid var(--border)', flexShrink: 0, background: 'var(--bg-surface)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{headerLabel}</div>
        {filtered.length !== operations.length && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{filtered.length} de {operations.length} operações</div>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '24px 0' }}>Nenhuma operação nesta pasta.</div>
        ) : (
          filtered.map(op => <OperationCard key={op.id} op={op} />)
        )}
      </div>
    </div>
  )
}
