import { apiRequest } from '@/lib/api'

export interface Entity {
  type: string
  value: string
  label?: string | null
  firstSeen: string
  lastSeen: string
  sources: string[]
  engagementCount: number
  occurrences: number
  severity?: string | null
  tags: string[]
  status: string
  target?: string | null
  data?: any
}

/** Entidades unificadas (Alvos) da operação — agregadas das Findings, sem duplicação. */
export const listEntities = (operationId: string, type?: string) =>
  apiRequest<Entity[]>(`/operations/${operationId}/entities${type ? `?type=${type}` : ''}`)

export const getEntityCounts = (operationId: string) =>
  apiRequest<Record<string, number>>(`/operations/${operationId}/entities/counts`)

export interface EntityGraph {
  nodes: { id: string; type: string; label: string; severity: string | null }[]
  edges: { source: string; target: string }[]
}
export const getEntityGraph = (operationId: string) =>
  apiRequest<EntityGraph>(`/operations/${operationId}/entities/graph`)

export interface ThreatScore {
  score: number
  band: string
  color: string
  factors: string[]
  breakdown: Record<string, number>
}
export const getThreatScore = (operationId: string) =>
  apiRequest<ThreatScore>(`/operations/${operationId}/entities/threat-score`)
