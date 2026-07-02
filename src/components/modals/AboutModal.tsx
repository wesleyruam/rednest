import { X, Shield, Globe, Database, Eye, Zap, Github, ExternalLink } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { useDataStore } from '@/store/data'

const VERSION = '2.0.0-alpha'
const BUILD = '2026.06.23'

const STACK = [
  { name: 'React 18',    desc: 'UI framework',           color: '#5ad1ff' },
  { name: 'TypeScript',  desc: 'Tipagem estática',        color: '#378ADD' },
  { name: 'Vite',        desc: 'Build & HMR',            color: '#EF9F27' },
  { name: 'Zustand',     desc: 'State management',       color: '#1D9E75' },
  { name: 'Recharts',    desc: 'Visualização de dados',  color: '#e879f9' },
  { name: 'Lucide',      desc: 'Icon system',            color: '#8a9cff' },
]

const MODULES = [
  { icon: Eye,      label: 'OSINT & CTI',        desc: 'Coleta e correlação de inteligência' },
  { icon: Globe,    label: 'Web Recon',           desc: 'Reconhecimento e análise de websites' },
  { icon: Database, label: 'Leak Analysis',       desc: 'Vazamentos e exposição de dados' },
  { icon: Shield,   label: 'Vuln Tracking',       desc: 'Rastreamento de vulnerabilidades' },
]

export function AboutModal() {
  const { activeModal, closeModal } = useUIStore()
  const { engagements, operations } = useDataStore()

  if (activeModal !== 'about') return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeModal}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', zIndex: 6000 }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 520, zIndex: 6001, borderRadius: 14,
        background: 'var(--bg-elevated)', border: '0.5px solid var(--border-hover)',
        boxShadow: '0 32px 80px rgba(0,0,0,.8)',
        overflow: 'hidden',
      }}>

        {/* Hero */}
        <div style={{
          padding: '32px 28px 24px',
          background: 'linear-gradient(160deg, rgba(127,119,221,.12) 0%, rgba(90,209,255,.06) 60%, transparent 100%)',
          borderBottom: '0.5px solid var(--border)',
          position: 'relative',
        }}>
          {/* Close */}
          <button
            onClick={closeModal}
            className="btn"
            style={{ position: 'absolute', top: 14, right: 14, padding: '4px 8px' }}
          >
            <X size={13} />
          </button>

          {/* Logo row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(127,119,221,.3), rgba(90,209,255,.15))',
              border: '1px solid rgba(127,119,221,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(127,119,221,.25)',
            }}>
              <Shield size={24} style={{ color: '#a09ae8' }} />
            </div>
            <div>
              <div style={{
                fontSize: 24, fontWeight: 800, lineHeight: 1,
                fontFamily: "'Space Grotesk', sans-serif",
                background: 'linear-gradient(90deg, #a09ae8, #5ad1ff)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                marginBottom: 5,
              }}>
                RedNest V2
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                  color: '#a09ae8', background: 'rgba(127,119,221,.18)',
                  border: '1px solid rgba(127,119,221,.35)',
                  padding: '2px 8px', borderRadius: 20,
                }}>v{VERSION}</span>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  build {BUILD}
                </span>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0, maxWidth: 400 }}>
            Plataforma de inteligência de ameaças e OSINT para operações cibernéticas. Coleta, correlaciona e analisa informações de múltiplas fontes em uma interface unificada.
          </p>
        </div>

        {/* Stats strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          borderBottom: '0.5px solid var(--border)',
        }}>
          {[
            { label: 'Operações',    value: operations.length },
            { label: 'Engajamentos', value: engagements.length },
            { label: 'Módulos',      value: MODULES.length },
            { label: 'Integrações',  value: 7 },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: '14px 0', textAlign: 'center',
              borderRight: i < 3 ? '0.5px solid var(--border)' : 'none',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Modules */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Módulos</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {MODULES.map(m => (
                <div key={m.label} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,.03)', border: '0.5px solid var(--border)',
                }}>
                  <m.icon size={14} style={{ color: '#7F77DD', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{m.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stack */}
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Stack Tecnológico</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STACK.map(s => (
                <span key={s.name} style={{
                  fontSize: 11.5, fontWeight: 600,
                  color: s.color, background: `${s.color}14`,
                  border: `1px solid ${s.color}30`,
                  padding: '4px 10px', borderRadius: 20,
                  cursor: 'default',
                }} title={s.desc}>{s.name}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 28px',
          borderTop: '0.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={12} style={{ color: '#7F77DD' }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Desenvolvido por{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>Wesley Ruan</strong>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn"
              style={{ padding: '4px 10px', fontSize: 11, gap: 5 }}
              onClick={() => window.open('https://github.com', '_blank')}
            >
              <Github size={11} /> GitHub
            </button>
            <button
              className="btn"
              style={{ padding: '4px 10px', fontSize: 11, gap: 5 }}
              onClick={closeModal}
            >
              <ExternalLink size={11} /> Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
