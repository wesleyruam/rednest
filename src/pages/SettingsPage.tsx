import { useEffect, useState } from 'react'
import {
  User, Palette, Bell, Shield, Database,
  Save, Check, Eye, EyeOff, Monitor, LogOut,
  Trash2, Download, RefreshCw, ChevronRight, Activity, Loader2,
} from 'lucide-react'
import { useAppStore } from '@/store/app'
import { getHealth, getQueueStats, type HealthStatus, type QueueStats } from '@/services/coredata'

// ─── Saúde do sistema (observabilidade) ─────────────────────────────────────────

function HealthBlock() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [queue, setQueue] = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [h, q] = await Promise.all([getHealth().catch(() => null), getQueueStats().catch(() => null)])
      setHealth(h); setQueue(q)
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const dot = (up: boolean) => ({ width: 8, height: 8, borderRadius: '50%', background: up ? 'var(--accent-green)' : '#e24b4a', display: 'inline-block', marginRight: 7 } as React.CSSProperties)
  const upt = (s?: number) => s == null ? '—' : s > 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m ${s % 60}s`

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Saúde do Sistema</span>
        <button className="btn" style={{ padding: '4px 9px', fontSize: 11 }} onClick={load} disabled={loading}>
          {loading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={11} />} Atualizar
        </button>
      </div>
      <div style={{ padding: '16px', borderRadius: 8, background: 'rgba(255,255,255,.02)', border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={14} style={{ color: health?.status === 'ok' ? 'var(--accent-green)' : '#EF9F27' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {health ? (health.status === 'ok' ? 'Operacional' : 'Degradado') : '—'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>uptime {upt(health?.uptimeSeconds)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span style={dot(health?.checks.database === 'up')} />Banco de dados</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span style={dot(health?.checks.redis === 'up')} />Redis / fila</div>
        </div>
        <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Fila de monitores (BullMQ)</div>
          {queue?.connected ? (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {['waiting', 'active', 'completed', 'failed', 'delayed'].map(k => (
                <span key={k} style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  {k}: <strong style={{ color: k === 'failed' && (queue.counts[k] ?? 0) > 0 ? '#e24b4a' : 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{queue.counts[k] ?? 0}</strong>
                </span>
              ))}
            </div>
          ) : <span style={{ fontSize: 11.5, color: '#e24b4a' }}>desconectada</span>}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
          Métricas Prometheus em <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>/api/metrics</code> · health em <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>/api/health</code>
        </div>
      </div>
    </div>
  )
}

// ─── Section nav ─────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'perfil',        label: 'Perfil',          icon: User },
  { id: 'aparencia',     label: 'Aparência',        icon: Palette },
  { id: 'notificacoes',  label: 'Notificações',     icon: Bell },
  { id: 'seguranca',     label: 'Segurança',        icon: Shield },
  { id: 'sistema',       label: 'Sistema',          icon: Database },
] as const

type SectionId = typeof SECTIONS[number]['id']

// ─── Small primitives ─────────────────────────────────────────────────────────

function SettingRow({
  label, desc, children,
}: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: '0.5px solid var(--line)',
      gap: 24,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: value ? 'rgba(127,119,221,.8)' : 'rgba(255,255,255,.1)',
        position: 'relative', transition: 'background .2s', flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: value ? '#fff' : 'rgba(255,255,255,.4)',
        transition: 'left .2s',
      }} />
    </button>
  )
}

function SettingInput({
  value, onChange, type = 'text', placeholder,
}: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '7px 12px', background: 'rgba(255,255,255,.04)',
        border: '0.5px solid var(--border)', borderRadius: 7,
        color: 'var(--text-primary)', fontSize: 12.5, outline: 'none',
        width: 220, transition: 'border-color .15s',
        fontFamily: 'inherit',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(127,119,221,.5)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
    />
  )
}

function SettingSelect({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      style={{
        padding: '7px 12px', background: 'rgba(255,255,255,.04)',
        border: '0.5px solid var(--border)', borderRadius: 7,
        color: 'var(--text-primary)', fontSize: 12.5, outline: 'none',
        cursor: 'pointer', width: 220,
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      {desc && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>{desc}</p>}
    </div>
  )
}

function SaveBar({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20 }}>
      <button
        onClick={onSave}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
          background: saved ? 'rgba(29,158,117,.25)' : 'rgba(127,119,221,.25)',
          color: saved ? '#34d27b' : '#a09ae8',
          fontSize: 13, fontWeight: 600, transition: 'all .2s',
          border: `1px solid ${saved ? 'rgba(29,158,117,.4)' : 'rgba(127,119,221,.4)'}`,
        }}
      >
        {saved ? <Check size={14} /> : <Save size={14} />}
        {saved ? 'Salvo!' : 'Salvar alterações'}
      </button>
    </div>
  )
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function PerfilSection() {
  const { logout } = useAppStore()
  const [name,  setName]  = useState('operator.red')
  const [email, setEmail] = useState('operator@rednest.io')
  const [role,  setRole]  = useState('CTI Analyst')
  const [saved, setSaved] = useState(false)

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <SectionTitle title="Perfil" desc="Informações da sua conta de operador." />

      {/* Avatar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28,
        padding: '16px 20px', borderRadius: 10,
        background: 'rgba(127,119,221,.06)', border: '0.5px solid rgba(127,119,221,.2)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(127,119,221,.4), rgba(90,209,255,.2))',
          border: '2px solid rgba(127,119,221,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: '#a09ae8',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          OR
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>operator.red</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>operator@rednest.io · CTI Analyst</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
            fontSize: 10.5, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(29,158,117,.12)', color: '#34d27b',
            border: '1px solid rgba(29,158,117,.25)',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d27b' }} />
            Sessão ativa
          </div>
        </div>
      </div>

      <SettingRow label="Nome de exibição" desc="Aparece no rodapé da sidebar e nos relatórios.">
        <SettingInput value={name} onChange={setName} placeholder="operator.red" />
      </SettingRow>

      <SettingRow label="E-mail" desc="Endereço associado à conta de operador.">
        <SettingInput value={email} onChange={setEmail} type="email" placeholder="operador@rednest.io" />
      </SettingRow>

      <SettingRow label="Função / Cargo" desc="Exibido no perfil e nos relatórios exportados.">
        <SettingSelect
          value={role} onChange={setRole}
          options={[
            { value: 'CTI Analyst',       label: 'CTI Analyst' },
            { value: 'OSINT Investigator', label: 'OSINT Investigator' },
            { value: 'Threat Hunter',     label: 'Threat Hunter' },
            { value: 'SOC Analyst',       label: 'SOC Analyst' },
            { value: 'Red Team',          label: 'Red Team' },
            { value: 'Administrador',     label: 'Administrador' },
          ]}
        />
      </SettingRow>

      <SaveBar onSave={save} saved={saved} />

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
          Sessão
        </div>
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 7, border: '0.5px solid rgba(226,75,74,.3)',
            background: 'rgba(226,75,74,.08)', color: '#e24b4a',
            fontSize: 12.5, cursor: 'pointer', fontWeight: 500,
          }}
        >
          <LogOut size={13} /> Encerrar sessão
        </button>
      </div>
    </div>
  )
}

const ACCENT_COLORS = [
  { label: 'Índigo',   value: '127,119,221', preview: '#7F77DD' },
  { label: 'Azul',     value: '55,138,221',  preview: '#378ADD' },
  { label: 'Ciano',    value: '90,209,255',  preview: '#5ad1ff' },
  { label: 'Verde',    value: '29,158,117',  preview: '#1D9E75' },
  { label: 'Âmbar',   value: '239,159,39',  preview: '#EF9F27' },
  { label: 'Rosa',     value: '232,121,249', preview: '#e879f9' },
  { label: 'Vermelho', value: '226,75,74',   preview: '#e24b4a' },
]

function AparenciaSection() {
  const [accent,   setAccent]   = useState('127,119,221')
  const [fontSize, setFontSize] = useState('normal')
  const [density,  setDensity]  = useState('normal')
  const [animations, setAnimations] = useState(true)
  const [saved, setSaved] = useState(false)

  function save() {
    document.documentElement.style.setProperty('--accent-rgb', accent)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <SectionTitle title="Aparência" desc="Personalize a interface da plataforma." />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>Cor de destaque</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => setAccent(c.value)}
              title={c.label}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: c.preview,
                boxShadow: accent === c.value
                  ? `0 0 0 3px var(--bg-elevated), 0 0 0 5px ${c.preview}`
                  : '0 0 0 1px rgba(255,255,255,.1)',
                transition: 'box-shadow .15s',
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Selecionado: {ACCENT_COLORS.find(c => c.value === accent)?.label}
        </div>
      </div>

      <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 4 }} />

      <SettingRow label="Tamanho de fonte" desc="Afeta o tamanho base do texto em toda a interface.">
        <SettingSelect
          value={fontSize} onChange={setFontSize}
          options={[
            { value: 'compact', label: 'Compacto (11px)' },
            { value: 'normal',  label: 'Normal (12px)' },
            { value: 'large',   label: 'Amplo (13px)' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Densidade" desc="Controla o espaçamento entre elementos nas listas e painéis.">
        <SettingSelect
          value={density} onChange={setDensity}
          options={[
            { value: 'compact', label: 'Compacto' },
            { value: 'normal',  label: 'Normal' },
            { value: 'relaxed', label: 'Espaçoso' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Animações" desc="Ativa ou desativa transições e efeitos de movimento.">
        <Toggle value={animations} onChange={setAnimations} />
      </SettingRow>

      {/* Preview strip */}
      <div style={{
        marginTop: 20, padding: '14px 16px', borderRadius: 8,
        background: 'rgba(255,255,255,.02)', border: '0.5px solid var(--border)',
      }}>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Pré-visualização</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'default', background: `rgb(${accent})`, color: '#fff', fontSize: 12, fontWeight: 600 }}>
            Botão Principal
          </button>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `rgba(${accent},.15)`, color: `rgb(${accent})`, border: `1px solid rgba(${accent},.3)` }}>
            Tag
          </span>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: `rgb(${accent})`, boxShadow: `0 0 8px rgba(${accent},.6)` }} />
          <span style={{ fontSize: 12, color: `rgb(${accent})`, textDecoration: 'underline', cursor: 'pointer' }}>Link de exemplo</span>
        </div>
      </div>

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}

function NotificacoesSection() {
  const [prefs, setPrefs] = useState({
    newIoc:        true,
    alertTriggered: true,
    leakFound:     true,
    domainFound:   false,
    profileFound:  false,
    opUpdated:     false,
    reportReady:   true,
    dailyDigest:   false,
  })
  const [sound, setSound] = useState(false)
  const [desktop, setDesktop] = useState(true)
  const [saved, setSaved] = useState(false)

  const toggle = (key: keyof typeof prefs) => setPrefs(p => ({ ...p, [key]: !p[key] }))

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const items: { key: keyof typeof prefs; label: string; desc: string; sev?: string }[] = [
    { key: 'newIoc',         label: 'Novo IOC adicionado',             desc: 'Quando um indicador de comprometimento é registrado.',   sev: 'high' },
    { key: 'alertTriggered', label: 'Alerta de monitoramento',          desc: 'Disparo de alertas configurados em engajamentos.',       sev: 'crit' },
    { key: 'leakFound',      label: 'Vazamento encontrado',             desc: 'Nova exposição de dados identificada.',                  sev: 'crit' },
    { key: 'domainFound',    label: 'Novo domínio descoberto',          desc: 'Subdomínio ou domínio associado identificado.' },
    { key: 'profileFound',   label: 'Novo perfil social encontrado',    desc: 'Perfil vinculado ao alvo identificado.' },
    { key: 'opUpdated',      label: 'Atualização de operação',          desc: 'Mudança de status ou progresso em uma operação.' },
    { key: 'reportReady',    label: 'Relatório gerado',                 desc: 'Notifica quando um relatório está disponível para download.' },
    { key: 'dailyDigest',    label: 'Resumo diário',                    desc: 'E-mail diário com atividade resumida de todas as operações.' },
  ]

  return (
    <div>
      <SectionTitle title="Notificações" desc="Controle quais eventos geram alertas no sistema." />

      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Canais
        </div>
        <SettingRow label="Notificações na interface" desc="Exibe alertas no sino da titlebar.">
          <Toggle value={desktop} onChange={setDesktop} />
        </SettingRow>
        <SettingRow label="Sons de alerta" desc="Emite um sinal sonoro ao receber alertas críticos.">
          <Toggle value={sound} onChange={setSound} />
        </SettingRow>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        Eventos
      </div>

      {items.map(item => (
        <SettingRow key={item.key} label={item.label} desc={item.desc}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {item.sev && (
              <span style={{
                fontSize: 9.5, padding: '1px 6px', borderRadius: 3,
                background: item.sev === 'crit' ? 'rgba(240,71,106,.15)' : 'rgba(251,146,60,.15)',
                color: item.sev === 'crit' ? '#f0476a' : '#fb923c',
                border: `1px solid ${item.sev === 'crit' ? 'rgba(240,71,106,.3)' : 'rgba(251,146,60,.3)'}`,
              }}>
                {item.sev === 'crit' ? 'Crítico' : 'Alto'}
              </span>
            )}
            <Toggle value={prefs[item.key]} onChange={() => toggle(item.key)} />
          </div>
        </SettingRow>
      ))}

      <SaveBar onSave={save} saved={saved} />
    </div>
  )
}

function SegurancaSection() {
  const [showPass, setShowPass] = useState(false)
  const [currentPass, setCurrentPass]   = useState('')
  const [newPass,     setNewPass]       = useState('')
  const [confirmPass, setConfirmPass]   = useState('')
  const [twoFactor,   setTwoFactor]     = useState(false)
  const [autoLock,    setAutoLock]      = useState(true)
  const [lockTimeout, setLockTimeout]   = useState('30')
  const [saved,       setSaved]         = useState(false)

  const sessions: { device: string; ip: string; last: string; current: boolean }[] = []

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <SectionTitle title="Segurança" desc="Gerencie senha, autenticação e sessões ativas." />

      {/* Password */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Alterar senha
        </div>
        <SettingRow label="Senha atual" desc="">
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={currentPass}
              onChange={e => setCurrentPass(e.target.value)}
              placeholder="••••••••"
              style={{
                padding: '7px 36px 7px 12px', background: 'rgba(255,255,255,.04)',
                border: '0.5px solid var(--border)', borderRadius: 7,
                color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', width: 220,
              }}
            />
            <button onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
              {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Nova senha" desc="">
          <input
            type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            style={{ padding: '7px 12px', background: 'rgba(255,255,255,.04)', border: '0.5px solid var(--border)', borderRadius: 7, color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', width: 220 }}
          />
        </SettingRow>
        <SettingRow label="Confirmar nova senha" desc="">
          <input
            type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
            placeholder="Repita a nova senha"
            style={{
              padding: '7px 12px', background: 'rgba(255,255,255,.04)',
              border: `0.5px solid ${confirmPass && confirmPass !== newPass ? 'rgba(226,75,74,.6)' : 'var(--border)'}`,
              borderRadius: 7, color: 'var(--text-primary)', fontSize: 12.5, outline: 'none', width: 220,
            }}
          />
        </SettingRow>
      </div>

      {/* 2FA + auto-lock */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        Autenticação
      </div>
      <SettingRow label="Autenticação em dois fatores" desc="Adiciona uma camada extra de verificação ao login.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!twoFactor && <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Desativado</span>}
          <Toggle value={twoFactor} onChange={setTwoFactor} />
        </div>
      </SettingRow>
      <SettingRow label="Bloqueio automático" desc="Encerra a sessão após período de inatividade.">
        <Toggle value={autoLock} onChange={setAutoLock} />
      </SettingRow>
      {autoLock && (
        <SettingRow label="Tempo de inatividade" desc="Sessão encerrada após este período sem uso.">
          <SettingSelect
            value={lockTimeout} onChange={setLockTimeout}
            options={[
              { value: '15',  label: '15 minutos' },
              { value: '30',  label: '30 minutos' },
              { value: '60',  label: '1 hora' },
              { value: '240', label: '4 horas' },
            ]}
          />
        </SettingRow>
      )}

      <SaveBar onSave={save} saved={saved} />

      {/* Sessions */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
          Sessões ativas
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              Nenhuma sessão registrada.
            </div>
          )}
          {sessions.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,.02)', border: `0.5px solid ${s.current ? 'rgba(127,119,221,.25)' : 'var(--border)'}`,
            }}>
              <Monitor size={14} style={{ color: s.current ? '#a09ae8' : 'var(--text-muted)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: s.current ? 600 : 400 }}>{s.device}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                  {s.ip} · {s.last}
                </div>
              </div>
              {s.current
                ? <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, background: 'rgba(29,158,117,.12)', color: '#34d27b', border: '1px solid rgba(29,158,117,.25)' }}>atual</span>
                : <button style={{ padding: '4px 10px', borderRadius: 6, border: '0.5px solid rgba(226,75,74,.3)', background: 'rgba(226,75,74,.08)', color: '#e24b4a', fontSize: 11, cursor: 'pointer' }}>
                    Encerrar
                  </button>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SistemaSection() {
  const { openApiKeys } = useAppStore()
  const [retention,    setRetention]    = useState('90')
  const [autoBackup,   setAutoBackup]   = useState(true)
  const [telemetry,    setTelemetry]    = useState(false)
  const [saved,        setSaved]        = useState(false)

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <SectionTitle title="Sistema" desc="Dados, retenção e configurações gerais da plataforma." />

      <HealthBlock />

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        Dados & Retenção
      </div>

      <SettingRow label="Retenção de logs" desc="Período de armazenamento do histórico de atividades.">
        <SettingSelect
          value={retention} onChange={setRetention}
          options={[
            { value: '30',  label: '30 dias' },
            { value: '60',  label: '60 dias' },
            { value: '90',  label: '90 dias' },
            { value: '180', label: '6 meses' },
            { value: '365', label: '1 ano' },
          ]}
        />
      </SettingRow>

      <SettingRow label="Backup automático" desc="Exporta dados localmente em formato JSON toda semana.">
        <Toggle value={autoBackup} onChange={setAutoBackup} />
      </SettingRow>

      <SettingRow label="Telemetria de uso" desc="Envia dados anônimos para melhorar a plataforma.">
        <Toggle value={telemetry} onChange={setTelemetry} />
      </SettingRow>

      <SaveBar onSave={save} saved={saved} />

      {/* Actions */}
      <div style={{ marginTop: 28, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
          Ações
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          <button
            onClick={openApiKeys}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,.02)', border: '0.5px solid var(--border)',
              cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
          >
            <RefreshCw size={14} style={{ color: '#a09ae8', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>Gerenciar chaves de API</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Shodan, VirusTotal, HaveIBeenPwned e outros</div>
            </div>
            <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,.02)', border: '0.5px solid var(--border)',
              cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
          >
            <Download size={14} style={{ color: '#5ad1ff', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>Exportar todos os dados</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Baixar backup completo em JSON</div>
            </div>
            <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8,
              background: 'rgba(226,75,74,.04)', border: '0.5px solid rgba(226,75,74,.2)',
              cursor: 'pointer', textAlign: 'left', transition: 'background .15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(226,75,74,.08)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(226,75,74,.04)' }}
          >
            <Trash2 size={14} style={{ color: '#e24b4a', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: '#e24b4a' }}>Limpar cache da plataforma</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Remove dados temporários e respostas de API em cache</div>
            </div>
            <ChevronRight size={13} style={{ color: 'rgba(226,75,74,.4)' }} />
          </button>

        </div>
      </div>

      {/* Build info */}
      <div style={{
        marginTop: 28, padding: '12px 16px', borderRadius: 8,
        background: 'rgba(255,255,255,.02)', border: '0.5px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          RedNest V2 · <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>v2.0.0-alpha</span>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
          build 2026.06.24
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SECTION_CONTENT: Record<SectionId, React.FC> = {
  perfil:       PerfilSection,
  aparencia:    AparenciaSection,
  notificacoes: NotificacoesSection,
  seguranca:    SegurancaSection,
  sistema:      SistemaSection,
}

export function SettingsPage() {
  const [active, setActive] = useState<SectionId>('perfil')

  const Content = SECTION_CONTENT[active]

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* Page header */}
      <div style={{
        padding: '16px 28px', borderBottom: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        background: 'var(--bg-surface)',
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Configurações</h1>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0' }}>Preferências da plataforma e da conta de operador</p>
        </div>
      </div>

      {/* Body: left nav + right content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left nav */}
        <div style={{
          width: 192, flexShrink: 0, borderRight: '0.5px solid var(--border)',
          padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2,
          overflowY: 'auto', background: 'var(--bg-surface)',
        }}>
          {SECTIONS.map(s => {
            const isActive = active === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: isActive ? 'rgba(127,119,221,.12)' : 'transparent',
                  color: isActive ? '#a09ae8' : 'var(--text-muted)',
                  fontSize: 12.5, fontWeight: isActive ? 600 : 400,
                  textAlign: 'left', width: '100%',
                  transition: 'all .15s',
                }}
                onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
                onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <s.icon size={14} style={{ flexShrink: 0 }} />
                {s.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px', maxWidth: 680 }}>
          <Content />
        </div>
      </div>
    </div>
  )
}
