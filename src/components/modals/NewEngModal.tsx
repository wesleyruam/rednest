import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useDataStore } from '@/store/data'
import { useAppStore } from '@/store/app'
import type { EngagementType } from '@/types'

const ENG_TYPES: { value: EngagementType; label: string; color: string }[] = [
  { value: 'osint',          label: 'OSINT',         color: '#1D9E75' },
  { value: 'website',        label: 'Website',       color: '#5ad1ff' },
  { value: 'domain',         label: 'Domínio',       color: '#378ADD' },
  { value: 'infrastructure', label: 'Infraestrutura', color: '#8a9cff' },
  { value: 'organization',   label: 'Organização',   color: '#EF9F27' },
  { value: 'person',         label: 'Pessoa',        color: '#e879f9' },
  { value: 'social_profile', label: 'Perfil Social', color: '#e879f9' },
  { value: 'leak',           label: 'Vazamento',     color: '#e24b4a' },
]

export function NewEngModal() {
  const { activeModal, newEngOpId, closeModal, showToast } = useUIStore()
  const { operations, addEngagement } = useDataStore()
  const { openEngagement } = useAppStore()

  const op = operations.find(o => o.id === newEngOpId)

  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [type, setType] = useState<EngagementType>('osint')
  const [tagsRaw, setTagsRaw] = useState('')

  if (activeModal !== 'new-eng') return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !target.trim() || !newEngOpId) return
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    try {
      const id = await addEngagement({ operationId: newEngOpId, name: name.trim(), target: target.trim(), type, tags })
      openEngagement(id)
      closeModal()
      showToast(`Engajamento "${name.trim()}" criado.`, 'success')
    } catch {
      showToast('Falha ao criar engajamento.', 'error')
    }
  }

  function close() {
    setName(''); setTarget(''); setTagsRaw('')
    closeModal()
  }

  return (
    <>
      <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', zIndex: 6000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 480, zIndex: 6001, borderRadius: 10,
        background: 'var(--bg-elevated)', border: '0.5px solid var(--border-hover)',
        boxShadow: '0 24px 64px rgba(0,0,0,.75)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={15} style={{ color: '#378ADD' }} />
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>Novo Engajamento</span>
              {op && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>em {op.name}</span>}
            </div>
          </div>
          <button className="btn" style={{ padding: '4px 8px' }} onClick={close}><X size={13} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="modal-label">Nome do Engajamento *</label>
            <input className="modal-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: OSINT — Análise de Alvo" required autoFocus />
          </div>
          <div>
            <label className="modal-label">Alvo *</label>
            <input className="modal-input" value={target} onChange={e => setTarget(e.target.value)} placeholder="domínio.com, IP, username..." required />
          </div>
          <div>
            <label className="modal-label">Tipo de Engajamento</label>
            <select className="modal-input" value={type} onChange={e => setType(e.target.value as EngagementType)}>
              {ENG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="modal-label">Tags (separadas por vírgula)</label>
            <input className="modal-input" value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} placeholder="osint, domínio, c2" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn" onClick={close}>Cancelar</button>
            <button type="submit" className="btn btn-accent" style={{ opacity: name.trim() && target.trim() ? 1 : 0.5 }}>
              <Plus size={13} /> Criar Engajamento
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
