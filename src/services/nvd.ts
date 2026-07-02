import { apiRequest } from '@/lib/api'

export interface Cve {
  id: string
  cveId: string
  published?: string | null
  lastModified?: string | null
  description: string
  cvssScore?: number | null
  cvssSeverity?: string | null
  cvssVector?: string | null
  cvssVersion?: string | null
  cwe?: string | null
  vendors: string[]
  products: string[]
  refs: string[]
}

export interface NvdStats {
  total: number
  severity: Record<string, number>
  cvss: Record<string, number>
  topVendors: { vendor: string; count: number }[]
  lastSync: string | null
}

export const getNvdStats = () => apiRequest<NvdStats>('/nvd/stats')

export const searchCves = (params: { cve?: string; q?: string; severity?: string; minScore?: number } = {}) => {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, String(v)) })
  const s = qs.toString()
  return apiRequest<Cve[]>(`/nvd/search${s ? `?${s}` : ''}`)
}

export const syncNvd = (days?: number) =>
  apiRequest<{ synced: number; pages: number }>(`/nvd/sync${days ? `?days=${days}` : ''}`, { method: 'POST' })
