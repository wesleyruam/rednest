import { apiRequest } from '@/lib/api'

export interface Finding {
  id: string
  engagementId: string
  type: string
  value: string
  label?: string | null
  source?: string | null
  target?: string | null
  severity?: string | null
  data?: any
  createdAt: string
}

export const listFindings = (engagementId: string, type?: string) =>
  apiRequest<Finding[]>(`/engagements/${engagementId}/findings${type ? `?type=${type}` : ''}`)

export const getFindingCounts = (engagementId: string) =>
  apiRequest<Record<string, number>>(`/engagements/${engagementId}/findings/counts`)

/** Envia o resultado de uma ferramenta manual para extração+persistência de achados. */
export const ingestFindings = (engagementId: string, tool: string, target: string, result: any) =>
  apiRequest<{ saved: number; total: number }>(`/engagements/${engagementId}/findings/ingest`, {
    method: 'POST',
    body: { tool, target, result },
  }).catch(() => ({ saved: 0, total: 0 }))

export const deleteFinding = (engagementId: string, findingId: string) =>
  apiRequest(`/engagements/${engagementId}/findings/${findingId}`, { method: 'DELETE' })

/** Adiciona um achado manualmente (ex.: uma rede social encontrada à mão). */
export const addFinding = (engagementId: string, input: { type: string; value: string; label?: string; url?: string; target?: string; severity?: string; note?: string }) =>
  apiRequest<Finding>(`/engagements/${engagementId}/findings`, { method: 'POST', body: input })
