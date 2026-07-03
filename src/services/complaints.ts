import { apiRequest } from '@/lib/api'

export type ComplaintStatus = 'draft' | 'submitted' | 'acknowledged' | 'in_review' | 'resolved' | 'rejected' | 'closed'
export type ComplaintPriority = 'critical' | 'high' | 'medium' | 'low'

export interface CEvent { id: string; at: string; type: string; title: string; description?: string; author?: string; meta?: string }
export interface CNote { id: string; at: string; author?: string; text: string }
export interface CAttachment { id: string; at: string; author?: string; name: string; url?: string }
export interface CData { events: CEvent[]; notes: CNote[]; attachments: CAttachment[] }

export interface Complaint {
  id: string
  operationId: string
  engagementId: string | null
  title: string
  target: string
  platform: string
  ticketId: string | null
  ticketUrl: string | null
  category: string | null
  status: ComplaintStatus
  priority: ComplaintPriority
  notes: string | null
  result: string | null
  data: CData | null
  submittedAt: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ComplaintInput {
  operationId?: string
  engagementId?: string | null
  title?: string
  target: string
  platform: string
  ticketId?: string | null
  ticketUrl?: string | null
  category?: string | null
  status?: ComplaintStatus
  priority?: ComplaintPriority
  notes?: string | null
  result?: string | null
  submittedAt?: string | null
  resolvedAt?: string | null
}

export interface ComplaintStats {
  total: number; open: number; inReview: number; resolved: number; rejected: number
  byStatus: Record<string, number>
  avgResolutionDays: number | null
}

export const listComplaints = (operationId: string) => apiRequest<Complaint[]>(`/complaints?operationId=${operationId}`)
export const complaintStats = (operationId: string) => apiRequest<ComplaintStats>(`/complaints/stats?operationId=${operationId}`)
export const createComplaint = (input: ComplaintInput) => apiRequest<Complaint>('/complaints', { method: 'POST', body: input })
export const updateComplaint = (id: string, data: Partial<ComplaintInput>) => apiRequest<Complaint>(`/complaints/${id}`, { method: 'PATCH', body: data })
export const deleteComplaint = (id: string) => apiRequest<void>(`/complaints/${id}`, { method: 'DELETE' })
export const addComplaintNote = (id: string, text: string) => apiRequest<Complaint>(`/complaints/${id}/notes`, { method: 'POST', body: { text } })
export const addComplaintAttachment = (id: string, name: string, url?: string) => apiRequest<Complaint>(`/complaints/${id}/attachments`, { method: 'POST', body: { name, url } })
export const addComplaintEvent = (id: string, title: string, description?: string) => apiRequest<Complaint>(`/complaints/${id}/events`, { method: 'POST', body: { title, description } })
