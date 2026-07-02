import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useDataStore } from '@/store/data'
import { useAppStore } from '@/store/app'
import type { OperationPriority } from '@/types'

const PRIORITIES: { value: OperationPriority; label: string; color: string }[] = [
  { value: 'critical', label: 'Crítica',  color: '#e24b4a' },
  { value: 'high',     label: 'Alta',     color: '#EF9F27' },
  { value: 'medium',   label: 'Média',    color: '#639922' },
  { value: 'low',      label: 'Baixa',    color: '#378ADD' },
]

export function NewOpModal() {
  const { activeModal, closeModal, showToast } = useUIStore()
  const { addOperation } = useDataStore()
  const { selectOperation } = useAppStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<OperationPriority>('high')
  const [status, setStatus] = useState<'active' | 'paused'>('active')
  const [tagsRaw, setTagsRaw] = useState('')

  if (activeModal !== 'new-op') return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    try {
      const id = await addOperation({ name: name.trim(), description: description.trim(), priority, status, tags })
      selectOperation(id)
      closeModal()
      showToast(`Operação "${name.trim()}" criada com sucesso.`, 'success')
    } catch {
      showToast('Falha ao criar operação.', 'error')
    }
  }

  function close() {
    setName(''); setDescription(''); setTagsRaw('')
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
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={15} style={{ color: '#7F77DD' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>Nova Operação</span>
          </div>
          <button className="btn" style={{ padding: '4px 8px' }} onClick={close}><X size={13} /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="modal-label">Nome da Operação *</label>
            <input
              className="modal-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Operação Mercúrio"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="modal-label">Descrição</label>
            <textarea
              className="modal-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Objetivo principal da operação..."
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="modal-label">Prioridade</label>
              <select className="modal-input" value={priority} onChange={e => setPriority(e.target.value as OperationPriority)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="modal-label">Status inicial</label>
              <select className="modal-input" value={status} onChange={e => setStatus(e.target.value as 'active' | 'paused')}>
                <option value="active">Ativa</option>
                <option value="paused">Pausada</option>
              </select>
            </div>
          </div>
          <div>
            <label className="modal-label">Tags (separadas por vírgula)</label>
            <input
              className="modal-input"
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="cti, ameaça, phishing"
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn" onClick={close}>Cancelar</button>
            <button type="submit" className="btn btn-accent" style={{ opacity: name.trim() ? 1 : 0.5 }}>
              <Plus size={13} /> Criar Operação
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
