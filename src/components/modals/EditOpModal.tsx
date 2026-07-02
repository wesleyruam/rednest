import { useState, useEffect } from 'react'
import { X, Pencil } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useDataStore } from '@/store/data'
import type { OperationPriority } from '@/types'

const PRIORITIES: { value: OperationPriority; label: string }[] = [
  { value: 'critical', label: 'Crítica' },
  { value: 'high',     label: 'Alta' },
  { value: 'medium',   label: 'Média' },
  { value: 'low',      label: 'Baixa' },
]

export function EditOpModal() {
  const { activeModal, editingOpId, closeModal, showToast } = useUIStore()
  const { operations, updateOperation } = useDataStore()

  const op = operations.find(o => o.id === editingOpId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<OperationPriority>('high')
  const [tagsRaw, setTagsRaw] = useState('')

  useEffect(() => {
    if (op && activeModal === 'edit-op') {
      setName(op.name)
      setDescription(op.description)
      setPriority(op.priority)
      setTagsRaw(op.tags.join(', '))
    }
  }, [op, activeModal])

  if (activeModal !== 'edit-op' || !op) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    try {
      await updateOperation(op!.id, { name: name.trim(), description: description.trim(), priority, tags })
      closeModal()
      showToast(`Operação "${name.trim()}" atualizada.`, 'success')
    } catch {
      showToast('Falha ao atualizar operação.', 'error')
    }
  }

  return (
    <>
      <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', zIndex: 6000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 480, zIndex: 6001, borderRadius: 10,
        background: 'var(--bg-elevated)', border: '0.5px solid var(--border-hover)',
        boxShadow: '0 24px 64px rgba(0,0,0,.75)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pencil size={14} style={{ color: '#7F77DD' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Space Grotesk', sans-serif" }}>Editar Operação</span>
          </div>
          <button className="btn" style={{ padding: '4px 8px' }} onClick={closeModal}><X size={13} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="modal-label">Nome da Operação *</label>
            <input className="modal-input" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="modal-label">Descrição</label>
            <textarea className="modal-input" value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="modal-label">Prioridade</label>
              <select className="modal-input" value={priority} onChange={e => setPriority(e.target.value as OperationPriority)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="modal-label">Tags (separadas por vírgula)</label>
            <input className="modal-input" value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} placeholder="cti, ameaça, phishing" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn" onClick={closeModal}>Cancelar</button>
            <button type="submit" className="btn btn-accent" style={{ opacity: name.trim() ? 1 : 0.5 }}>
              <Pencil size={13} /> Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
