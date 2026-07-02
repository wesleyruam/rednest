import { apiRequest, apiStream } from '@/lib/api'

export interface ProviderStatus {
  service: string
  label: string
  configured: boolean
  masked: string | null
}

export const getIntegrations = () =>
  apiRequest<{ services: ProviderStatus[] }>('/integrations')

export const setProviderKey = (service: string, value: string | null) =>
  apiRequest(`/integrations/${service}`, { method: 'PUT', body: { value } })

export const testProvider = (service: string) =>
  apiRequest<{ ok: boolean; result?: any; error?: string }>(
    `/integrations/${service}/test`,
    { method: 'POST' },
  )

// ─── Enriquecimento ───────────────────────────────────────────────────────────

export const enrichIp = (ip: string) =>
  apiRequest('/enrich/ip', { method: 'POST', body: { ip } })

export const enrichDomain = (domain: string) =>
  apiRequest('/enrich/domain', { method: 'POST', body: { domain } })

export const enrichCve = (cve: string) =>
  apiRequest('/enrich/cve', { method: 'POST', body: { cve } })

export const enrichAsn = (ip: string) =>
  apiRequest('/enrich/asn', { method: 'POST', body: { ip } })

export const enrichWhois = (domain: string) =>
  apiRequest('/enrich/whois', { method: 'POST', body: { domain } })

// ─── Atribuição de domínio (WHOIS → IP → hosting/ipinfo) ─────────────────────
export interface AttributionResult {
  domain: string
  ip: string | null
  dns: Record<string, string[]>
  whois: {
    registrar?: string | null
    registrarId?: string | null
    abuseEmail?: string | null
    registrant?: { name?: string | null; org?: string | null; email?: string | null } | null
    created?: string | null
    expires?: string | null
    updated?: string | null
    status?: string[]
    nameservers?: string[]
  }
  hosting: {
    ip?: string
    hostname?: string | null
    asn?: string | null
    org?: string | null
    city?: string | null
    region?: string | null
    country?: string | null
    loc?: string | null
    postal?: string | null
    timezone?: string | null
  }
}
export const domainAttribution = (domain: string) =>
  apiRequest<AttributionResult>('/enrich/attribution', { method: 'POST', body: { domain } })

export const enrichSubdomains = (domain: string) =>
  apiRequest<{ names: string[]; sources_ok: string[]; sources_failed: string[] }>(
    '/enrich/subdomains',
    { method: 'POST', body: { domain } },
  )

export const enrichWayback = (domain: string) =>
  apiRequest<{ urls: Array<{ url: string; status: string | null; mime: string | null }> }>(
    '/enrich/wayback',
    { method: 'POST', body: { domain } },
  )

export const checkHost = (target: string, kind: string, maxNodes = 12) =>
  apiRequest('/checkhost', { method: 'POST', body: { target, kind, maxNodes } })

// ─── OSINT de e-mail / domínio ────────────────────────────────────────────────

export const hunterDomain = (domain: string) =>
  apiRequest('/osint/hunter/domain', { method: 'POST', body: { domain } })

export const hunterEmail = (email: string) =>
  apiRequest('/osint/hunter/email', { method: 'POST', body: { email } })

export const gravatar = (email: string) =>
  apiRequest('/osint/gravatar', { method: 'POST', body: { email } })

export const holehe = (email: string) =>
  apiRequest('/osint/holehe', { method: 'POST', body: { email } })

export const leaklookup = (query: string, type = 'email_address') =>
  apiRequest('/osint/leaklookup', { method: 'POST', body: { query, type } })

export const comb = (query: string) =>
  apiRequest('/osint/comb', { method: 'POST', body: { query } })

/** Agregado: Gravatar + Hunter + holehe + Leak-Lookup + COMB. */
export const emailIntel = (email: string) =>
  apiRequest('/osint/email', { method: 'POST', body: { email } })

export const godaddyListAbuse = () => apiRequest('/osint/godaddy/abuse')

export const godaddyCreateAbuse = (body: { type: string; source: string; target?: string }) =>
  apiRequest('/osint/godaddy/abuse', { method: 'POST', body })

// ─── WhatsMyName (username em ~700 sites, via SSE) ───────────────────────────

export interface WmnHit { name: string; cat: string; url: string; status?: number }
export interface WmnResult {
  username: string
  total: number
  checked: number
  errors: number
  found: WmnHit[]
  categories: string[]
}
export type WmnStreamEvent =
  | { type: 'progress'; checked: number; total: number; found: number }
  | { type: 'done'; result: WmnResult }
  | { type: 'error'; error: string }

export const getWmnCategories = () =>
  apiRequest<{ total: number; categories: string[] }>('/osint/whatsmyname/categories')

// ─── Service Scan ─────────────────────────────────────────────────────────────

export interface ServiceScanResult {
  host: string
  scannedPorts: number[]
  services: any[]
}
export const serviceScan = (host: string, ports?: number[]) =>
  apiRequest<ServiceScanResult>('/service-scan', { method: 'POST', body: { host, ports } })

// ─── Screenshot Engine ────────────────────────────────────────────────────────

export interface ShotResult {
  url: string; finalUrl?: string; title?: string; status?: number | null
  ok: boolean; width?: number; height?: number; server?: string | null
  screenshot?: string; via?: string; error?: string
}
export const captureScreenshot = (target: string, fullPage = false, proxy = false) =>
  apiRequest<ShotResult>('/screenshot', { method: 'POST', body: { target, fullPage, proxy } })

// ─── Content Discovery (Gobuster-like, via SSE) ──────────────────────────────

export interface FoundPath { path: string; url: string; status: number; size: number; redirect?: string | null; contentType?: string | null }
export interface ContentDiscoveryResult {
  target: string; baseUrl: string | null; total: number; tested: number
  wildcard: { detected: boolean; status?: number; size?: number }
  found: FoundPath[]; error?: string
}
export type ContentDiscoveryEvent =
  | { type: 'progress'; tested: number; total: number; found: number }
  | { type: 'done'; result: ContentDiscoveryResult }
  | { type: 'error'; error: string }

export const contentDiscoveryStream = (
  target: string,
  opts: { extensions?: string[]; status?: number[]; exclude?: number[]; wordlist?: string },
  onEvent: (e: ContentDiscoveryEvent) => void,
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams({ target })
  if (opts.wordlist) qs.set('wordlist', opts.wordlist)
  if (opts.extensions?.length) qs.set('extensions', opts.extensions.join(','))
  if (opts.status?.length) qs.set('status', opts.status.join(','))
  if (opts.exclude?.length) qs.set('exclude', opts.exclude.join(','))
  return apiStream(`/content-discovery/stream?${qs.toString()}`, onEvent, { signal })
}

// ─── Crawler (Katana-like, via SSE) ──────────────────────────────────────────

export interface CrawlResult {
  target: string; base: string | null; pagesVisited: number
  pages: { url: string; status: number; title: string | null; depth: number }[]
  internalLinks: string[]; externalLinks: string[]
  endpoints: string[]; forms: { page: string; action: string; method: string }[]
  emails: string[]; error?: string
}
export type CrawlEvent =
  | { type: 'progress'; visited: number; queued: number; endpoints: number }
  | { type: 'done'; result: CrawlResult }
  | { type: 'error'; error: string }

export const crawlerStream = (
  target: string,
  opts: { depth?: number; pages?: number },
  onEvent: (e: CrawlEvent) => void,
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams({ target })
  if (opts.depth) qs.set('depth', String(opts.depth))
  if (opts.pages) qs.set('pages', String(opts.pages))
  return apiStream(`/crawler/stream?${qs.toString()}`, onEvent, { signal })
}

// ─── WordPress Engine (WPScan-like, via SSE) ─────────────────────────────────

export interface WpUser { id?: number | null; login: string | null; displayName?: string | null; source: string }
export interface WpItem { slug: string; version: string | null; source: string; url?: string }
export interface WpFindingEntry { type: string; url: string; description: string; severity?: string }
export interface WpVuln { product: string; version: string | null; cve: string; source: string; severity?: string; score?: number | null }
export interface WpScanResult {
  target: string; baseUrl: string | null; isWordPress: boolean; confidence: number
  version: { number: string | null; confidence: number; source: string | null } | null
  users: WpUser[]; plugins: WpItem[]; themes: WpItem[]
  interesting: WpFindingEntry[]; configBackups: { url: string }[]; dbExports: { url: string }[]
  vulns: WpVuln[]; error?: string
}
export type WpScanEvent =
  | { type: 'phase'; phase: string; status?: string; done?: number; total?: number; label?: string }
  | { type: 'partial'; patch: Partial<WpScanResult> }
  | { type: 'done'; result: WpScanResult }
  | { type: 'error'; error: string }

export const wpscanStream = (
  target: string,
  opts: { aggressive?: boolean; proxy?: boolean },
  onEvent: (e: WpScanEvent) => void,
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams({ target })
  if (opts.aggressive === false) qs.set('aggressive', 'false')
  if (opts.proxy) qs.set('proxy', 'true')
  return apiStream(`/wpscan/stream?${qs.toString()}`, onEvent, { signal })
}

/** Roda o WhatsMyName e recebe o progresso (checked/total/found) em tempo real. */
export const whatsMyNameStream = (
  username: string,
  onEvent: (e: WmnStreamEvent) => void,
  categories?: string[],
  signal?: AbortSignal,
) => {
  const qs = new URLSearchParams({ username })
  if (categories?.length) qs.set('categories', categories.join(','))
  return apiStream(`/osint/whatsmyname/stream?${qs.toString()}`, onEvent, { signal })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export type TargetKind = 'ip' | 'domain' | 'cve' | 'unknown'

export function detectKind(value: string): TargetKind {
  const v = (value || '').trim()
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return 'ip'
  if (/^CVE-\d{4}-\d+$/i.test(v)) return 'cve'
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) return 'domain'
  return 'unknown'
}
