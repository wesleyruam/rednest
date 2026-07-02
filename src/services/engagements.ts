import { apiRequest, apiStream } from '@/lib/api'
import type { Engagement, EngagementStatus, EngagementType } from '@/types'

export interface CreateEngagementInput {
  operationId: string
  name: string
  target: string
  type: EngagementType
  tags?: string[]
}

export const listEngagements = (operationId?: string) =>
  apiRequest<Engagement[]>(
    `/engagements${operationId ? `?operationId=${operationId}` : ''}`,
  )
export const getEngagement = (id: string) => apiRequest<Engagement>(`/engagements/${id}`)
export const createEngagement = (data: CreateEngagementInput) =>
  apiRequest<Engagement>('/engagements', { method: 'POST', body: data })
export const updateEngagement = (
  id: string,
  data: Partial<Pick<Engagement, 'name' | 'target' | 'type' | 'tags' | 'status'>>,
) => apiRequest<Engagement>(`/engagements/${id}`, { method: 'PATCH', body: data })
export const updateEngagementStatus = (id: string, status: EngagementStatus) =>
  apiRequest<Engagement>(`/engagements/${id}/status`, { method: 'PATCH', body: { status } })
export const deleteEngagement = (id: string) =>
  apiRequest<void>(`/engagements/${id}`, { method: 'DELETE' })
/** Dispara o auto-enriquecimento por integrações e retorna o engagement atualizado. */
export const enrichEngagement = (id: string) =>
  apiRequest<Engagement>(`/engagements/${id}/enrich`, { method: 'POST' })

// ─── Auto-enriquecimento via SSE (pipeline ao vivo) ──────────────────────────

export type EnrichStreamEvent =
  | {
      type: 'start'
      target: string
      tokens: { idx: number; value: string; kind: string; note?: string }[]
      steps: { key: string; tokenIdx: number; label: string }[]
    }
  | {
      type: 'step'
      key: string
      status: 'running' | 'done' | 'error'
      result?: any
      error?: string
      progress?: { checked: number; total: number; found: number }
    }
  | { type: 'complete'; engagement: Engagement }
  | { type: 'error'; error: string }

/** Roda o auto-enriquecimento e recebe o progresso por integração em tempo real. */
export const enrichEngagementStream = (
  id: string,
  onEvent: (e: EnrichStreamEvent) => void,
  signal?: AbortSignal,
) => apiStream(`/engagements/${id}/enrich/stream`, onEvent, { signal })

// ─── Recon Pipeline (encadeia as engines, via SSE) ───────────────────────────

export type PipelinePhase = 'subdomains' | 'http' | 'servicescan' | 'screenshot' | 'vuln'
export type PipelineEvent =
  | { type: 'start'; phases: PipelinePhase[]; domains: string[] }
  | { type: 'phase'; phase: PipelinePhase; status: 'running' | 'done'; count?: number; techs?: string[]; kev?: number }
  | { type: 'progress'; phase: PipelinePhase; done: number; total: number; found?: number }
  | { type: 'complete'; summary: { subdomains: number; live: number; services: number; screenshots: number; cves: number; techs: string[] } }
  | { type: 'error'; error: string }

export const reconPipelineStream = (
  id: string,
  onEvent: (e: PipelineEvent) => void,
  signal?: AbortSignal,
) => apiStream(`/engagements/${id}/pipeline/stream`, onEvent, { signal })
