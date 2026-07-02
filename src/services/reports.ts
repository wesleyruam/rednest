import { apiRequest, apiDownload } from '@/lib/api'

export interface Report {
  id: string
  operationId: string | null
  name: string
  format: string
  size: number
  createdAt: string
}

export const listReports = (operationId?: string) =>
  apiRequest<Report[]>(`/reports${operationId ? `?operationId=${operationId}` : ''}`)

export const generateReport = (operationId: string) =>
  apiRequest<Report>('/reports', { method: 'POST', body: { operationId } })

export const downloadReport = (id: string, name: string) =>
  apiDownload(`/reports/${id}/download`, `${name}.pdf`)

export const deleteReport = (id: string) =>
  apiRequest<void>(`/reports/${id}`, { method: 'DELETE' })
