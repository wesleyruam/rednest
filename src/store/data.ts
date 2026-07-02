import { create } from 'zustand'
import type { Alert, Engagement, EngagementStatus, EngagementType, Operation, OperationPriority, OperationStatus, PlatformStats } from '@/types'
import * as opsApi from '@/services/operations'
import * as engApi from '@/services/engagements'
import * as core from '@/services/coredata'

interface DataState {
  operations: Operation[]
  engagements: Engagement[]
  alerts: Alert[]
  stats: PlatformStats | null
  loaded: boolean
  loading: boolean

  completedActions: Record<string, number[]>

  loadAll: () => Promise<void>
  refreshStats: () => Promise<void>

  addOperation: (data: {
    name: string; description: string; priority: OperationPriority
    status: 'active' | 'paused'; tags: string[]
  }) => Promise<string>

  updateOperation: (id: string, data: Partial<{
    name: string; description: string; priority: OperationPriority; tags: string[]; status: OperationStatus; progress: number
  }>) => Promise<void>

  addEngagement: (data: {
    operationId: string; name: string; target: string; type: EngagementType; tags: string[]
  }) => Promise<string>

  updateEngagement: (id: string, data: {
    name?: string; target?: string; type?: EngagementType; tags?: string[]; status?: EngagementStatus
  }) => Promise<void>

  replaceEngagement: (eng: Engagement) => void
  removeEngagement: (id: string) => Promise<void>
  toggleEngagementStatus: (id: string) => Promise<void>
  toggleAction: (engId: string, idx: number) => void
  markAlertRead: (alertId: string) => Promise<void>
  markAllAlertsRead: () => Promise<void>
}

export const useDataStore = create<DataState>((set, get) => ({
  operations: [],
  engagements: [],
  alerts: [],
  stats: null,
  loaded: false,
  loading: false,
  completedActions: {},

  loadAll: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      const [operations, engagements, alerts, stats] = await Promise.all([
        opsApi.listOperations(),
        engApi.listEngagements(),
        core.listAlerts(),
        core.getStats().catch(() => null),
      ])
      set({ operations, engagements, alerts, stats, loaded: true })
    } catch {
      set({ loaded: true })
    } finally {
      set({ loading: false })
    }
  },

  refreshStats: async () => {
    try {
      set({ stats: await core.getStats() })
    } catch {
      /* ignore */
    }
  },

  addOperation: async (data) => {
    const op = await opsApi.createOperation(data)
    set(s => ({ operations: [op, ...s.operations] }))
    void get().refreshStats()
    return op.id
  },

  updateOperation: async (id, data) => {
    const op = await opsApi.updateOperation(id, data)
    set(s => ({ operations: s.operations.map(o => (o.id === id ? op : o)) }))
  },

  addEngagement: async (data) => {
    const eng = await engApi.createEngagement(data)
    set(s => ({
      engagements: [eng, ...s.engagements],
      operations: s.operations.map(o =>
        o.id === data.operationId ? { ...o, engagementCount: o.engagementCount + 1 } : o,
      ),
    }))
    void get().refreshStats()
    return eng.id
  },

  updateEngagement: async (id, data) => {
    const eng = await engApi.updateEngagement(id, data)
    set(s => ({ engagements: s.engagements.map(e => (e.id === id ? eng : e)) }))
  },

  replaceEngagement: (eng) => {
    set(s => ({ engagements: s.engagements.map(e => (e.id === eng.id ? eng : e)) }))
  },

  removeEngagement: async (id) => {
    const eng = get().engagements.find(e => e.id === id)
    await engApi.deleteEngagement(id)
    set(s => ({
      engagements: s.engagements.filter(e => e.id !== id),
      operations: eng
        ? s.operations.map(o => (o.id === eng.operationId ? { ...o, engagementCount: Math.max(0, o.engagementCount - 1) } : o))
        : s.operations,
    }))
    void get().refreshStats()
  },

  toggleEngagementStatus: async (id) => {
    const eng = get().engagements.find(e => e.id === id)
    if (!eng) return
    const next = eng.status === 'active' ? 'paused' : 'active'
    const updated = await engApi.updateEngagementStatus(id, next)
    set(s => ({ engagements: s.engagements.map(e => (e.id === id ? { ...e, status: updated.status } : e)) }))
  },

  toggleAction: (engId, idx) => {
    set(s => {
      const arr = s.completedActions[engId] ?? []
      return {
        completedActions: {
          ...s.completedActions,
          [engId]: arr.includes(idx) ? arr.filter(i => i !== idx) : [...arr, idx],
        },
      }
    })
  },

  markAlertRead: async (alertId) => {
    set(s => ({ alerts: s.alerts.map(a => (a.id === alertId ? { ...a, acknowledged: true } : a)) }))
    try { await core.markAlertRead(alertId) } catch { /* ignore */ }
  },

  markAllAlertsRead: async () => {
    set(s => ({ alerts: s.alerts.map(a => ({ ...a, acknowledged: true })) }))
    try { await core.markAllAlertsRead() } catch { /* ignore */ }
  },
}))

export function useEngagementStatus(eng: Engagement) {
  const engagements = useDataStore(s => s.engagements)
  return engagements.find(e => e.id === eng.id)?.status ?? eng.status
}
