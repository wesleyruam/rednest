import { create } from 'zustand'

export type ModalType = 'new-op' | 'edit-op' | 'new-eng' | 'about'
export type FolderFilter = 'all' | 'active' | 'completed' | 'archived'

export interface ToastData {
  message: string
  type: 'success' | 'error' | 'info'
}

export interface ConfirmData {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

/** Tarefa de fundo em andamento (consulta demorada, enriquecimento, etc.). */
export interface ActivityTask {
  id: string
  label: string
  progress?: { done: number; total: number } | null
}

interface UIState {
  globalSearchOpen: boolean
  notificationsOpen: boolean
  activeModal: ModalType | null
  editingOpId: string | null
  newEngOpId: string | null
  filterFolder: FolderFilter
  toast: ToastData | null
  confirm: ConfirmData | null
  tasks: ActivityTask[]
  osintGraphFilter: string
  osintGraphExpanded: boolean

  openGlobalSearch: () => void
  closeGlobalSearch: () => void
  toggleNotifications: () => void
  closeNotifications: () => void
  openModal: (modal: ModalType, opId?: string) => void
  closeModal: () => void
  setFilterFolder: (f: FolderFilter) => void
  showToast: (message: string, type?: ToastData['type']) => void
  clearToast: () => void
  requestConfirm: (data: ConfirmData) => void
  closeConfirm: () => void
  startTask: (label: string) => string
  updateTask: (id: string, patch: Partial<Omit<ActivityTask, 'id'>>) => void
  endTask: (id: string) => void
  setOsintGraphFilter: (f: string) => void
  setOsintGraphExpanded: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  globalSearchOpen: false,
  notificationsOpen: false,
  activeModal: null,
  editingOpId: null,
  newEngOpId: null,
  filterFolder: 'all',
  toast: null,
  confirm: null,
  tasks: [],
  osintGraphFilter: 'Todos',
  osintGraphExpanded: false,

  openGlobalSearch: () => set({ globalSearchOpen: true, notificationsOpen: false }),
  closeGlobalSearch: () => set({ globalSearchOpen: false }),
  toggleNotifications: () => set(s => ({ notificationsOpen: !s.notificationsOpen, globalSearchOpen: false })),
  closeNotifications: () => set({ notificationsOpen: false }),

  openModal: (modal, opId) => set({
    activeModal: modal,
    editingOpId: modal === 'edit-op' ? (opId ?? null) : null,
    newEngOpId: modal === 'new-eng' ? (opId ?? null) : null,
    globalSearchOpen: false,
    notificationsOpen: false,
  }),
  closeModal: () => set({ activeModal: null, editingOpId: null, newEngOpId: null }),

  setFilterFolder: (f) => set({ filterFolder: f }),

  showToast: (message, type = 'info') => set({ toast: { message, type } }),
  clearToast: () => set({ toast: null }),

  requestConfirm: (data) => set({ confirm: data }),
  closeConfirm: () => set({ confirm: null }),

  startTask: (label) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set(s => ({ tasks: [...s.tasks, { id, label, progress: null }] }))
    return id
  },
  updateTask: (id, patch) => set(s => ({ tasks: s.tasks.map(t => (t.id === id ? { ...t, ...patch } : t)) })),
  endTask: (id) => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),

  setOsintGraphFilter: (f) => set({ osintGraphFilter: f }),
  setOsintGraphExpanded: (v) => set({ osintGraphExpanded: v }),
}))
