import { useEffect, useMemo, useState } from 'react'
import {
  FileText, Clock, Eye, CheckCircle2, XCircle, PieChart, Plus, Search, X, Filter, Download,
  MessageSquare, Pencil, Trash2, ChevronLeft, ChevronRight, Copy, ExternalLink,
  Send, List, LayoutGrid, Loader2, Paperclip,
} from 'lucide-react'
import {
  listComplaints, complaintStats, createComplaint, updateComplaint, deleteComplaint,
  addComplaintNote, addComplaintAttachment,
  type Complaint, type ComplaintStatus, type ComplaintPriority, type ComplaintStats,
} from '@/services/complaints'
import { useUIStore } from '@/store/ui'

const STATUS: Record<ComplaintStatus, { label: string; c: string }> = {
  draft: { label: 'Rascunho', c: '#888' }, submitted: { label: 'Enviada', c: '#378ADD' },
  acknowledged: { label: 'Recebida', c: '#5ad1ff' }, in_review: { label: 'Em análise', c: '#EF9F27' },
  resolved: { label: 'Resolvida', c: '#1D9E75' }, rejected: { label: 'Rejeitada', c: '#e24b4a' },
  closed: { label: 'Encerrada', c: '#7F77DD' },
}
const PRIORITY: Record<ComplaintPriority, { label: string; c: string }> = {
  critical: { label: 'Crítica', c: '#e24b4a' }, high: { label: 'Alta', c: '#EF9F27' },
  medium: { label: 'Média', c: '#378ADD' }, low: { label: 'Baixa', c: '#888' },
}
const PLATFORMS = ['GoDaddy', 'Cloudflare', 'Namecheap', 'Hostinger', 'Google Safe Browsing', 'Meta', 'Instagram', 'X (Twitter)', 'TikTok', 'YouTube', 'Telegram', 'Discord', 'NCMEC / CyberTipline', 'IC3 (FBI)', 'Interpol', 'SaferNet Brasil', 'Polícia Federal', 'Registrar (WHOIS abuse)']
const CATEGORIES = ['CSAM', 'Phishing', 'Malware', 'Fraude', 'Spam', 'Impersonation', 'Direitos autorais', 'Conteúdo ilegal', 'Assédio', 'Outro']
const RESULTS = ['Sem resposta', 'Em avaliação', 'Removido', 'Domínio derrubado', 'Arquivado', 'Recusado']

const C = { txt: 'var(--text-primary)', txt2: 'var(--text-secondary)', txt3: 'var(--text-muted)', border: 'var(--border)', bg: 'var(--bg-surface)', blue: '#378ADD' }
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }
const inp: React.CSSProperties = { padding: '8px 10px', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`, borderRadius: 7, color: C.txt, fontSize: 12.5, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
const fmt = (s?: string | null) => s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtShort = (s?: string | null) => s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

interface FormState { target: string; platform: string; category: string; ticketId: string; ticketUrl: string; status: ComplaintStatus; priority: ComplaintPriority; result: string; submittedAt: string; notes: string }
const emptyForm = (): FormState => ({ target: '', platform: '', category: '', ticketId: '', ticketUrl: '', status: 'submitted', priority: 'medium', result: '', submittedAt: '', notes: '' })

export function ComplaintsTab({ operationId }: { operationId: string }) {
  const { requestConfirm } = useUIStore()
  const [items, setItems] = useState<Complaint[]>([])
  const [stats, setStats] = useState<ComplaintStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selId, setSelId] = useState<string | null>(null)
  const [modal, setModal] = useState<null | 'new' | string>(null) // 'new' ou id (editar)
  // filtros
  const [q, setQ] = useState(''); const [fPlat, setFPlat] = useState(''); const [fCat, setFCat] = useState(''); const [fPrio, setFPrio] = useState(''); const [fStatus, setFStatus] = useState('')
  const [sort, setSort] = useState<'open' | 'recent' | 'priority'>('open')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(1); const perPage = 10

  const load = () => { setLoading(true); Promise.all([listComplaints(operationId), complaintStats(operationId)]).then(([its, st]) => { setItems(its); setStats(st) }).catch(() => setItems([])).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [operationId])
  useEffect(() => { setPage(1) }, [q, fPlat, fCat, fPrio, fStatus, sort])

  const sel = items.find(i => i.id === selId) || null
  const statusCounts = useMemo(() => { const m: Record<string, number> = {}; for (const c of items) m[c.status] = (m[c.status] ?? 0) + 1; return m }, [items])

  const filtered = useMemo(() => {
    let r = items.filter(c => {
      if (fStatus && c.status !== fStatus) return false
      if (fPlat && c.platform !== fPlat) return false
      if (fCat && c.category !== fCat) return false
      if (fPrio && c.priority !== fPrio) return false
      if (q) { const s = q.toLowerCase(); if (![c.target, c.platform, c.ticketId, c.category, c.notes].some(v => (v || '').toLowerCase().includes(s))) return false }
      return true
    })
    if (sort === 'recent') r = [...r].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    else if (sort === 'priority') { const pr = { critical: 0, high: 1, medium: 2, low: 3 }; r = [...r].sort((a, b) => pr[a.priority] - pr[b.priority]) }
    return r
  }, [items, q, fPlat, fCat, fPrio, fStatus, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage)

  async function saveInline(id: string, data: Partial<Complaint>) {
    setItems(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    try { const u = await updateComplaint(id, data as any); setItems(prev => prev.map(c => c.id === id ? u : c)); complaintStats(operationId).then(setStats).catch(() => {}) } catch { load() }
  }
  function remove(id: string, target: string) {
    requestConfirm({ title: 'Excluir denúncia', message: `Remover a denúncia de "${target}"?`, confirmLabel: 'Excluir', danger: true, onConfirm: async () => { setItems(prev => prev.filter(c => c.id !== id)); if (selId === id) setSelId(null); await deleteComplaint(id).catch(() => {}); complaintStats(operationId).then(setStats).catch(() => {}) } })
  }
  function clearFilters() { setQ(''); setFPlat(''); setFCat(''); setFPrio(''); setFStatus('') }
  function exportCsv() {
    const head = ['alvo', 'plataforma', 'categoria', 'ticket', 'status', 'prioridade', 'resultado', 'enviada_em', 'resolvida_em']
    const rows = filtered.map(c => [c.target, c.platform, c.category, c.ticketId, STATUS[c.status].label, PRIORITY[c.priority].label, c.result, c.submittedAt, c.resolvedAt].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[head.join(','), ...rows].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'denuncias.csv'; a.click(); URL.revokeObjectURL(a.href)
  }

  const total = stats?.total ?? 0
  const pct = (v: number) => total ? `${((v / total) * 100).toFixed(1)}% do total` : '0% do total'
  const KPIS = [
    { icon: <FileText size={17} />, bg: 'rgba(55,138,221,.15)', ic: C.blue, label: 'TOTAL', val: total, sub: '100% do total', vc: C.txt },
    { icon: <Clock size={17} />, bg: 'rgba(239,159,39,.15)', ic: '#EF9F27', label: 'ABERTAS', val: stats?.open ?? 0, sub: pct(stats?.open ?? 0), vc: '#EF9F27' },
    { icon: <Eye size={17} />, bg: 'rgba(234,179,8,.15)', ic: '#e0b341', label: 'EM ANÁLISE', val: stats?.inReview ?? 0, sub: pct(stats?.inReview ?? 0), vc: '#e0b341' },
    { icon: <CheckCircle2 size={17} />, bg: 'rgba(29,158,117,.15)', ic: '#1D9E75', label: 'RESOLVIDAS', val: stats?.resolved ?? 0, sub: pct(stats?.resolved ?? 0), vc: '#1D9E75' },
    { icon: <XCircle size={17} />, bg: 'rgba(226,75,74,.15)', ic: '#e24b4a', label: 'REJEITADAS', val: stats?.rejected ?? 0, sub: pct(stats?.rejected ?? 0), vc: '#e24b4a' },
    { icon: <PieChart size={17} />, bg: 'rgba(127,119,221,.15)', ic: '#7F77DD', label: 'TEMPO MÉDIO DE RESOLUÇÃO', val: stats?.avgResolutionDays != null ? `${stats.avgResolutionDays} dias` : '—', sub: 'Desde a criação', vc: C.txt, small: true },
  ]

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* ── MAIN ── */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {KPIS.map(k => (
            <div key={k.label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 11, padding: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: k.bg, color: k.ic, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</span>
                <span style={{ fontSize: 9.5, color: C.txt3, textTransform: 'uppercase', letterSpacing: '.05em', lineHeight: 1.15 }}>{k.label}</span>
              </div>
              <div style={{ fontSize: k.small ? 20 : 24, fontWeight: 700, color: k.vc }}>{k.val}</div>
              <div style={{ fontSize: 10.5, color: C.txt3, marginTop: 1 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: 10, color: C.txt3 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por alvo, plataforma, ticket, domínio ou notas…" style={{ ...inp, paddingLeft: 30 }} />
          </div>
          <Sel label="Plataforma" value={fPlat} onChange={setFPlat} opts={PLATFORMS} allLabel="Todas" />
          <Sel label="Categoria" value={fCat} onChange={setFCat} opts={CATEGORIES} allLabel="Todas" />
          <Sel label="Prioridade" value={fPrio} onChange={setFPrio} opts={Object.entries(PRIORITY).map(([k, v]) => ({ k, v: v.label }))} allLabel="Todas" />
          <Sel label="Status" value={fStatus} onChange={setFStatus} opts={Object.entries(STATUS).map(([k, v]) => ({ k, v: v.label }))} allLabel="Todas" />
          <button className="btn" onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34 }}><Filter size={13} /> Limpar filtros</button>
          <button className="btn" onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34 }}><Download size={13} /> Exportar</button>
        </div>

        {/* Chips + sort + view */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip active={fStatus === ''} onClick={() => setFStatus('')} dot={C.txt3} label="Todas" n={items.length} />
          {(Object.keys(STATUS) as ComplaintStatus[]).map(s => <Chip key={s} active={fStatus === s} onClick={() => setFStatus(s)} dot={STATUS[s].c} label={STATUS[s].label} n={statusCounts[s] ?? 0} />)}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={sort} onChange={e => setSort(e.target.value as any)} style={{ ...inp, width: 'auto', cursor: 'pointer', fontSize: 11.5 }}>
              <option value="open">Ordenar: Abertas primeiro</option>
              <option value="recent">Ordenar: Mais recentes</option>
              <option value="priority">Ordenar: Prioridade</option>
            </select>
            <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 7, overflow: 'hidden' }}>
              {(['list', 'grid'] as const).map(v => <button key={v} onClick={() => setView(v)} style={{ padding: '6px 9px', background: view === v ? 'rgba(55,138,221,.2)' : 'transparent', border: 'none', cursor: 'pointer', color: view === v ? C.txt : C.txt3, display: 'flex' }}>{v === 'list' ? <List size={14} /> : <LayoutGrid size={14} />}</button>)}
            </div>
          </div>
        </div>

        {/* Lista */}
        {loading ? <div style={{ padding: '40px 0', textAlign: 'center', color: C.txt3 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /></div>
          : filtered.length === 0 ? <div style={{ padding: '48px 0', textAlign: 'center', color: C.txt3, fontSize: 12.5 }}>Nenhuma denúncia {items.length ? 'com esses filtros.' : '— clique em "Nova denúncia".'}</div>
          : view === 'grid'
            ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 10 }}>{pageItems.map(c => <GridCard key={c.id} c={c} onSelect={() => setSelId(c.id)} onEdit={() => setModal(c.id)} onDel={() => remove(c.id, c.target)} selected={selId === c.id} onStatus={(s) => saveInline(c.id, { status: s })} />)}</div>
            : <div style={{ display: 'flex', flexDirection: 'column' }}>{pageItems.map(c => <Row key={c.id} c={c} onSelect={() => setSelId(c.id)} onEdit={() => setModal(c.id)} onDel={() => remove(c.id, c.target)} selected={selId === c.id} onStatus={(s) => saveInline(c.id, { status: s })} />)}</div>}

        {/* Paginação */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, fontSize: 12, color: C.txt2 }}>
            <span>Mostrando {(page - 1) * perPage + 1} a {Math.min(page * perPage, filtered.length)} de {filtered.length} denúncias</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '5px 8px' }}><ChevronLeft size={14} /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 6).map(n => <button key={n} onClick={() => setPage(n)} style={{ width: 30, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: page === n ? 'rgba(55,138,221,.25)' : 'transparent', color: page === n ? C.txt : C.txt2, cursor: 'pointer', fontSize: 12 }}>{n}</button>)}
              <button className="btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ padding: '5px 8px' }}><ChevronRight size={14} /></button>
            </div>
            <span style={{ color: C.txt3 }}>{perPage} por página</span>
          </div>
        )}
      </div>

      {/* ── PAINEL DIREITO ── */}
      <div style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setModal('new')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px', borderRadius: 8, border: `1px solid ${C.blue}`, background: C.blue, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}><Plus size={14} /> Nova denúncia</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {sel ? <DetailPanel c={sel} onClose={() => setSelId(null)} onRefresh={(u) => { setItems(prev => prev.map(x => x.id === u.id ? u : x)) }} /> : <div style={{ padding: '40px 16px', textAlign: 'center', color: C.txt3, fontSize: 12.5 }}>Selecione uma denúncia para ver os detalhes, a linha do tempo, notas e anexos.</div>}
        </div>
      </div>

      {modal && <ComplaintModal operationId={operationId} editing={modal === 'new' ? null : items.find(i => i.id === modal) || null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}

// ── sub-componentes ──────────────────────────────────────────────────────────
function Sel({ label, value, onChange, opts, allLabel }: { label: string; value: string; onChange: (v: string) => void; opts: (string | { k: string; v: string })[]; allLabel: string }) {
  return (
    <div style={{ minWidth: 130 }}>
      <div style={{ fontSize: 10, color: C.txt3, marginBottom: 3 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
        <option value="">{allLabel}</option>
        {opts.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.k} value={o.k}>{o.v}</option>)}
      </select>
    </div>
  )
}
function Chip({ active, onClick, dot, label, n }: { active: boolean; onClick: () => void; dot: string; label: string; n: number }) {
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, padding: '5px 11px', borderRadius: 8, border: `1px solid ${active ? dot : C.border}`, background: active ? `${dot}22` : 'transparent', color: active ? C.txt : C.txt2, cursor: 'pointer' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />{label} <b style={{ color: C.txt3 }}>{n}</b></button>
}
function PlatformIcon({ platform }: { platform: string }) {
  const letter = (platform || '?').trim()[0]?.toUpperCase() ?? '?'
  return <span style={{ width: 18, height: 18, borderRadius: 5, background: 'rgba(255,255,255,.07)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, color: C.txt2, flexShrink: 0 }}>{letter}</span>
}
function StatusSelect({ c, onStatus }: { c: Complaint; onStatus: (s: ComplaintStatus) => void }) {
  const st = STATUS[c.status]
  return <select value={c.status} onClick={e => e.stopPropagation()} onChange={e => onStatus(e.target.value as ComplaintStatus)} style={{ height: 30, padding: '0 8px', fontSize: 11.5, background: `${st.c}1a`, color: st.c, border: `1px solid ${st.c}55`, borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
}
function iconBtn(color: string): React.CSSProperties { return { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color, cursor: 'pointer', flexShrink: 0 } }

function Row({ c, onSelect, onEdit, onDel, selected, onStatus }: { c: Complaint; onSelect: () => void; onEdit: () => void; onDel: () => void; selected: boolean; onStatus: (s: ComplaintStatus) => void }) {
  const pr = PRIORITY[c.priority]
  const resultDone = /removido|derrubado|arquivado/i.test(c.result || '')
  return (
    <div onClick={onSelect} style={{ display: 'grid', gridTemplateColumns: '84px 1.4fr 150px 150px 130px 1fr 40px 64px', gap: 10, alignItems: 'center', padding: '12px 6px', borderBottom: `1px solid ${C.border}`, borderLeft: `3px solid ${pr.c}`, cursor: 'pointer', background: selected ? 'rgba(55,138,221,.06)' : 'transparent' }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: pr.c, border: `1px solid ${pr.c}55`, background: `${pr.c}1a`, borderRadius: 5, padding: '2px 8px', justifySelf: 'start' }}>{pr.label}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...mono, fontSize: 12.5, color: C.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.target}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.txt3, marginTop: 3 }}><PlatformIcon platform={c.platform} /> {c.platform}{c.category ? <> · {c.category}</> : null}</div>
      </div>
      <div style={{ minWidth: 0 }}>{c.ticketId ? <><div style={{ ...mono, fontSize: 11.5, color: C.txt2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.ticketId}</div><div style={{ fontSize: 10, color: C.txt3 }}>Ticket</div></> : <span style={{ color: C.txt3 }}>—</span>}</div>
      <div><div style={{ fontSize: 11.5, color: C.txt2 }}>{fmtShort(c.submittedAt)}</div><div style={{ fontSize: 10, color: C.txt3 }}>Enviada</div></div>
      <div onClick={e => e.stopPropagation()}><StatusSelect c={c} onStatus={onStatus} /></div>
      <div style={{ fontSize: 11.5, color: resultDone ? '#1D9E75' : C.txt3, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>{resultDone && <CheckCircle2 size={12} />}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.result || '—'}</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.txt3, fontSize: 11.5 }}><MessageSquare size={13} /> {c.data?.notes?.length ?? 0}</div>
      <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
        <button onClick={onEdit} title="Editar" style={iconBtn(C.txt3)}><Pencil size={12} /></button>
        <button onClick={onDel} title="Excluir" style={iconBtn('#e24b4a')}><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

function GridCard({ c, onSelect, onEdit, onDel, selected, onStatus }: { c: Complaint; onSelect: () => void; onEdit: () => void; onDel: () => void; selected: boolean; onStatus: (s: ComplaintStatus) => void }) {
  const pr = PRIORITY[c.priority]
  return (
    <div onClick={onSelect} style={{ background: C.bg, border: `1px solid ${selected ? C.blue : C.border}`, borderLeft: `3px solid ${pr.c}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: pr.c, border: `1px solid ${pr.c}55`, background: `${pr.c}1a`, borderRadius: 5, padding: '1px 7px' }}>{pr.label}</span>
        <span style={{ ...mono, fontSize: 12, color: C.txt, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.target}</span>
        <button onClick={e => { e.stopPropagation(); onEdit() }} style={iconBtn(C.txt3)}><Pencil size={11} /></button>
        <button onClick={e => { e.stopPropagation(); onDel() }} style={iconBtn('#e24b4a')}><Trash2 size={11} /></button>
      </div>
      <div style={{ fontSize: 11, color: C.txt3, marginBottom: 8 }}><PlatformIcon platform={c.platform} /> {c.platform}{c.category ? ` · ${c.category}` : ''}{c.ticketId ? ` · ${c.ticketId}` : ''}</div>
      <div onClick={e => e.stopPropagation()}><StatusSelect c={c} onStatus={onStatus} /></div>
    </div>
  )
}

function DetailPanel({ c, onClose, onRefresh }: { c: Complaint; onClose: () => void; onRefresh: (u: Complaint) => void }) {
  const { showToast } = useUIStore()
  const [tab, setTab] = useState<'timeline' | 'notes' | 'files'>('timeline')
  const [noteText, setNoteText] = useState(''); const [atName, setAtName] = useState(''); const [atUrl, setAtUrl] = useState('')
  const st = STATUS[c.status], pr = PRIORITY[c.priority]
  const events = c.data?.events ?? [], notes = c.data?.notes ?? [], files = c.data?.attachments ?? []
  const evIcon = (t: string) => t === 'created' ? <Plus size={12} /> : t.startsWith('status:submitted') ? <Send size={12} /> : t.includes('resolved') || t.includes('closed') ? <CheckCircle2 size={12} /> : t.includes('rejected') ? <XCircle size={12} /> : t.includes('acknowledged') || t.includes('in_review') ? <Eye size={12} /> : t === 'manual' ? <MessageSquare size={12} /> : <Clock size={12} />

  async function addNote() { if (!noteText.trim()) return; try { const u = await addComplaintNote(c.id, noteText.trim()); setNoteText(''); onRefresh(u) } catch { showToast('Falha', 'error') } }
  async function addFile() { if (!atName.trim()) return; try { const u = await addComplaintAttachment(c.id, atName.trim(), atUrl.trim() || undefined); setAtName(''); setAtUrl(''); onRefresh(u) } catch { showToast('Falha', 'error') } }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 15, fontWeight: 700, color: C.txt, ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || c.target}</span><span style={{ fontSize: 10, color: pr.c, border: `1px solid ${pr.c}55`, background: `${pr.c}1a`, borderRadius: 5, padding: '1px 7px', flexShrink: 0 }}>{pr.label}</span></div>
        </div>
        <X size={16} style={{ cursor: 'pointer', color: C.txt3, flexShrink: 0 }} onClick={onClose} />
      </div>
      <div style={{ fontSize: 12, color: C.txt2, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><PlatformIcon platform={c.platform} /> {c.platform}{c.category ? ` · ${c.category}` : ''}</div>
      {c.ticketId && <div style={{ fontSize: 12, color: C.txt2, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>Ticket: <span style={{ ...mono, color: C.txt }}>{c.ticketId}</span><Copy size={12} style={{ cursor: 'pointer', color: C.txt3 }} onClick={() => { navigator.clipboard.writeText(c.ticketId!); showToast('Copiado', 'success') }} /></div>}
      {c.ticketUrl && <a href={c.ticketUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: C.blue, ...mono, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, wordBreak: 'break-all' }}>{c.ticketUrl} <ExternalLink size={11} /></a>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px', marginTop: 14, fontSize: 12 }}>
        <KV k="Status" v={<span style={{ color: st.c, border: `1px solid ${st.c}55`, background: `${st.c}1a`, borderRadius: 5, padding: '1px 8px', fontSize: 11 }}>{st.label}</span>} />
        <KV k="Prioridade" v={<span style={{ color: pr.c }}>{pr.label}</span>} />
        <KV k="Enviada em" v={fmt(c.submittedAt)} />
        <KV k="Categoria" v={c.category || '—'} />
        <KV k="Resultado" v={c.result || 'Sem resposta'} />
        <KV k="Resolvida em" v={fmt(c.resolvedAt)} />
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', gap: 4, marginTop: 16, borderBottom: `1px solid ${C.border}` }}>
        {([['timeline', 'Linha do tempo', events.length], ['notes', 'Notas', notes.length], ['files', 'Anexos', files.length]] as const).map(([k, label, n]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 10px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === k ? C.blue : 'transparent'}`, color: tab === k ? C.txt : C.txt3, cursor: 'pointer', fontSize: 12 }}>{label}{n ? ` ${n}` : ''}</button>
        ))}
      </div>

      {tab === 'timeline' && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {events.length === 0 ? <div style={{ fontSize: 12, color: C.txt3, padding: '12px 0' }}>Sem eventos.</div> : [...events].reverse().map((e, i) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, paddingBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,.06)', color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{evIcon(e.type)}</span>
                {i < events.length - 1 && <span style={{ width: 1, flex: 1, minHeight: 12, background: C.border, marginTop: 2 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: C.txt3 }}>{fmt(e.at)}</div>
                <div style={{ fontSize: 12.5, color: C.txt, fontWeight: 500 }}>{e.title}</div>
                {e.description && <div style={{ fontSize: 11.5, color: C.txt2 }}>{e.description}</div>}
                {e.author && <div style={{ fontSize: 11, color: C.txt3 }}>{e.author}</div>}
                {e.meta && <div style={{ fontSize: 11, color: C.txt2, ...mono, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', marginTop: 4 }}>{e.meta}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'notes' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="Adicionar nota…" style={inp} />
            <button className="btn" onClick={addNote}><Plus size={13} /></button>
          </div>
          {notes.length === 0 ? <div style={{ fontSize: 12, color: C.txt3 }}>Sem notas.</div> : [...notes].reverse().map(n => <div key={n.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}><div style={{ fontSize: 12, color: C.txt, whiteSpace: 'pre-wrap' }}>{n.text}</div><div style={{ fontSize: 10.5, color: C.txt3, marginTop: 2 }}>{n.author ? `${n.author} · ` : ''}{fmt(n.at)}</div></div>)}
        </div>
      )}
      {tab === 'files' && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}><input value={atName} onChange={e => setAtName(e.target.value)} placeholder="Nome do anexo" style={inp} /></div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}><input value={atUrl} onChange={e => setAtUrl(e.target.value)} placeholder="URL (opcional)" style={{ ...inp, ...mono }} /><button className="btn" onClick={addFile}><Plus size={13} /></button></div>
          {files.length === 0 ? <div style={{ fontSize: 12, color: C.txt3 }}>Sem anexos.</div> : files.map(f => <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}><Paperclip size={13} style={{ color: C.txt3 }} />{f.url ? <a href={f.url} target="_blank" rel="noreferrer" style={{ color: C.blue, flex: 1 }}>{f.name}</a> : <span style={{ flex: 1, color: C.txt }}>{f.name}</span>}<span style={{ fontSize: 10.5, color: C.txt3 }}>{fmtShort(f.at)}</span></div>)}
        </div>
      )}
    </div>
  )
}
function KV({ k, v }: { k: string; v: React.ReactNode }) { return <div><div style={{ fontSize: 10, color: C.txt3 }}>{k}</div><div style={{ color: C.txt, marginTop: 2 }}>{v}</div></div> }

// ── modal criar/editar ─────────────────────────────────────────────────────────
function ComplaintModal({ operationId, editing, onClose, onSaved }: { operationId: string; editing: Complaint | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useUIStore()
  const [f, setF] = useState<FormState>(() => editing ? { target: editing.target, platform: editing.platform, category: editing.category ?? '', ticketId: editing.ticketId ?? '', ticketUrl: editing.ticketUrl ?? '', status: editing.status, priority: editing.priority, result: editing.result ?? '', submittedAt: editing.submittedAt ? editing.submittedAt.slice(0, 16) : '', notes: editing.notes ?? '' } : emptyForm())
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!f.target.trim() || !f.platform.trim()) { showToast('Informe o alvo e a plataforma', 'error'); return }
    setBusy(true)
    const fields = { target: f.target, platform: f.platform, category: f.category || null, ticketId: f.ticketId || null, ticketUrl: f.ticketUrl || null, status: f.status, priority: f.priority, result: f.result || null, submittedAt: f.submittedAt || null, notes: f.notes || null }
    try { if (editing) await updateComplaint(editing.id, fields); else await createComplaint({ operationId, ...fields }); showToast(editing ? 'Denúncia atualizada' : 'Denúncia registrada', 'success'); onSaved() }
    catch { showToast('Falha ao salvar', 'error') } finally { setBusy(false) }
  }
  const set = (k: keyof FormState, v: string) => setF(s => ({ ...s, [k]: v }))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 620, maxWidth: '94vw', maxHeight: '90vh', overflow: 'auto', background: 'var(--bg-elevated)', border: `1px solid var(--border-hover)`, borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 14, fontWeight: 600, color: C.txt }}>{editing ? 'Editar denúncia' : 'Nova denúncia'}</span><X size={16} style={{ marginLeft: 'auto', cursor: 'pointer', color: C.txt3 }} onClick={onClose} /></div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <datalist id="mplat">{PLATFORMS.map(p => <option key={p} value={p} />)}</datalist>
          <datalist id="mcat">{CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
          <datalist id="mres">{RESULTS.map(r => <option key={r} value={r} />)}</datalist>
          <div style={{ gridColumn: '1 / -1' }}><L>Alvo denunciado *</L><input style={{ ...inp, ...mono }} value={f.target} onChange={e => set('target', e.target.value)} placeholder="https://site.com/pagina · @perfil · dominio.com" /></div>
          <div><L>Plataforma / órgão *</L><input list="mplat" style={inp} value={f.platform} onChange={e => set('platform', e.target.value)} /></div>
          <div><L>Categoria</L><input list="mcat" style={inp} value={f.category} onChange={e => set('category', e.target.value)} /></div>
          <div><L>ID / Ticket</L><input style={{ ...inp, ...mono }} value={f.ticketId} onChange={e => set('ticketId', e.target.value)} /></div>
          <div><L>URL do ticket</L><input style={{ ...inp, ...mono }} value={f.ticketUrl} onChange={e => set('ticketUrl', e.target.value)} /></div>
          <div><L>Status</L><select style={{ ...inp, cursor: 'pointer' }} value={f.status} onChange={e => set('status', e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><L>Prioridade</L><select style={{ ...inp, cursor: 'pointer' }} value={f.priority} onChange={e => set('priority', e.target.value)}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div><L>Resultado</L><input list="mres" style={inp} value={f.result} onChange={e => set('result', e.target.value)} placeholder="Sem resposta, Removido…" /></div>
          <div><L>Enviada em</L><input type="datetime-local" style={{ ...inp, cursor: 'pointer' }} value={f.submittedAt} onChange={e => set('submittedAt', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><L>Notas</L><textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 16px' }}>
          <button onClick={save} disabled={busy} style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6, padding: '10px', borderRadius: 8, border: `1px solid ${C.blue}`, background: C.blue, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />} {editing ? 'Salvar' : 'Registrar'}</button>
          <button onClick={onClose} className="btn">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
function L({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 10, color: C.txt3, marginBottom: 3 }}>{children}</div> }
