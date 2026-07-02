import { useState, useEffect } from 'react'
import { Shield, Eye, EyeOff, AlertCircle, ArrowRight, Lock, User } from 'lucide-react'
import { useAppStore } from '@/store/app'
import { apiLogin, ApiError } from '@/lib/api'

// ─── Decorative terminal lines ─────────────────────────────────────────────────

const TERMINAL_LINES = [
  { text: '> Inicializando módulos OSINT...', color: 'var(--up)',  delay: 0    },
  { text: '> Conectando a fontes externas...', color: 'var(--txt-3)', delay: 400 },
  { text: '> Shodan          [OK]',           color: 'var(--up)',  delay: 900  },
  { text: '> VirusTotal      [OK]',           color: 'var(--up)',  delay: 1200 },
  { text: '> HaveIBeenPwned  [OK]',           color: 'var(--up)',  delay: 1500 },
  { text: '> Carregando workspace...',        color: 'var(--txt-3)', delay: 2000 },
  { text: '> Sistema pronto.',               color: 'var(--low)', delay: 2500 },
]

const STATS = [
  { label: 'Operações ativas', value: '3' },
  { label: 'Engajamentos',     value: '12' },
  { label: 'Indicadores',      value: '1.4K' },
  { label: 'Alertas hoje',     value: '7' },
]

function TerminalLine({ text, color, delay }: { text: string; color: string; delay: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color,
      lineHeight: 1.9, opacity: visible ? 1 : 0,
      transition: 'opacity .3s',
    }}>{text}</div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function LoginPage() {
  const { login } = useAppStore()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Preencha usuário e senha.')
      return
    }

    setLoading(true)
    try {
      await apiLogin(email.trim(), password)
      login()
    } catch (err) {
      setLoading(false)
      setError(err instanceof ApiError ? err.message : 'Falha ao entrar.')
    }
  }

  function fillDemo() {
    setEmail('admin')
    setPassword('admin123')
  }

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 9, color: 'var(--htxt)',
    fontSize: 13, outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex',
      background: 'var(--hbg)',
      fontFamily: "'Space Grotesk', Inter, sans-serif",
    }}>
      {/* ── Left panel — branding ── */}
      <div style={{
        width: 440, flexShrink: 0, display: 'flex', flexDirection: 'column',
        padding: '40px 44px', position: 'relative', overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,.06)',
        background: 'linear-gradient(160deg, rgba(127,119,221,.08) 0%, rgba(90,209,255,.04) 50%, transparent 100%)',
      }}>
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .04,
          backgroundImage: 'linear-gradient(rgba(127,119,221,1) 1px, transparent 1px), linear-gradient(90deg, rgba(127,119,221,1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Glow blob */}
        <div style={{
          position: 'absolute', width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(127,119,221,.18) 0%, transparent 70%)',
          top: -80, left: -80, pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'auto', position: 'relative' }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11,
            background: 'linear-gradient(135deg, rgba(127,119,221,.35), rgba(90,209,255,.2))',
            border: '1px solid rgba(127,119,221,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(127,119,221,.3)',
          }}>
            <Shield size={20} style={{ color: '#b0abf0' }} />
          </div>
          <div>
            <div style={{
              fontSize: 20, fontWeight: 800, lineHeight: 1,
              background: 'linear-gradient(90deg, #b0abf0, #5ad1ff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>RedNest</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.3)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 1 }}>V2 Platform</div>
          </div>
        </div>

        {/* Center content */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
          <div>
            <h1 style={{
              fontSize: 30, fontWeight: 800, lineHeight: 1.2,
              color: 'var(--htxt)', margin: '0 0 12px',
            }}>
              Inteligência de ameaças<br />
              <span style={{
                background: 'linear-gradient(90deg, #a09ae8, #5ad1ff)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>em uma plataforma.</span>
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--txt-3)', lineHeight: 1.7, margin: 0 }}>
              OSINT, reconhecimento web, análise de vazamentos e monitoramento contínuo de alvos.
            </p>
          </div>

          {/* Live stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {STATS.map(s => (
              <div key={s.label} style={{
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--htxt)', lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Terminal */}
          <div style={{
            padding: '14px 16px', borderRadius: 10,
            background: 'rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.08)',
          }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {['#FF5F57','#FEBC2E','#28C840'].map(c => (
                <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: .7 }} />
              ))}
            </div>
            {TERMINAL_LINES.map((l, i) => (
              <TerminalLine key={i} {...l} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', fontSize: 11, color: 'rgba(255,255,255,.2)', marginTop: 32 }}>
          © 2026 RedNest · Desenvolvido por Wesley Ruan
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40,
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'rgba(var(--accent-rgb),1)', background: 'rgba(var(--accent-rgb),.1)',
              border: '1px solid rgba(var(--accent-rgb),.2)',
              padding: '4px 10px', borderRadius: 20, marginBottom: 16,
            }}>
              <Lock size={10} /> Acesso Seguro
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--htxt)', margin: '0 0 8px', lineHeight: 1.2 }}>
              Entrar na plataforma
            </h2>
            <p style={{ fontSize: 13, color: 'var(--txt-3)', margin: 0 }}>
              Use suas credenciais de operador para continuar.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Email */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 7 }}>
                Usuário
              </label>
              <div style={{ position: 'relative' }}>
                <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt-3)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  style={{ ...inputBase, paddingLeft: 38 }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),.5)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb),.08)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                  Senha
                </label>
                <button type="button" style={{ fontSize: 11.5, color: 'rgba(var(--accent-rgb),1)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Esqueci minha senha
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt-3)', pointerEvents: 'none' }} />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ ...inputBase, paddingLeft: 38, paddingRight: 40 }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),.5)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb),.08)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-3)', display: 'flex', alignItems: 'center', padding: 4 }}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Remember */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none' }}>
              <div
                onClick={() => setRemember(v => !v)}
                style={{
                  width: 17, height: 17, borderRadius: 5, flexShrink: 0,
                  border: `1.5px solid ${remember ? 'rgba(var(--accent-rgb),1)' : 'rgba(255,255,255,.2)'}`,
                  background: remember ? 'rgba(var(--accent-rgb),.8)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: '.15s',
                }}
              >
                {remember && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{ fontSize: 13, color: 'var(--txt-3)' }}>Lembrar este dispositivo</span>
            </label>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(240,71,106,.1)', border: '1px solid rgba(240,71,106,.3)',
              }}>
                <AlertCircle size={13} style={{ color: 'var(--down)', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--down)' }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 9,
                background: loading
                  ? 'rgba(127,119,221,.3)'
                  : 'linear-gradient(135deg, rgba(127,119,221,.9), rgba(90,209,255,.7))',
                border: '1px solid rgba(127,119,221,.5)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity .15s, transform .1s',
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '.02em',
                marginTop: 4,
              }}
              onMouseOver={e => { if (!loading) e.currentTarget.style.opacity = '.88' }}
              onMouseOut={e => { e.currentTarget.style.opacity = '1' }}
            >
              {loading ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Verificando...
                </>
              ) : (
                <>Entrar <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div style={{
            marginTop: 24, padding: '12px 16px', borderRadius: 9,
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--txt-3)', marginBottom: 2 }}>Conta padrão</div>
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,.25)' }}>
                admin · admin123
              </div>
            </div>
            <button
              type="button"
              onClick={fillDemo}
              style={{
                fontSize: 11.5, fontWeight: 600, padding: '5px 12px',
                background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 7, color: 'var(--txt-2)', cursor: 'pointer',
              }}
            >
              Preencher
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
