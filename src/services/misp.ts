import { apiRequest } from '@/lib/api'

export const mispPush = (operationId: string) =>
  apiRequest<{ ok?: boolean; eventId?: number; exported?: number; skipped?: number; configured?: boolean; error?: any }>(
    '/misp/push',
    { method: 'POST', body: { operationId } },
  )

export const mispPull = (operationId: string, opts: { type?: string; value?: string; limit?: number } = {}) =>
  apiRequest<{ ok?: boolean; imported?: number; skipped?: number; fetched?: number; configured?: boolean; error?: any }>(
    '/misp/pull',
    { method: 'POST', body: { operationId, ...opts } },
  )
