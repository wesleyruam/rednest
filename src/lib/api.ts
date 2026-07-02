// Cliente HTTP central da v2 — fala com o backend NestJS via /api (proxy em dev,
// nginx em prod). Gerencia JWT (access + refresh) com auto-refresh em 401.

const BASE = '/api'
const AT_KEY = 'rednest_at'
const RT_KEY = 'rednest_rt'

let accessToken: string | null = localStorage.getItem(AT_KEY)
let refreshToken: string | null = localStorage.getItem(RT_KEY)

export interface AuthUser {
  id: string
  username: string
  email: string
  role: 'admin' | 'analyst' | 'viewer'
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function setTokens(at: string | null, rt: string | null) {
  accessToken = at
  refreshToken = rt
  if (at) { localStorage.setItem(AT_KEY, at); sessionDead = false } else localStorage.removeItem(AT_KEY)
  if (rt) localStorage.setItem(RT_KEY, rt); else localStorage.removeItem(RT_KEY)
}

export function hasSession(): boolean {
  return !!accessToken
}

export function clearTokens() {
  setTokens(null, null)
}

// ── Sessão expirada → manda para o login ──────────────────────────────────────
// A app registra um handler (ex.: derruba o estado de auth → renderiza LoginPage).
let onUnauthorized: (() => void) | null = null
let sessionDead = false
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn }

/** 401 irrecuperável (refresh falhou/expirou): limpa tokens e avisa a app uma vez. */
function forceLogout() {
  clearTokens()
  if (!sessionDead) { sessionDead = true; onUnauthorized?.() }
}

// Single-flight: várias requisições que batem 401 ao mesmo tempo compartilham
// UM único refresh. Sem isso, o backend (que rotaciona/revoga todos os tokens)
// invalida a sessão na corrida → 401 em série e logout forçado.
let refreshInFlight: Promise<boolean> | null = null

function doRefresh(): Promise<boolean> {
  const rt = refreshToken
  if (!rt) return Promise.resolve(false)
  return (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
      if (!res.ok) return false
      const d = await res.json()
      setTokens(d.accessToken, d.refreshToken)
      return true
    } catch {
      return false
    }
  })()
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

export interface RequestOpts {
  method?: string
  body?: unknown
}

export async function apiRequest<T = any>(path: string, opts: RequestOpts = {}): Promise<T> {
  const doFetch = () =>
    fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })

  let res = await doFetch()
  if (res.status === 401) {
    res = (await tryRefresh()) ? await doFetch() : res
    if (res.status === 401) { forceLogout(); throw new ApiError(401, 'Sessão expirada. Faça login novamente.') }
  }

  if (res.status === 204) return undefined as T
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || `Erro HTTP ${res.status}`
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : String(msg))
  }
  return data as T
}

/**
 * Consome um endpoint SSE (text/event-stream) via fetch — mantém o header
 * Authorization (o EventSource nativo não suporta headers). Chama `onEvent`
 * para cada frame `data:` (já parseado de JSON). Resolve quando o stream fecha.
 */
export async function apiStream(
  path: string,
  onEvent: (data: any) => void,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<void> {
  const doFetch = () =>
    fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })

  let res = await doFetch()
  if (res.status === 401) {
    res = (await tryRefresh()) ? await doFetch() : res
    if (res.status === 401) { forceLogout(); throw new ApiError(401, 'Sessão expirada. Faça login novamente.') }
  }
  if (!res.ok || !res.body) throw new ApiError(res.status, `Erro no stream (${res.status})`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const payload = frame
        .split('\n')
        .filter(l => l.startsWith('data:'))
        .map(l => l.slice(5).replace(/^ /, ''))
        .join('\n')
      if (!payload) continue
      try {
        onEvent(JSON.parse(payload))
      } catch {
        /* ignora frames não-JSON (ex.: comentários de keep-alive) */
      }
    }
  }
}

/** Upload multipart (FormData) com auth + refresh em 401. */
export async function apiUpload<T = any>(path: string, form: FormData): Promise<T> {
  const doFetch = () =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: form,
    })
  let res = await doFetch()
  if (res.status === 401) {
    res = (await tryRefresh()) ? await doFetch() : res
    if (res.status === 401) { forceLogout(); throw new ApiError(401, 'Sessão expirada. Faça login novamente.') }
  }
  let data: any = null
  try { data = await res.json() } catch { data = null }
  if (!res.ok) throw new ApiError(res.status, data?.message || `Erro HTTP ${res.status}`)
  return data as T
}

/** Baixa um arquivo protegido (envia Authorization) e dispara o download no browser. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  let res = await fetch(`${BASE}${path}`, {
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  })
  if (res.status === 401) {
    res = (await tryRefresh()) ? await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } }) : res
    if (res.status === 401) { forceLogout(); throw new ApiError(401, 'Sessão expirada. Faça login novamente.') }
  }
  if (!res.ok) throw new ApiError(res.status, `Erro ao baixar (${res.status})`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function apiLogin(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    if (res.status === 401) throw new ApiError(401, 'Usuário ou senha incorretos.')
    throw new ApiError(res.status, 'Falha ao conectar ao servidor.')
  }
  const d = await res.json()
  setTokens(d.accessToken, d.refreshToken)
  return d.user as AuthUser
}

export async function apiLogout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' })
  } catch {
    /* ignora — limpa local de qualquer forma */
  }
  clearTokens()
}
