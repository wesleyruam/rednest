import { apiRequest } from '@/lib/api'
import type { Operation, OperationPriority } from '@/types'

export interface CreateOperationInput {
  name: string
  description?: string
  priority?: OperationPriority
  status?: 'active' | 'paused'
  tags?: string[]
}

export interface UpdateOperationInput {
  name?: string
  description?: string
  priority?: OperationPriority
  tags?: string[]
  status?: Operation['status']
  progress?: number
}

export const listOperations = () => apiRequest<Operation[]>('/operations')
export const getOperation = (id: string) => apiRequest<Operation>(`/operations/${id}`)
export const createOperation = (data: CreateOperationInput) =>
  apiRequest<Operation>('/operations', { method: 'POST', body: data })
export const updateOperation = (id: string, data: UpdateOperationInput) =>
  apiRequest<Operation>(`/operations/${id}`, { method: 'PATCH', body: data })
export const deleteOperation = (id: string) =>
  apiRequest<void>(`/operations/${id}`, { method: 'DELETE' })
