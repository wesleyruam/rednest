import { apiRequest } from '@/lib/api'

export const getTelegramStatus = () =>
  apiRequest<{ configured: boolean }>('/notifications/telegram')

export const setTelegram = (token: string, chatId: string) =>
  apiRequest<{ ok: boolean; error?: string }>('/notifications/telegram', { method: 'POST', body: { token, chatId } })

export const clearTelegram = () =>
  apiRequest('/notifications/telegram', { method: 'DELETE' })

export const testTelegram = () =>
  apiRequest<{ ok: boolean; error?: string }>('/notifications/telegram/test', { method: 'POST' })

export const sendTelegram = (text: string) =>
  apiRequest<{ ok: boolean; error?: string }>('/notifications/telegram/send', { method: 'POST', body: { text } })
