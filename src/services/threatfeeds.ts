import { apiRequest } from '@/lib/api'

export interface ThreatFeedItem {
  id: string
  source: string
  type: string
  key: string
  title: string
  url?: string | null
  iocType?: string | null
  indicator?: string | null
  vendor?: string | null
  product?: string | null
  severity?: string | null
  publishedAt?: string | null
  details?: any
  fetchedAt: string
}

export interface ThreatFeedStats {
  total: number
  kev: number
  iocs: number
  advisories: number
  ransomware: number
  sources: { source: string; count: number }[]
  lastSync: string | null
}

export const getThreatFeedStats = () => apiRequest<ThreatFeedStats>('/threat-feeds/stats')

export const listThreatFeed = (params: { type?: string; iocType?: string; source?: string; q?: string } = {}) => {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v) })
  const s = qs.toString()
  return apiRequest<ThreatFeedItem[]>(`/threat-feeds${s ? `?${s}` : ''}`)
}

export const syncThreatFeeds = () =>
  apiRequest<{ kev: number; rss: number; iocs: number }>('/threat-feeds/sync', { method: 'POST' })
