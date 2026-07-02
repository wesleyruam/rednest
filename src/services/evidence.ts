import { apiRequest, apiUpload, apiDownload } from '@/lib/api'

export interface Evidence {
  id: string
  operationId: string | null
  engagementId: string | null
  name: string
  originalName: string
  mimeType: string
  size: number
  description: string
  tags: string[]
  createdAt: string
}

export const listEvidence = (f: { operationId?: string; engagementId?: string } = {}) => {
  const qs = new URLSearchParams()
  if (f.operationId) qs.set('operationId', f.operationId)
  if (f.engagementId) qs.set('engagementId', f.engagementId)
  const q = qs.toString()
  return apiRequest<Evidence[]>(`/evidence${q ? `?${q}` : ''}`)
}

export const uploadEvidence = (
  file: File,
  meta: { operationId?: string; engagementId?: string; description?: string; tags?: string },
) => {
  const fd = new FormData()
  fd.append('file', file)
  if (meta.operationId) fd.append('operationId', meta.operationId)
  if (meta.engagementId) fd.append('engagementId', meta.engagementId)
  if (meta.description) fd.append('description', meta.description)
  if (meta.tags) fd.append('tags', meta.tags)
  return apiUpload<Evidence>('/evidence', fd)
}

export const downloadEvidence = (id: string, name: string) =>
  apiDownload(`/evidence/${id}/download`, name)

export const deleteEvidence = (id: string) =>
  apiRequest<void>(`/evidence/${id}`, { method: 'DELETE' })
