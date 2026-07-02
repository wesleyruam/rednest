import { apiRequest } from '@/lib/api'

export type NotePriority = 'low' | 'medium' | 'high' | 'critical'
export type NoteStatus = 'open' | 'doing' | 'done'

export interface Note {
  id: string
  operationId: string
  engagementId: string | null
  title: string
  body: string
  priority: NotePriority
  status: NoteStatus
  dueAt: string | null
  authorId: string | null
  createdAt: string
  updatedAt: string
}

export interface NoteInput {
  operationId: string
  engagementId?: string
  title?: string
  body?: string
  priority?: NotePriority
  status?: NoteStatus
  dueAt?: string | null
}

export const listNotes = (operationId: string, engagementId?: string) => {
  const qs = new URLSearchParams({ operationId })
  if (engagementId) qs.set('engagementId', engagementId)
  return apiRequest<Note[]>(`/notes?${qs.toString()}`)
}
export const createNote = (input: NoteInput) =>
  apiRequest<Note>('/notes', { method: 'POST', body: input })
export const updateNote = (id: string, data: Partial<NoteInput>) =>
  apiRequest<Note>(`/notes/${id}`, { method: 'PATCH', body: data })
export const deleteNote = (id: string) =>
  apiRequest<void>(`/notes/${id}`, { method: 'DELETE' })
