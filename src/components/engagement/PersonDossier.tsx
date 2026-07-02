import { useEffect, useRef, useState } from 'react'
import {
  User, Plus, Trash2, ChevronDown, ChevronRight, Loader2, Download, Camera, Check,
} from 'lucide-react'
import type { Engagement } from '@/types'
import { listPersons, getPerson, createPerson, updatePerson, deletePerson, type Person } from '@/services/persons'
import { useUIStore } from '@/store/ui'

const C = { txt: 'var(--text-primary)', txt2: 'var(--text-secondary)', txt3: 'var(--text-muted)', border: 'var(--border)', bg: 'var(--bg-surface)', accent: '#7F77DD', blue: '#378ADD' }
const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" }
const inp: React.CSSProperties = { padding: '7px 9px', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`, borderRadius: 6, color: C.txt, fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%' }

type Field = { k: string; label: string; type?: 'text' | 'date' | 'select'; opts?: string[] }
type Section =
  | { key: string; title: string; kind: 'fields' | 'textareas'; fields: Field[] }
  | { key: string; title: string; kind: 'list'; columns: Field[] }

// Estrutura do dossiê (todas as seções) ------------------------------------------
const SECTIONS: Section[] = [
  { key: 'identidade', title: 'Identificação', kind: 'fields', fields: [
    { k: 'aliases', label: 'Apelidos / vulgos' }, { k: 'nacionalidade', label: 'Nacionalidade' },
    { k: 'naturalidade', label: 'Naturalidade' }, { k: 'estadoCivil', label: 'Estado civil' },
    { k: 'filiacaoMae', label: 'Filiação — mãe' }, { k: 'filiacaoPai', label: 'Filiação — pai' },
  ] },
  { key: 'contatos', title: 'Contatos', kind: 'list', columns: [
    { k: 'tipo', label: 'Tipo', type: 'select', opts: ['Telefone', 'E-mail', 'Profissional', 'Caixa postal'] },
    { k: 'valor', label: 'Valor' }, { k: 'obs', label: 'Observação' },
  ] },
  { key: 'enderecos', title: 'Endereços & histórico residencial', kind: 'list', columns: [
    { k: 'tipo', label: 'Tipo', type: 'select', opts: ['Atual', 'Anterior'] }, { k: 'endereco', label: 'Endereço' },
    { k: 'de', label: 'De' }, { k: 'ate', label: 'Até' }, { k: 'imovel', label: 'Imóvel vinculado' },
  ] },
  { key: 'documentos', title: 'Documentação', kind: 'list', columns: [
    { k: 'tipo', label: 'Tipo', type: 'select', opts: ['CNH', 'Passaporte', 'Título de eleitor', 'Certificado profissional', 'Conselho (OAB/CRM/CREA…)'] },
    { k: 'numero', label: 'Número' }, { k: 'orgao', label: 'Órgão/UF' }, { k: 'validade', label: 'Validade' },
  ] },
  { key: 'profissional', title: 'Histórico profissional', kind: 'list', columns: [
    { k: 'empresa', label: 'Empresa' }, { k: 'cnpj', label: 'CNPJ' }, { k: 'cargo', label: 'Cargo' },
    { k: 'de', label: 'De' }, { k: 'ate', label: 'Até' }, { k: 'salario', label: 'Salário' }, { k: 'papel', label: 'Sócio/Admin?' },
  ] },
  { key: 'formacao', title: 'Formação acadêmica', kind: 'list', columns: [
    { k: 'instituicao', label: 'Instituição' }, { k: 'curso', label: 'Curso' },
    { k: 'nivel', label: 'Nível', type: 'select', opts: ['Ensino médio', 'Graduação', 'Pós', 'Mestrado', 'Doutorado', 'Curso', 'Certificação'] },
    { k: 'de', label: 'De' }, { k: 'ate', label: 'Até' },
  ] },
  { key: 'idiomas', title: 'Idiomas', kind: 'list', columns: [{ k: 'idioma', label: 'Idioma' }, { k: 'nivel', label: 'Nível' }] },
  { key: 'empresas', title: 'Empresas vinculadas', kind: 'list', columns: [
    { k: 'nome', label: 'Empresa' }, { k: 'cnpj', label: 'CNPJ' },
    { k: 'status', label: 'Status', type: 'select', opts: ['Aberta', 'Encerrada', 'Suspensa'] },
    { k: 'cotas', label: 'Quotas/%' }, { k: 'papel', label: 'Papel' },
  ] },
  { key: 'patrimonio', title: 'Patrimônio', kind: 'list', columns: [
    { k: 'tipo', label: 'Tipo', type: 'select', opts: ['Imóvel', 'Veículo', 'Embarcação', 'Aeronave', 'Participação empresarial'] },
    { k: 'descricao', label: 'Descrição' }, { k: 'valor', label: 'Valor' }, { k: 'obs', label: 'Observação' },
  ] },
  { key: 'veiculos', title: 'Veículos', kind: 'list', columns: [
    { k: 'placa', label: 'Placa' }, { k: 'modelo', label: 'Modelo' }, { k: 'ano', label: 'Ano' },
    { k: 'restricao', label: 'Restrição' }, { k: 'alienacao', label: 'Alienação' },
  ] },
  { key: 'digital', title: 'Presença digital (OSINT)', kind: 'list', columns: [
    { k: 'plataforma', label: 'Plataforma' }, { k: 'url', label: 'URL' }, { k: 'usuario', label: 'Usuário' },
  ] },
  { key: 'tecnica', title: 'Presença técnica', kind: 'fields', fields: [
    { k: 'github', label: 'GitHub' }, { k: 'gitlab', label: 'GitLab' }, { k: 'stackoverflow', label: 'Stack Overflow' },
    { k: 'hackerone', label: 'HackerOne' }, { k: 'bugcrowd', label: 'Bugcrowd' }, { k: 'linkedin', label: 'LinkedIn' },
  ] },
  { key: 'tecnicaItens', title: 'Itens técnicos (CVEs, domínios, certs)', kind: 'list', columns: [
    { k: 'tipo', label: 'Tipo', type: 'select', opts: ['CVE', 'Domínio', 'Certificação', 'Repositório', 'Outro'] }, { k: 'valor', label: 'Valor' },
  ] },
  { key: 'osint', title: 'Inteligência em fontes abertas', kind: 'list', columns: [
    { k: 'tipo', label: 'Tipo', type: 'select', opts: ['Username reutilizado', 'Avatar', 'Fórum', 'Breach público', 'DNS relacionado', 'WHOIS histórico', 'Metadado', 'Busca'] },
    { k: 'valor', label: 'Valor' }, { k: 'obs', label: 'Observação' },
  ] },
  { key: 'judicial', title: 'Histórico judicial', kind: 'list', columns: [
    { k: 'tipo', label: 'Tipo', type: 'select', opts: ['Cível', 'Criminal', 'Trabalhista', 'Tributário', 'Execução', 'Falência', 'Recuperação judicial'] },
    { k: 'numero', label: 'Nº processo' }, { k: 'tribunal', label: 'Vara/Tribunal' }, { k: 'status', label: 'Status' }, { k: 'resumo', label: 'Resumo' },
  ] },
  { key: 'administrativo', title: 'Antecedentes administrativos', kind: 'list', columns: [
    { k: 'tipo', label: 'Tipo', type: 'select', opts: ['Sanção', 'Licitação', 'Contrato público', 'Penalidade'] },
    { k: 'orgao', label: 'Órgão' }, { k: 'resumo', label: 'Resumo' }, { k: 'data', label: 'Data' },
  ] },
  { key: 'financeiro', title: 'Situação financeira', kind: 'list', columns: [
    { k: 'tipo', label: 'Tipo', type: 'select', opts: ['Protesto', 'Insolvência', 'Dívida pública', 'Execução fiscal', 'Recuperação judicial'] },
    { k: 'valor', label: 'Valor' }, { k: 'resumo', label: 'Resumo' },
  ] },
  { key: 'relacionamentos', title: 'Relacionamentos', kind: 'list', columns: [
    { k: 'nome', label: 'Nome' }, { k: 'relacao', label: 'Relação', type: 'select', opts: ['Familiar', 'Sócio', 'Associado', 'Organização'] },
    { k: 'empresa', label: 'Empresa/Org' }, { k: 'obs', label: 'Observação' },
  ] },
  { key: 'timeline', title: 'Linha do tempo', kind: 'list', columns: [{ k: 'ano', label: 'Ano' }, { k: 'evento', label: 'Evento' }] },
  { key: 'midia', title: 'Mídia & imprensa', kind: 'list', columns: [
    { k: 'titulo', label: 'Título' }, { k: 'url', label: 'URL' }, { k: 'fonte', label: 'Fonte' }, { k: 'data', label: 'Data' },
  ] },
  { key: 'comportamental', title: 'Análise comportamental (só fontes públicas)', kind: 'textareas', fields: [
    { k: 'interesses', label: 'Interesses demonstrados' }, { k: 'areas', label: 'Áreas de atuação' },
    { k: 'atividade', label: 'Frequência de atividade pública' }, { k: 'idiomas', label: 'Idiomas utilizados' }, { k: 'localizacoes', label: 'Localizações mencionadas' },
  ] },
  { key: 'resumo', title: 'Resumo executivo', kind: 'textareas', fields: [
    { k: 'identificacao', label: 'Identificação principal' }, { k: 'ocupacao', label: 'Ocupação' },
    { k: 'empresas', label: 'Empresas relacionadas' }, { k: 'vinculos', label: 'Principais vínculos' },
    { k: 'processos', label: 'Principais processos' }, { k: 'riscos', label: 'Riscos identificados' }, { k: 'fontes', label: 'Fontes consultadas' },
  ] },
]

function ageFrom(d?: string): number | null {
  if (!d) return null
  const b = new Date(d); if (isNaN(+b)) return null
  const now = new Date(); let a = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth(); if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
  return a >= 0 && a < 130 ? a : null
}
function resizeImage(file: File, max = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const cv = document.createElement('canvas'); cv.width = img.width * scale; cv.height = img.height * scale
        cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
        resolve(cv.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject; img.src = String(r.result)
    }
    r.onerror = reject; r.readAsDataURL(file)
  })
}

export function PersonDossier({ engagement }: { engagement: Engagement }) {
  const { showToast, requestConfirm } = useUIStore()
  const [list, setList] = useState<Person[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [person, setPerson] = useState<Person | null>(null)
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [core, setCore] = useState<any>({})
  const [data, setData] = useState<any>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set(['identidade', 'contatos', 'resumo']))
  const fileRef = useRef<HTMLInputElement>(null)

  const loadList = () => listPersons(engagement.operationId, engagement.id).then(setList).catch(() => setList([]))
  useEffect(() => { loadList() }, [engagement.id])

  async function open(id: string) {
    setSel(id)
    const p = await getPerson(id).catch(() => null)
    if (!p) return
    setPerson(p); setName(p.name); setPhoto(p.photo); setCore(p.data?.core ?? {}); setData(p.data ?? {}); setDirty(false)
  }
  async function novo() {
    const p = await createPerson({ operationId: engagement.operationId, engagementId: engagement.id, name: 'Nova pessoa', data: {} }).catch(() => null)
    if (p) { setList(l => [p, ...l]); open(p.id) }
  }
  async function remove(id: string) {
    requestConfirm({ title: 'Excluir pessoa', message: 'Apagar esta ficha e todos os dados?', confirmLabel: 'Excluir', danger: true, onConfirm: async () => {
      await deletePerson(id).catch(() => {}); setList(l => l.filter(p => p.id !== id)); if (sel === id) { setSel(null); setPerson(null) }
    } })
  }

  // autosave (debounce)
  useEffect(() => {
    if (!dirty || !sel) return
    const t = setTimeout(async () => {
      setSaving(true)
      const merged = { ...data, core }
      try { const p = await updatePerson(sel, { name, photo, data: merged }); setDirty(false); setList(l => l.map(x => x.id === sel ? { ...x, name, photo, updatedAt: p.updatedAt } : x)) }
      catch { showToast('Falha ao salvar', 'error') } finally { setSaving(false) }
    }, 1000)
    return () => clearTimeout(t)
  }, [dirty, name, photo, core, data, sel])

  const edit = (fn: () => void) => { fn(); setDirty(true) }
  const setCoreK = (k: string, v: string) => edit(() => setCore((c: any) => ({ ...c, [k]: v })))
  const setFieldK = (sk: string, k: string, v: string) => edit(() => setData((d: any) => ({ ...d, [sk]: { ...(d[sk] ?? {}), [k]: v } })))
  const listAdd = (k: string) => edit(() => setData((d: any) => ({ ...d, [k]: [...(d[k] ?? []), {}] })))
  const listSet = (k: string, i: number, col: string, v: string) => edit(() => setData((d: any) => ({ ...d, [k]: (d[k] ?? []).map((r: any, ix: number) => ix === i ? { ...r, [col]: v } : r) })))
  const listDel = (k: string, i: number) => edit(() => setData((d: any) => ({ ...d, [k]: (d[k] ?? []).filter((_: any, ix: number) => ix !== i) })))

  async function onPhoto(f?: File | null) { if (!f) return; try { setPhoto(await resizeImage(f)); setDirty(true) } catch { showToast('Falha na imagem', 'error') } }

  const age = ageFrom(core.nascimento)

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', background: 'var(--bg-base)' }}>
      {/* lista de pessoas */}
      <div style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${C.border}` }}>
          <button onClick={novo} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 7, border: `1px solid ${C.accent}`, background: C.accent, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><Plus size={13} /> Nova pessoa</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {list.length === 0 && <div style={{ fontSize: 11.5, color: C.txt3, textAlign: 'center', padding: '20px 0' }}>Nenhuma pessoa.</div>}
          {list.map(p => (
            <button key={p.id} onClick={() => open(p.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7, marginBottom: 3, border: 'none', cursor: 'pointer', textAlign: 'left', background: sel === p.id ? 'rgba(127,119,221,.15)' : 'transparent' }}>
              {p.photo ? <img src={p.photo} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={15} style={{ color: C.txt3 }} /></div>}
              <span style={{ fontSize: 12.5, color: sel === p.id ? C.txt : C.txt2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* editor */}
      {!person ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.txt3, fontSize: 13 }}>Selecione ou crie uma pessoa para montar a ficha.</div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14, color: C.txt }}>
          {/* header */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onPhoto(e.target.files?.[0])} />
              <div onClick={() => fileRef.current?.click()} style={{ width: 96, height: 96, borderRadius: 12, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={22} style={{ color: C.txt3 }} />}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input value={name} onChange={e => edit(() => setName(e.target.value))} placeholder="Nome completo" style={{ ...inp, fontSize: 18, fontWeight: 700, padding: '6px 8px', marginBottom: 8 }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <div><L>CPF</L><input style={{ ...inp, ...mono }} value={core.cpf ?? ''} onChange={e => setCoreK('cpf', e.target.value)} placeholder="000.000.000-00" /></div>
                <div><L>RG</L><input style={{ ...inp, ...mono }} value={core.rg ?? ''} onChange={e => setCoreK('rg', e.target.value)} /></div>
                <div><L>Nascimento{age != null ? ` · ${age} anos` : ''}</L><input type="date" style={{ ...inp, cursor: 'pointer' }} value={core.nascimento ?? ''} onChange={e => setCoreK('nascimento', e.target.value)} /></div>
                <div><L>Sexo</L><select style={{ ...inp, cursor: 'pointer' }} value={core.sexo ?? ''} onChange={e => setCoreK('sexo', e.target.value)}><option value="">—</option><option>Masculino</option><option>Feminino</option><option>Outro</option></select></div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 10.5, color: saving ? C.blue : C.txt3, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>{saving ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> salvando</> : dirty ? 'não salvo' : <><Check size={11} /> salvo</>}</span>
              <button onClick={() => exportPdf({ name, photo, core, data, age })} className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}><Download size={13} /> Exportar PDF</button>
              <button onClick={() => remove(person.id)} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}><Trash2 size={13} /> Excluir</button>
            </div>
          </div>

          {/* seções */}
          {SECTIONS.map(sec => {
            const open = openSecs.has(sec.key)
            const count = sec.kind === 'list' ? (data[sec.key]?.length ?? 0) : undefined
            return (
              <div key={sec.key} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                <div onClick={() => setOpenSecs(s => { const n = new Set(s); n.has(sec.key) ? n.delete(sec.key) : n.add(sec.key); return n })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', cursor: 'pointer' }}>
                  {open ? <ChevronDown size={14} style={{ color: C.txt3 }} /> : <ChevronRight size={14} style={{ color: C.txt3 }} />}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{sec.title}</span>
                  {count != null && count > 0 && <span style={{ fontSize: 10.5, color: C.txt3 }}>({count})</span>}
                </div>
                {open && (
                  <div style={{ padding: '0 14px 14px' }}>
                    {sec.kind === 'fields' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {sec.fields.map(f => <div key={f.k}><L>{f.label}</L><input style={inp} value={data[sec.key]?.[f.k] ?? ''} onChange={e => setFieldK(sec.key, f.k, e.target.value)} /></div>)}
                      </div>
                    )}
                    {sec.kind === 'textareas' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {sec.fields.map(f => <div key={f.k}><L>{f.label}</L><textarea style={{ ...inp, minHeight: 52, resize: 'vertical' }} value={data[sec.key]?.[f.k] ?? ''} onChange={e => setFieldK(sec.key, f.k, e.target.value)} /></div>)}
                      </div>
                    )}
                    {sec.kind === 'list' && (
                      <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {(data[sec.key] ?? []).map((row: any, i: number) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: `${sec.columns.map(() => '1fr').join(' ')} 26px`, gap: 6, alignItems: 'center' }}>
                              {sec.columns.map(col => col.type === 'select'
                                ? <select key={col.k} style={{ ...inp, cursor: 'pointer' }} value={row[col.k] ?? ''} onChange={e => listSet(sec.key, i, col.k, e.target.value)}><option value="">{col.label}</option>{col.opts!.map(o => <option key={o}>{o}</option>)}</select>
                                : <input key={col.k} style={inp} placeholder={col.label} value={row[col.k] ?? ''} onChange={e => listSet(sec.key, i, col.k, e.target.value)} />)}
                              <button onClick={() => listDel(sec.key, i)} style={{ width: 26, height: 26, border: `1px solid ${C.border}`, background: 'transparent', borderRadius: 6, color: '#e24b4a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => listAdd(sec.key)} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6, border: `1px dashed ${C.border}`, background: 'transparent', color: C.txt2, fontSize: 11.5, cursor: 'pointer' }}><Plus size={12} /> Adicionar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function L({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 10, color: C.txt3, marginBottom: 3 }}>{children}</div> }

// ── Exporta a ficha como PDF (via janela de impressão do navegador) ─────────────
function exportPdf({ name, photo, core, data, age }: { name: string; photo: string | null; core: any; data: any; age: number | null }) {
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const kv = (label: string, v: any) => v ? `<div class="kv"><span>${esc(label)}</span><b>${esc(v)}</b></div>` : ''
  let html = ''
  for (const sec of SECTIONS) {
    const d = data[sec.key]
    if (sec.kind === 'list') {
      const rows = (d ?? []).filter((r: any) => Object.values(r).some(v => v))
      if (!rows.length) continue
      html += `<h3>${esc(sec.title)}</h3><table><thead><tr>${sec.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r: any) => `<tr>${sec.columns.map(c => `<td>${esc(r[c.k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    } else {
      const parts = sec.fields.map(f => kv(f.label, d?.[f.k])).filter(Boolean)
      if (!parts.length) continue
      html += `<h3>${esc(sec.title)}</h3><div class="kvs">${parts.join('')}</div>`
    }
  }
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>Dossiê — ${esc(name)}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;font-size:12px}
    .head{display:flex;gap:16px;align-items:center;border-bottom:2px solid #333;padding-bottom:14px;margin-bottom:16px}
    .head img{width:96px;height:96px;border-radius:8px;object-fit:cover}
    h1{font-size:22px;margin:0 0 4px} .sub{color:#555}
    h3{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px;color:#222}
    table{width:100%;border-collapse:collapse;margin-bottom:6px} th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;font-size:11px}
    th{background:#f2f2f2} .kvs{display:grid;grid-template-columns:1fr 1fr;gap:2px 20px}
    .kv{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:3px 0} .kv span{color:#666}
    @media print{body{margin:14px}}
  </style></head><body>
    <div class="head">${photo ? `<img src="${photo}"/>` : ''}<div><h1>${esc(name)}</h1>
      <div class="sub">${[core.cpf && 'CPF ' + esc(core.cpf), core.rg && 'RG ' + esc(core.rg), core.nascimento && esc(core.nascimento) + (age != null ? ` (${age} anos)` : ''), core.sexo && esc(core.sexo)].filter(Boolean).join(' · ')}</div>
    </div></div>
    ${html || '<p style="color:#888">Ficha sem dados preenchidos.</p>'}
    <p style="margin-top:24px;color:#999;font-size:10px">Gerado pelo RedNest · ${new Date().toLocaleString('pt-BR')}</p>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(doc); w.document.close()
  setTimeout(() => { w.focus(); w.print() }, 400)
}
