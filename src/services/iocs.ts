import { apiRequest } from '@/lib/api'
import type { IOC, IOCThreatLevel, IOCType } from '@/types'

export interface CreateIocInput {
  value: string
  type: IOCType
  threatLevel: IOCThreatLevel
  operationId: string
  engagementId?: string
  tags?: string[]
  source?: string
  description?: string
}

export interface IocFilters {
  type?: IOCType
  threatLevel?: IOCThreatLevel
  operation?: string
  engagement?: string
  search?: string
}

export const listIocs = (f: IocFilters = {}) => {
  const qs = new URLSearchParams()
  if (f.type) qs.set('type', f.type)
  if (f.threatLevel) qs.set('threatLevel', f.threatLevel)
  if (f.operation) qs.set('operation', f.operation)
  if (f.engagement) qs.set('engagement', f.engagement)
  if (f.search) qs.set('search', f.search)
  const q = qs.toString()
  return apiRequest<IOC[]>(`/iocs${q ? `?${q}` : ''}`)
}
export const createIoc = (data: CreateIocInput) =>
  apiRequest<IOC>('/iocs', { method: 'POST', body: data })
export const deleteIoc = (id: string) =>
  apiRequest<void>(`/iocs/${id}`, { method: 'DELETE' })
/** Enriquece o IOC pelas integrações e persiste o resultado; retorna o IOC atualizado. */
export const enrichIoc = (id: string) =>
  apiRequest<IOC & { enrichment?: any }>(`/iocs/${id}/enrich`, { method: 'POST' })
