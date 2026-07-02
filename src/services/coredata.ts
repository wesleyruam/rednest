import { apiRequest, apiStream } from '@/lib/api'
import type { Alert, PlatformStats, TimelineEvent } from '@/types'

// ─── Timeline ─────────────────────────────────────────────────────────────────
export const listTimeline = (operationId?: string) =>
  apiRequest<TimelineEvent[]>(
    `/timeline${operationId ? `?operationId=${operationId}` : ''}`,
  )

export const listEngagementTimeline = (engagementId: string) =>
  apiRequest<TimelineEvent[]>(`/timeline?engagementId=${engagementId}`)

/** Timeline em tempo real (Investigation Event Bus) via SSE. */
export const streamEngagementTimeline = (
  engagementId: string,
  onEvent: (ev: TimelineEvent) => void,
  signal?: AbortSignal,
) => apiStream(`/timeline/stream?engagementId=${engagementId}`, onEvent, { signal })

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const listAlerts = () => apiRequest<Alert[]>('/alerts')
export const markAlertRead = (id: string) =>
  apiRequest<Alert>(`/alerts/${id}/read`, { method: 'PATCH' })
export const markAllAlertsRead = (operationId?: string) =>
  apiRequest<{ updated: number }>(
    `/alerts/read-all${operationId ? `?operationId=${operationId}` : ''}`,
    { method: 'PATCH' },
  )

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const getStats = () => apiRequest<PlatformStats>('/dashboard/stats')

// ─── Observabilidade ──────────────────────────────────────────────────────────
export interface HealthStatus {
  status: 'ok' | 'degraded'
  uptimeSeconds: number
  checks: Record<string, string>
}
export interface QueueStats {
  queue: string
  connected: boolean
  counts: Record<string, number>
}
export const getHealth = () => apiRequest<HealthStatus>('/health')
export const getQueueStats = () => apiRequest<QueueStats>('/admin/queue-stats')
