import { apiRequest } from '@/lib/api'

export interface Person {
  id: string
  operationId: string
  engagementId: string | null
  name: string
  photo: string | null
  data: any
  createdAt: string
  updatedAt: string
}

export interface PersonInput {
  operationId: string
  engagementId?: string | null
  name?: string
  photo?: string | null
  data?: any
}

export const listPersons = (operationId: string, engagementId?: string) => {
  const qs = new URLSearchParams({ operationId })
  if (engagementId) qs.set('engagementId', engagementId)
  return apiRequest<Person[]>(`/persons?${qs.toString()}`)
}
export const getPerson = (id: string) => apiRequest<Person>(`/persons/${id}`)
export const createPerson = (input: PersonInput) => apiRequest<Person>('/persons', { method: 'POST', body: input })
export const updatePerson = (id: string, data: Partial<PersonInput>) => apiRequest<Person>(`/persons/${id}`, { method: 'PATCH', body: data })
export const deletePerson = (id: string) => apiRequest<void>(`/persons/${id}`, { method: 'DELETE' })
