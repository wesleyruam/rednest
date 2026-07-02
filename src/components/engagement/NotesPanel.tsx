import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, StickyNote, Clock } from 'lucide-react'
import { listNotes, createNote, updateNote, deleteNote, type Note, type NotePriority, type NoteStatus } from '@/services/notes'
import { useUIStore } from '@/store/ui'

const PRIORITY: Record<NotePriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: '#5ad1ff' },
  medium: { label: 'Média', color: '#f4bc6a' },
  high: { label: 'Alta', color: '#ff9f5a' },
  critical: { label: 'Crítica', color: '#e24b4a' },
}
const STATUS: Record<NoteStatus, { label: string; color: string }> = {
  open: { label: 'Aberta', color: '#8a9cff' },
  doing: { label: 'Em andamento', color: '#f4bc6a' },
  done: { label: 'Concluída', color: '#4dd4a4' },
}
const fmt = (s?: string | null) => s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null
const inp: React.CSSProperties = { padding: '8px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--htxt)', fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }

export function NotesPanel({ operationId, engagementId }: { operationId: string; engagementId?: string }) {
  const { showToast } = useUIStore()
  const [items, setItems] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<NotePriority>('medium')
  const [status, setStatus] = useState<NoteStatus>('open')
  const [dueAt, setDueAt] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => { setLoading(true); listNotes(operationId, engagementId).then(setItems).catch(() => setItems([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [operationId, engagementId])

  async function add() {
    if (!body.trim() && !title.trim()) return
    setBusy(true)
    try {
      await createNote({ operationId, engagementId, title: title.trim(), body: body.trim(), priority, status, dueAt: dueAt || null })
      setBody(''); setTitle(''); setDueAt(''); setPriority('medium'); setStatus('open')
      showToast('Anotação criada', 'success'); load()
    } catch { showToast('Falha ao criar anotação', 'error') } finally { setBusy(false) }
  }
  async function patch(id: string, data: any) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, ...data } : n))
    await updateNote(id, data).catch(() => load())
  }
  async function remove(id: string) {
    setItems(prev => prev.filter(n => n.id !== id))
    await deleteNote(id).catch(() => load())
  }

  return (
    <div className="hud" style={{ flex: 1, overflow: 'auto', padding: '18px 20px', background: 'var(--hbg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Nova anotação */}
      <div className="block hot">
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
        <div className="bhead" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StickyNote size={13} /><span>Nova anotação {engagementId ? '(engajamento)' : '(operação)'}</span></div>
        <div className="bbody" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input style={inp} placeholder="Título (opcional)" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} placeholder="Anotação…" value={body} onChange={e => setBody(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={{ ...inp, cursor: 'pointer' }} value={priority} onChange={e => setPriority(e.target.value as NotePriority)}>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>Prioridade: {v.label}</option>)}
            </select>
            <select style={{ ...inp, cursor: 'pointer' }} value={status} onChange={e => setStatus(e.target.value as NoteStatus)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>Status: {v.label}</option>)}
            </select>
            <input type="datetime-local" style={{ ...inp, cursor: 'pointer' }} value={dueAt} onChange={e => setDueAt(e.target.value)} title="Prazo/horário" />
            <button className="hbtn" disabled={busy} onClick={add} style={{ marginLeft: 'auto', background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)' }}>
              {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />} Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--txt-3)' }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /></div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--txt-3)', fontSize: 12.5 }}>Nenhuma anotação ainda.</div>
      ) : items.map(n => {
        const p = PRIORITY[n.priority]
        return (
          <div key={n.id} className="block hot" style={{ opacity: n.status === 'done' ? 0.6 : 1, borderLeft: `2px solid ${p.color}` }}>
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="bbody">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {n.title && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--htxt)', flex: 1 }}>{n.title}</span>}
                {!n.title && <span style={{ flex: 1 }} />}
                <span className="tag" style={{ fontSize: 9, color: p.color, borderColor: `${p.color}55`, background: `${p.color}1a` }}>{p.label}</span>
                <button onClick={() => remove(n.id)} title="Apagar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(226,75,74,.6)', display: 'flex' }}><Trash2 size={13} /></button>
              </div>
              {n.body && <div style={{ fontSize: 12.5, color: 'var(--txt-2)', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 8 }}>{n.body}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select value={n.status} onChange={e => patch(n.id, { status: e.target.value })}
                  style={{ height: 24, padding: '0 6px', fontSize: 10.5, background: `${STATUS[n.status].color}1a`, color: STATUS[n.status].color, border: `1px solid ${STATUS[n.status].color}55`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={n.priority} onChange={e => patch(n.id, { priority: e.target.value })}
                  style={{ height: 24, padding: '0 6px', fontSize: 10.5, background: 'rgba(255,255,255,.04)', color: 'var(--txt-2)', border: '1px solid var(--line-2)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {n.dueAt && <span style={{ fontSize: 10.5, color: 'var(--txt-3)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> prazo {fmt(n.dueAt)}</span>}
                <span style={{ fontSize: 10, color: 'var(--txt-3)', marginLeft: 'auto' }}>criada {fmt(n.createdAt)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
