import { apiRequest } from '@/lib/api'

export type ProxyProtocol = 'http' | 'socks4' | 'socks5'

export interface Proxy {
  id: string
  protocol: ProxyProtocol
  host: string
  port: number
  alive: boolean
  latencyMs: number | null
  country: string | null
  countryName: string | null
  anonymity: string | null
  exitIp: string | null
  failCount: number
  lastCheckedAt: string | null
}

export interface ProxyPage { items: Proxy[]; total: number; page: number; pageSize: number; pages: number }
export interface ProxyStats {
  total: number; alive: number; dead: number
  protocols: Record<string, number>
  countries: { country: string; count: number }[]
  validating: boolean
}

export const listProxies = (opts: { page?: number; pageSize?: number; status?: string; protocol?: string; country?: string; q?: string } = {}) => {
  const qs = new URLSearchParams()
  if (opts.page) qs.set('page', String(opts.page))
  if (opts.pageSize) qs.set('pageSize', String(opts.pageSize))
  if (opts.status && opts.status !== 'all') qs.set('status', opts.status)
  if (opts.protocol) qs.set('protocol', opts.protocol)
  if (opts.country) qs.set('country', opts.country)
  if (opts.q) qs.set('q', opts.q)
  return apiRequest<ProxyPage>(`/proxies?${qs.toString()}`)
}
export const proxyStats = () => apiRequest<ProxyStats>('/proxies/stats')
export const refreshProxies = () => apiRequest<{ fetched: number; added: number }>('/proxies/refresh', { method: 'POST' })
export const validateProxies = () => apiRequest<{ checked: number; alive: number }>('/proxies/validate', { method: 'POST' })

export interface ProxyTestResult { protocol?: ProxyProtocol; host?: string; port?: number; alive?: boolean; latencyMs?: number; exitIp?: string; anonymity?: string; country?: string | null; countryName?: string | null; error?: string }
export const testProxy = (proxy: string) => apiRequest<ProxyTestResult>('/proxies/test', { method: 'POST', body: { proxy } })
export const testProxyById = (id: string) => apiRequest<Proxy>(`/proxies/${id}/test`, { method: 'POST' })
export const importProxies = (text: string) => apiRequest<{ parsed: number; added: number; invalid: number }>('/proxies/import', { method: 'POST', body: { text } })
export const deleteProxy = (id: string) => apiRequest<{ ok: boolean }>(`/proxies/${id}`, { method: 'DELETE' })

export interface GeoCheckRow { country: string; countryName: string | null; via: string; status: number; length?: number; hash?: string; title?: string | null; finalUrl?: string; elapsedMs?: number; error?: string }
export interface GeoCheckResult { target: string; baseline: GeoCheckRow | null; results: GeoCheckRow[]; distinctVariants: number; cloakingSuspected: boolean }
export const geoCheck = (target: string, max?: number) =>
  apiRequest<GeoCheckResult>('/proxies/geo-check', { method: 'POST', body: { target, max } })
