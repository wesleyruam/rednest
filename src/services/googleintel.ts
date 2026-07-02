import { apiRequest } from '@/lib/api'

export const getGoogleIntelStatus = () =>
  apiRequest<{ connected: boolean; stored: boolean }>('/google-intel/status')

export const connectGoogleIntel = (token: string) =>
  apiRequest<{ connected: boolean; email?: string; name?: string; error?: string }>(
    '/google-intel/connect',
    { method: 'POST', body: { token } },
  )

export const disconnectGoogleIntel = () =>
  apiRequest('/google-intel/connect', { method: 'DELETE' })
