import { apiRequest } from '@/lib/api'

export type ComplaintStatus = 'draft' | 'submitted' | 'acknowledged' | 'in_review' | 'resolved' | 'rejected' | 'closed'
export type ComplaintPriority = 'critical' | 'high' | 'medium' | 'low'

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
  submittedAt: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ComplaintInput {
  operationId: string
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
  submittedAt?: string | null
  resolvedAt?: string | null
}

export interface ComplaintStats {
  total: number; resolved: number; open: number; rejected: number
  byStatus: Record<string, number>
}

export const listComplaints = (operationId: string) =>
  apiRequest<Complaint[]>(`/complaints?operationId=${operationId}`)
export const complaintStats = (operationId: string) =>
  apiRequest<ComplaintStats>(`/complaints/stats?operationId=${operationId}`)
export const createComplaint = (input: ComplaintInput) =>
  apiRequest<Complaint>('/complaints', { method: 'POST', body: input })
export const updateComplaint = (id: string, data: Partial<ComplaintInput>) =>
  apiRequest<Complaint>(`/complaints/${id}`, { method: 'PATCH', body: data })
export const deleteComplaint = (id: string) =>
  apiRequest<void>(`/complaints/${id}`, { method: 'DELETE' })
