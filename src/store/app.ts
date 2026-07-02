import { create } from 'zustand'
import { hasSession, clearTokens } from '@/lib/api'

export type AppView = 'operations' | 'engagement' | 'api-keys' | 'settings' | 'iocs' | 'timeline' | 'threat-feeds' | 'vulnerabilities' | 'proxies'

interface AppState {
  isAuthenticated: boolean
  view: AppView
  selectedOpId: string
  selectedEngId: string | null
  engagementTab: string
  operationDetailTab: string

  login: () => void
  logout: () => void
  selectOperation: (id: string) => void
  openEngagement: (id: string) => void
  backToOperations: () => void
  openApiKeys: () => void
  openSettings: () => void
  openIocs: () => void
  openTimeline: () => void
  openThreatFeeds: () => void
  openVulnerabilities: () => void
  openProxies: () => void
  setEngagementTab: (tab: string) => void
  setOperationDetailTab: (tab: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: hasSession(),
  view: 'operations',
  selectedOpId: '',
  selectedEngId: null,
  engagementTab: 'Resumo',
  operationDetailTab: 'Visão Geral',

  login: () => set({ isAuthenticated: true }),
  logout: () => {
    clearTokens()
    set({ isAuthenticated: false, view: 'operations' })
  },

  selectOperation: (id) =>
    set({ selectedOpId: id, operationDetailTab: 'Visão Geral', view: 'operations' }),

  openEngagement: (id) =>
    set({ view: 'engagement', selectedEngId: id, engagementTab: 'Resumo' }),

  backToOperations: () =>
    set({ view: 'operations', selectedEngId: null }),

  openApiKeys: () =>
    set({ view: 'api-keys' }),

  openSettings: () =>
    set({ view: 'settings' }),

  openIocs: () =>
    set({ view: 'iocs' }),

  openTimeline: () =>
    set({ view: 'timeline' }),

  openThreatFeeds: () =>
    set({ view: 'threat-feeds' }),

  openVulnerabilities: () =>
    set({ view: 'vulnerabilities' }),

  openProxies: () =>
    set({ view: 'proxies' }),

  setEngagementTab: (tab) => set({ engagementTab: tab }),
  setOperationDetailTab: (tab) => set({ operationDetailTab: tab }),
}))
