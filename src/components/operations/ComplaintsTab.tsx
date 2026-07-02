import { useEffect, useMemo, useState } from 'react'
import { Flag, Plus, Trash2, Pencil, ExternalLink, Loader2, X, Check } from 'lucide-react'
import {
  listComplaints, complaintStats, createComplaint, updateComplaint, deleteComplaint,
  type Complaint, type ComplaintStatus, type ComplaintPriority, type ComplaintStats,
} from '@/services/complaints'
import { useUIStore } from '@/store/ui'

const STATUS: Record<ComplaintStatus, { label: string; c: string }> = {
  draft: { label: 'Rascunho', c: '#888' },
  submitted: { label: 'Enviada', c: '#378ADD' },
  acknowledged: { label: 'Recebida', c: '#5ad1ff' },
  in_review: { label: 'Em análise', c: '#EF9F27' },
  resolved: { label: 'Resolvida', c: '#1D9E75' },
  rejected: { label: 'Rejeitada', c: '#e24b4a' },
  closed: { label: 'Encerrada', c: '#7F77DD' },
}
const PRIORITY: Record<ComplaintPriority, { label: string; c: string }> = {
  critical: { label: 'Crítica', c: '#e24b4a' }, high: { label: 'Alta', c: '#EF9F27' },
  medium: { label: 'Média', c: '#378ADD' }, low: { label: 'Baixa', c: '#888' },
}
const PLATFORMS = ['GoDaddy', 'Cloudflare', 'Namecheap', 'Hostinger', 'Google Safe Browsing', 'Google Legal', 'Meta / Facebook', 'Instagram', 'X (Twitter)', 'TikTok', 'YouTube', 'Telegram', 'Discord', 'NCMEC / CyberTipline', 'IC3 (FBI)', 'Interpol', 'SaferNet Brasil', 'Polícia Civil', 'Registrar (WHOIS abuse)', 'Provedor de hosting']
const CATEGORIES = ['CSAM (abuso infantil)', 'Phishing', 'Malware', 'Fraude / Golpe', 'Spam', 'Direitos autorais', 'Conteúdo ilegal', 'Assédio', 'Desinformação', 'Outro']

const C = { txt: 'var(--text-primary)', txt2: 'var(--text-secondary)', txt3: 'var(--text-muted)', border: 'var(--border)', bg: 'var(--bg-surface)' }
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }
const fmt = (s?: string | null) => s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const inp: React.CSSProperties = { padding: '8px 10px', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`, borderRadius: 7, color: C.txt, fontSize: 12.5, outline: 'none', fontFamily: 'inherit', width: '100%' }

const emptyForm = (): ComplaintFormState => ({ target: '', platform: '', category: '', ticketId: '', ticketUrl: '', status: 'submitted', priority: 'medium', submittedAt: '', notes: '' })
interface ComplaintFormState { target: string; platform: string; category: string; ticketId: string; ticketUrl: string; status: ComplaintStatus; priority: ComplaintPriority; submittedAt: string; notes: string }

export function ComplaintsTab({ operationId }: { operationId: string }) {
  const { showToast, requestConfirm } = useUIStore()
  const [items, setItems] = useState<Complaint[]>([])
  const [stats, setStats] = useState<ComplaintStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ComplaintFormState>(emptyForm())
  const [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = () => {
    setLoading(true)
    Promise.all([listComplaints(operationId), complaintStats(operationId)])
      .then(([its, st]) => { setItems(its); setStats(st) })
      .catch(() => setItems([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [operationId])

  function openNew() { setEditingId(null); setForm(emptyForm()); setShowForm(true) }
  function openEdit(c: Complaint) {
    setEditingId(c.id)
    setForm({ target: c.target, platform: c.platform, category: c.category ?? '', ticketId: c.ticketId ?? '', ticketUrl: c.ticketUrl ?? '', status: c.status, priority: c.priority, submittedAt: c.submittedAt ? c.submittedAt.slice(0, 16) : '', notes: c.notes ?? '' })
    setShowForm(true)
  }
  async function save() {
    if (!form.target.trim() || !form.platform.trim()) { showToast('Informe o alvo e a plataforma', 'error'); return }
    setBusy(true)
    const payload = { operationId, target: form.target, platform: form.platform, category: form.category || null, ticketId: form.ticketId || null, ticketUrl: form.ticketUrl || null, status: form.status, priority: form.priority, submittedAt: form.submittedAt || null, notes: form.notes || null }
    try {
      if (editingId) await updateComplaint(editingId, payload)
      else await createComplaint(payload)
      showToast(editingId ? 'Denúncia atualizada' : 'Denúncia registrada', 'success')
      setShowForm(false); setEditingId(null); load()
    } catch { showToast('Falha ao salvar denúncia', 'error') } finally { setBusy(false) }
  }
  async function patch(id: string, data: Partial<Complaint>) {
    setItems(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    try { await updateComplaint(id, data as any); complaintStats(operationId).then(setStats).catch(() => {}) }
    catch { load() }
  }
  function remove(id: string, target: string) {
    requestConfirm({ title: 'Excluir denúncia', message: `Remover a denúncia de "${target}"?`, confirmLabel: 'Excluir', danger: true, onConfirm: async () => { setItems(prev => prev.filter(c => c.id !== id)); await deleteComplaint(id).catch(() => {}); complaintStats(operationId).then(setStats).catch(() => {}) } })
  }

  const shown = statusFilter === 'all' ? items : items.filter(c => c.status === statusFilter)
  const kpis = [
    { label: 'Total', val: stats?.total ?? 0, c: C.txt },
    { label: 'Abertas', val: stats?.open ?? 0, c: '#EF9F27' },
    { label: 'Resolvidas', val: stats?.resolved ?? 0, c: '#1D9E75' },
    { label: 'Rejeitadas', val: stats?.rejected ?? 0, c: '#e24b4a' },
  ]
  const statusCounts = useMemo(() => { const m: Record<string, number> = {}; for (const c of items) m[c.status] = (m[c.status] ?? 0) + 1; return m }, [items])

  return (
    <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KPIs + ação */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {kpis.map(k => (
          <div key={k.label} style={{ flex: 1, minWidth: 120, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10.5, color: C.txt3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.c, marginTop: 2 }}>{k.val}</div>
          </div>
        ))}
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 18px', borderRadius: 10, border: '1px solid var(--accent-blue)', background: 'var(--accent-blue)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Plus size={15} /> Nova denúncia</button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 11, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Flag size={14} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.txt }}>{editingId ? 'Editar denúncia' : 'Nova denúncia'}</span>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.txt3 }}><X size={15} /></button>
          </div>
          <datalist id="platforms">{PLATFORMS.map(p => <option key={p} value={p} />)}</datalist>
          <datalist id="categories">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}><L>Alvo denunciado (URL / domínio / post) *</L><input style={{ ...inp, ...mono }} value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="https://site.com/pagina  ·  @perfil  ·  dominio.com" /></div>
            <div><L>Plataforma / órgão *</L><input list="platforms" style={inp} value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} placeholder="GoDaddy, Cloudflare, NCMEC…" /></div>
            <div><L>Categoria</L><input list="categories" style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Phishing, CSAM, Fraude…" /></div>
            <div><L>ID / Ticket</L><input style={{ ...inp, ...mono }} value={form.ticketId} onChange={e => setForm(f => ({ ...f, ticketId: e.target.value }))} placeholder="#ABUSE-12345" /></div>
            <div><L>URL do ticket</L><input style={{ ...inp, ...mono }} value={form.ticketUrl} onChange={e => setForm(f => ({ ...f, ticketUrl: e.target.value }))} placeholder="https://…" /></div>
            <div><L>Status</L><select style={{ ...inp, cursor: 'pointer' }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ComplaintStatus }))}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div><L>Prioridade</L><select style={{ ...inp, cursor: 'pointer' }} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as ComplaintPriority }))}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div style={{ gridColumn: '1 / -1' }}><L>Enviada em</L><input type="datetime-local" style={{ ...inp, cursor: 'pointer' }} value={form.submittedAt} onChange={e => setForm(f => ({ ...f, submittedAt: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><L>Notas</L><textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Descrição, resposta da plataforma, evidências…" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 7, border: '1px solid var(--accent-blue)', background: 'var(--accent-blue)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />} {editingId ? 'Salvar' : 'Registrar'}</button>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="btn">Cancelar</button>
          </div>
        </div>
      )}

      {/* Filtro por status */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setStatusFilter('all')} style={chip(statusFilter === 'all')}>Todas ({items.length})</button>
        {(Object.keys(STATUS) as ComplaintStatus[]).filter(s => statusCounts[s]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={chip(statusFilter === s, STATUS[s].c)}>{STATUS[s].label} ({statusCounts[s]})</button>
        ))}
      </div>

      {/* Lista */}
      {loading ? <div style={{ textAlign: 'center', padding: '30px 0', color: C.txt3 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /></div>
        : shown.length === 0 ? <div style={{ textAlign: 'center', padding: '40px 0', color: C.txt3, fontSize: 12.5 }}>Nenhuma denúncia {statusFilter === 'all' ? 'registrada. Clique em "Nova denúncia".' : 'com esse status.'}</div>
        : shown.map(c => {
          const st = STATUS[c.status], pr = PRIORITY[c.priority]
          return (
            <div key={c.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${pr.c}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ ...mono, fontSize: 13, color: C.txt, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.target}</span>
                <span style={{ fontSize: 10, color: pr.c, border: `1px solid ${pr.c}55`, background: `${pr.c}1a`, borderRadius: 5, padding: '2px 7px' }}>{pr.label}</span>
                <button onClick={() => openEdit(c)} title="Editar" style={iconBtn(C.txt3)}><Pencil size={13} /></button>
                <button onClick={() => remove(c.id, c.target)} title="Excluir" style={iconBtn('#e24b4a')}><Trash2 size={13} /></button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 11.5, color: C.txt2 }}>
                <span style={{ background: 'rgba(255,255,255,.05)', borderRadius: 5, padding: '2px 8px' }}>{c.platform}</span>
                {c.category && <span style={{ color: C.txt3 }}>· {c.category}</span>}
                {c.ticketId && <span style={{ ...mono, color: C.txt }}>· {c.ticketId}</span>}
                {c.ticketUrl && <a href={c.ticketUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>abrir ticket <ExternalLink size={10} /></a>}
                <span style={{ marginLeft: 'auto', color: C.txt3 }}>enviada {fmt(c.submittedAt)}{c.resolvedAt ? ` · resolvida ${fmt(c.resolvedAt)}` : ''}</span>
              </div>
              {c.notes && <div style={{ fontSize: 12, color: C.txt2, whiteSpace: 'pre-wrap', marginTop: 8, lineHeight: 1.5 }}>{c.notes}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 10.5, color: C.txt3 }}>Status:</span>
                <select value={c.status} onChange={e => patch(c.id, { status: e.target.value as ComplaintStatus })}
                  style={{ height: 26, padding: '0 8px', fontSize: 11, background: `${st.c}1a`, color: st.c, border: `1px solid ${st.c}55`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={c.priority} onChange={e => patch(c.id, { priority: e.target.value as ComplaintPriority })}
                  style={{ height: 26, padding: '0 8px', fontSize: 11, background: 'rgba(255,255,255,.04)', color: C.txt2, border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
          )
        })}
    </div>
  )
}

function L({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 10.5, color: C.txt3, marginBottom: 4 }}>{children}</div> }
function chip(active: boolean, color = 'var(--accent-blue)'): React.CSSProperties {
  return { fontSize: 11.5, cursor: 'pointer', padding: '4px 11px', borderRadius: 7, border: `1px solid ${active ? color : C.border}`, background: active ? `${color}22` : 'transparent', color: active ? C.txt : C.txt2 }
}
function iconBtn(color: string): React.CSSProperties {
  return { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color, cursor: 'pointer', flexShrink: 0 }
}
