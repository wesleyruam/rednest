import { apiRequest } from '@/lib/api'

export type MonitorKind = 'http_content' | 'ioc_recheck'

export interface Monitor {
  id: string
  operationId: string
  engagementId: string | null
  iocId: string | null
  kind: MonitorKind
  target: string
  intervalMinutes: number
  active: boolean
  useProxy?: boolean
  lastRunAt: string | null
  lastValue: string | null
  lastStatus: string | null
  createdAt: string
}

export interface CreateMonitorInput {
  operationId: string
  engagementId?: string
  kind: MonitorKind
  target: string
  intervalMinutes?: number
  useProxy?: boolean
}

export const listMonitors = (operationId?: string) =>
  apiRequest<Monitor[]>(`/monitors${operationId ? `?operationId=${operationId}` : ''}`)

export const createMonitor = (input: CreateMonitorInput) =>
  apiRequest<Monitor>('/monitors', { method: 'POST', body: input })

export const toggleMonitor = (id: string) =>
  apiRequest<Monitor>(`/monitors/${id}/toggle`, { method: 'PATCH' })

export const updateMonitor = (id: string, data: { intervalMinutes?: number; active?: boolean; useProxy?: boolean }) =>
  apiRequest<Monitor>(`/monitors/${id}`, { method: 'PATCH', body: data })

export const runMonitor = (id: string) =>
  apiRequest<Monitor>(`/monitors/${id}/run`, { method: 'POST' })

export const deleteMonitor = (id: string) =>
  apiRequest<void>(`/monitors/${id}`, { method: 'DELETE' })

export interface MonitorRun {
  id: string
  status: 'ok' | 'changed' | 'error'
  httpStatus: number | null
  contentHash: string | null
  contentLength: number | null
  changed: boolean
  diff: { addedLines: number; removedLines: number; addedSample: string[]; removedSample: string[] } | null
  screenshot: string | null
  content: string | null
  note: string | null
  createdAt: string
}

export const listMonitorRuns = (id: string) =>
  apiRequest<MonitorRun[]>(`/monitors/${id}/runs`)
