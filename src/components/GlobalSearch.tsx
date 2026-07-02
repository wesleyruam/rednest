import { useState, useEffect, useRef } from 'react'
import { Search, X, Target, Globe } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useDataStore } from '@/store/data'
import { useAppStore } from '@/store/app'

const typeColors: Record<string, string> = {
  osint: '#1D9E75', website: '#5ad1ff', domain: '#378ADD',
  infrastructure: '#8a9cff', organization: '#EF9F27',
  person: '#e879f9', social_profile: '#e879f9', leak: '#e24b4a',
}
const typeLabels: Record<string, string> = {
  osint: 'OSINT', website: 'Web', domain: 'Domínio',
  infrastructure: 'Infra', organization: 'Org', person: 'Pessoa',
  social_profile: 'Social', leak: 'Vazamento',
}

export function GlobalSearch() {
  const { globalSearchOpen, closeGlobalSearch } = useUIStore()
  const { operations, engagements } = useDataStore()
  const { selectOperation, openEngagement } = useAppStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (globalSearchOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [globalSearchOpen])

  if (!globalSearchOpen) return null

  const q = query.toLowerCase().trim()
  const matchOps = q
    ? operations.filter(o => o.name.toLowerCase().includes(q) || o.description.toLowerCase().includes(q) || o.tags.some(t => t.toLowerCase().includes(q))).slice(0, 5)
    : operations.slice(0, 4)
  const matchEngs = q
    ? engagements.filter(e => e.name.toLowerCase().includes(q) || e.target.toLowerCase().includes(q)).slice(0, 5)
    : engagements.slice(0, 3)

  function navigate(fn: () => void) {
    fn()
    closeGlobalSearch()
  }

  return (
    <>
      <div
        onClick={closeGlobalSearch}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', zIndex: 5000 }}
      />
      <div style={{
        position: 'fixed', top: '14%', left: '50%', transform: 'translateX(-50%)',
        width: 560, zIndex: 5001, borderRadius: 10,
        background: 'var(--bg-elevated)', border: '0.5px solid var(--border-hover)',
        boxShadow: '0 24px 64px rgba(0,0,0,.75)',
        overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') closeGlobalSearch() }}
            placeholder="Buscar operações, engajamentos, IOCs..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'inherit' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
              <X size={13} />
            </button>
          )}
          <kbd style={{ fontSize: 10, background: 'var(--bg-hover)', border: '0.5px solid var(--border-hover)', borderRadius: 4, padding: '2px 6px', color: 'var(--text-muted)', flexShrink: 0 }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {matchOps.length > 0 && (
            <div style={{ padding: '8px 0 4px' }}>
              <div style={{ padding: '2px 16px 5px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Operações</div>
              {matchOps.map(op => (
                <button
                  key={op.id}
                  onClick={() => navigate(() => selectOperation(op.id))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(127,119,221,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Target size={14} style={{ color: '#7F77DD' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.description}</div>
                  </div>
                  <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: op.status === 'active' ? 'rgba(29,158,117,.14)' : 'rgba(239,159,39,.12)', color: op.status === 'active' ? '#4dd4a4' : '#f4bc6a', flexShrink: 0 }}>
                    {op.status === 'active' ? 'Ativa' : op.status === 'paused' ? 'Pausada' : 'Concluída'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {matchEngs.length > 0 && (
            <div style={{ padding: '4px 0' }}>
              <div style={{ padding: '6px 16px 5px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Engajamentos</div>
              {matchEngs.map(eng => {
                const color = typeColors[eng.type] ?? '#888'
                return (
                  <button
                    key={eng.id}
                    onClick={() => navigate(() => openEngagement(eng.id))}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Globe size={14} style={{ color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eng.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{eng.target}</div>
                    </div>
                    <span style={{ fontSize: 9.5, padding: '1px 6px', borderRadius: 3, background: `${color}18`, color, border: `0.5px solid ${color}44`, flexShrink: 0 }}>
                      {typeLabels[eng.type] ?? eng.type}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {q && !matchOps.length && !matchEngs.length && (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum resultado para "<span style={{ color: 'var(--text-secondary)' }}>{query}</span>"
            </div>
          )}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
          <span><kbd style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-hover)', borderRadius: 3, padding: '1px 5px', fontSize: 10, marginRight: 4 }}>Enter</kbd>abrir</span>
          <span><kbd style={{ background: 'var(--bg-hover)', border: '0.5px solid var(--border-hover)', borderRadius: 3, padding: '1px 5px', fontSize: 10, marginRight: 4 }}>Esc</kbd>fechar</span>
        </div>
      </div>
    </>
  )
}
