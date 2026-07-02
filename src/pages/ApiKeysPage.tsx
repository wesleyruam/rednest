import { useEffect, useState } from 'react'
import {
  Key, ArrowLeft, RefreshCw, CheckCircle, Save, Trash2, Eye, EyeOff,
  Loader2, AlertTriangle, Globe, Chrome, Plug, Unplug, Send,
} from 'lucide-react'
import { useAppStore } from '@/store/app'
import { useUIStore } from '@/store/ui'
import {
  getIntegrations, setProviderKey, testProvider, type ProviderStatus,
} from '@/services/integrations'
import { getGoogleIntelStatus, connectGoogleIntel, disconnectGoogleIntel } from '@/services/googleintel'
import { getTelegramStatus, setTelegram, clearTelegram, testTelegram } from '@/services/notifications'
import { ApiError } from '@/lib/api'

function TelegramCard() {
  const { showToast } = useUIStore()
  const [configured, setConfigured] = useState(false)
  const [token, setToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { getTelegramStatus().then(s => setConfigured(s.configured)).catch(() => {}) }, [])

  async function save() {
    if (!token.trim() || !chatId.trim()) return
    setBusy(true)
    try {
      const r = await setTelegram(token.trim(), chatId.trim())
      if (r.ok) { setConfigured(true); setToken(''); showToast('Telegram conectado — mensagem enviada', 'success') }
      else showToast(`Falha: ${r.error ?? 'erro'}`, 'error')
    } catch { showToast('Falha ao salvar', 'error') } finally { setBusy(false) }
  }
  async function test() {
    setBusy(true)
    try { const r = await testTelegram(); showToast(r.ok ? 'Mensagem de teste enviada' : `Falha: ${r.error}`, r.ok ? 'success' : 'error') }
    catch { showToast('Falha', 'error') } finally { setBusy(false) }
  }
  async function disconnect() {
    setBusy(true)
    try { await clearTelegram(); setConfigured(false); showToast('Telegram desconectado', 'info') }
    catch { showToast('Falha', 'error') } finally { setBusy(false) }
  }

  return (
    <div className="block" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: 'rgba(55,138,221,.12)', border: '1px solid rgba(55,138,221,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Send size={17} style={{ color: '#378ADD' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--htxt)' }}>Telegram</div>
          <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>Recebe alertas de mudança (monitores) e mensagens importantes do RedNest.</div>
        </div>
        <span className="tag" style={{ color: configured ? 'var(--up)' : 'var(--txt-3)', borderColor: configured ? 'rgba(29,158,117,.4)' : undefined, background: configured ? 'rgba(29,158,117,.12)' : undefined }}>
          {configured ? 'conectado' : 'desconectado'}
        </span>
      </div>
      {configured ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={test} disabled={busy}>{busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />} Enviar teste</button>
          <button className="btn" onClick={disconnect} disabled={busy} style={{ color: '#e24b4a' }}><Trash2 size={13} /> Desconectar</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--txt-3)', lineHeight: 1.6, marginBottom: 8 }}>
            Crie um bot com o <strong style={{ color: 'var(--txt-2)' }}>@BotFather</strong>, pegue o <strong style={{ color: 'var(--txt-2)' }}>token</strong> e o seu <strong style={{ color: 'var(--txt-2)' }}>chat_id</strong> (via @userinfobot).
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={token} onChange={e => setToken(e.target.value)} placeholder="bot token (123456:ABC...)" style={{ flex: 2, padding: '8px 10px', background: 'var(--bg-base)', border: '0.5px solid var(--border-hover)', borderRadius: 7, color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'monospace' }} />
            <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="chat id" style={{ flex: 1, padding: '8px 10px', background: 'var(--bg-base)', border: '0.5px solid var(--border-hover)', borderRadius: 7, color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'monospace' }} />
            <button className="btn btn-accent" onClick={save} disabled={busy || !token.trim() || !chatId.trim()}>{busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />} Conectar</button>
          </div>
        </>
      )}
    </div>
  )
}

function GoogleIntelCard() {
  const { showToast } = useUIStore()
  const [connected, setConnected] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { getGoogleIntelStatus().then(s => setConnected(s.connected)).catch(() => {}) }, [])

  async function connect() {
    if (!token.trim()) return
    setBusy(true)
    try {
      const r = await connectGoogleIntel(token.trim())
      if (r.connected) { setConnected(true); setToken(''); showToast(`Conta Google conectada${r.email ? `: ${r.email}` : ''}`, 'success') }
      else showToast(`Falha: ${r.error ?? 'erro'}`, 'error')
    } catch { showToast('Falha ao conectar', 'error') } finally { setBusy(false) }
  }
  async function disconnect() {
    setBusy(true)
    try { await disconnectGoogleIntel(); setConnected(false); showToast('Conta Google desconectada', 'info') }
    catch { showToast('Falha', 'error') } finally { setBusy(false) }
  }

  return (
    <div className="block" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: 'rgba(90,209,255,.12)', border: '1px solid rgba(90,209,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Chrome size={18} style={{ color: '#5ad1ff' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--htxt)' }}>Google Intelligence</div>
          <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>Coleta de dados públicos do ecossistema Google a partir de um e-mail.</div>
        </div>
        <span className="tag" style={{ color: connected ? 'var(--up)' : 'var(--txt-3)', borderColor: connected ? 'rgba(29,158,117,.4)' : undefined, background: connected ? 'rgba(29,158,117,.12)' : undefined }}>
          {connected ? 'conectado' : 'desconectado'}
        </span>
      </div>
      {connected ? (
        <button className="btn" onClick={disconnect} disabled={busy} style={{ color: '#e24b4a' }}>
          {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Unplug size={13} />} Desconectar conta
        </button>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--txt-3)', lineHeight: 1.6, marginBottom: 8 }}>
            Instale a extensão <strong style={{ color: 'var(--txt-2)' }}>GHunt Companion</strong> (Chrome/Firefox), logue numa conta Google dedicada, gere a autenticação <strong style={{ color: 'var(--txt-2)' }}>base64</strong> e cole abaixo. O token dá acesso amplo à conta — use uma conta descartável.
          </div>
          <textarea value={token} onChange={e => setToken(e.target.value)} placeholder="cole aqui a autenticação base64 do Companion…" rows={3}
            style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-base)', border: '0.5px solid var(--border-hover)', borderRadius: 7, color: 'var(--text-primary)', fontSize: 11.5, outline: 'none', fontFamily: 'monospace', resize: 'vertical', marginBottom: 8 }} />
          <button className="btn btn-accent" onClick={connect} disabled={busy || !token.trim()}>
            {busy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plug size={13} />} Conectar conta Google
          </button>
        </>
      )}
    </div>
  )
}

const KEYLESS = [
  { label: 'Check-Host', desc: 'Checagem distribuída (ping/http/tcp/dns)' },
  { label: 'crt.sh / CertSpotter / Anubis', desc: 'Subdomínios via Certificate Transparency' },
  { label: 'CIRCL + NVD', desc: 'Detalhes de CVE (CVSS, CWE, referências)' },
  { label: 'BGPView + ipinfo', desc: 'ASN, prefixo e geolocalização de IP' },
  { label: 'rdap.org', desc: 'WHOIS/RDAP de domínios' },
  { label: 'Wayback Machine', desc: 'URLs arquivadas' },
  { label: 'holehe', desc: 'Contas registradas a partir de um e-mail (CLI)' },
  { label: 'ProxyNova COMB', desc: 'Busca de credenciais vazadas (e-mail/senha)' },
]

function ProviderCard({ p, onChanged }: { p: ProviderStatus; onChanged: () => void }) {
  const { showToast } = useUIStore()
  const [value, setValue] = useState('')
  const [reveal, setReveal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  async function save() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await setProviderKey(p.service, value.trim())
      showToast(`Chave de ${p.label} salva`, 'success')
      setValue('')
      onChanged()
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Falha ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    try {
      await setProviderKey(p.service, null)
      showToast(`Chave de ${p.label} removida`, 'success')
      onChanged()
    } catch {
      showToast('Falha ao remover', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    try {
      const r = await testProvider(p.service)
      showToast(r.ok ? `${p.label}: chave válida` : `${p.label}: ${r.error || 'falhou'}`, r.ok ? 'success' : 'error')
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Falha no teste', 'error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="block" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: 'rgba(var(--accent-rgb),.12)', border: '1px solid rgba(var(--accent-rgb),.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Key size={15} style={{ color: 'rgba(var(--accent-rgb),1)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--htxt)' }}>{p.label}</div>
          <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>
            {p.configured
              ? <>configurada · <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.masked}</span></>
              : 'sem chave'}
          </div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.configured ? 'var(--up)' : 'var(--txt-3)', boxShadow: p.configured ? '0 0 6px var(--up)' : undefined }} />
          <span style={{ fontSize: 11.5, color: p.configured ? 'var(--up)' : 'var(--txt-3)' }}>{p.configured ? 'Ativa' : 'Inativa'}</span>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type={reveal ? 'text' : 'password'}
            value={value} onChange={e => setValue(e.target.value)}
            placeholder={p.configured ? 'Nova chave (substitui a atual)' : 'Cole a chave aqui'}
            style={{ width: '100%', padding: '8px 34px 8px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid var(--line-2)', borderRadius: 7, color: 'var(--htxt)', fontSize: 12, outline: 'none', fontFamily: "'JetBrains Mono', monospace", boxSizing: 'border-box' }}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
          <button onClick={() => setReveal(v => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-3)', display: 'flex', padding: 2 }}>
            {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <button className="hbtn" onClick={save} disabled={saving || !value.trim()} title="Salvar" style={{ background: 'rgba(var(--accent-rgb),.16)', borderColor: 'rgba(var(--accent-rgb),.4)', color: 'var(--htxt)' }}>
          {saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />} Salvar
        </button>
        <button className="hbtn" onClick={test} disabled={testing || !p.configured} title="Testar">
          {testing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />} Testar
        </button>
        {p.configured && (
          <button className="hbtn" onClick={remove} title="Remover" style={{ color: 'var(--down)', borderColor: 'rgba(240,71,106,.3)', background: 'rgba(240,71,106,.07)', width: 34, padding: 0, justifyContent: 'center' }}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

export function ApiKeysPage() {
  const { backToOperations } = useAppStore()
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const d = await getIntegrations()
      setProviders(d.services)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar integrações')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const active = providers.filter(p => p.configured).length

  return (
    <div className="hud" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--hbg)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="hbtn" onClick={backToOperations} style={{ gap: 7 }}><ArrowLeft size={13} /> Voltar</button>
        <div style={{ width: 1, height: 20, background: 'var(--line-2)' }} />
        <Key size={16} style={{ color: 'var(--htxt)' }} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--htxt)', lineHeight: 1 }}>Integrações & Chaves API</div>
          <div style={{ fontSize: 11.5, color: 'var(--txt-3)', marginTop: 2 }}>Provedores de threat intelligence e enriquecimento</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="hbtn" onClick={load}><RefreshCw size={12} /> Atualizar</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--txt-3)' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} />
            <div style={{ fontSize: 13 }}>Carregando integrações...</div>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', borderRadius: 8, background: 'rgba(240,71,106,.1)', border: '1px solid rgba(240,71,106,.3)' }}>
            <AlertTriangle size={14} style={{ color: 'var(--down)' }} />
            <span style={{ fontSize: 12.5, color: 'var(--down)' }}>{error}</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Threat Intelligence (com chave)</span>
              <span className="tag">{active}/{providers.length} ativas</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12, marginBottom: 28 }}>
              {providers.map(p => <ProviderCard key={p.service} p={p} onChanged={load} />)}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 14 }}>Notificações</div>
            <div style={{ marginBottom: 28 }}><TelegramCard /></div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 14 }}>Google Intelligence</div>
            <div style={{ marginBottom: 28 }}><GoogleIntelCard /></div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 14 }}>Fontes públicas (sem chave — sempre ativas)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {KEYLESS.map(k => (
                <div key={k.label} className="block" style={{ padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Globe size={14} style={{ color: 'var(--up)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--htxt)' }}>{k.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>{k.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, padding: '14px 18px', borderRadius: 10, background: 'rgba(var(--accent-rgb),.06)', border: '1px solid rgba(var(--accent-rgb),.2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <CheckCircle size={14} style={{ color: 'rgba(var(--accent-rgb),1)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: 'var(--txt-3)', lineHeight: 1.65 }}>
                As chaves são guardadas criptografadas (AES-256-GCM) no servidor e nunca retornam em texto puro — apenas mascaradas. Use <strong style={{ color: 'var(--txt-2)' }}>Testar</strong> para validar uma chave contra um indicador benigno.
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
