import { useEffect } from 'react'
import { Titlebar } from '@/components/layout/Titlebar'
import { OpsSidebar } from '@/components/layout/OpsSidebar'
import { OperationsPanel } from '@/components/operations/OperationsPanel'
import { OperationDetail } from '@/components/operations/OperationDetail'
import { EngagementShell } from '@/pages/engagements/EngagementShell'
import { ApiKeysPage } from '@/pages/ApiKeysPage'
import { SettingsPage }  from '@/pages/SettingsPage'
import { IocPage }       from '@/pages/IocPage'
import { TimelinePage }  from '@/pages/TimelinePage'
import { ThreatFeedsPage } from '@/pages/ThreatFeedsPage'
import { VulnerabilitiesPage } from '@/pages/VulnerabilitiesPage'
import { ProxiesPage } from '@/pages/ProxiesPage'
import { LoginPage } from '@/pages/LoginPage'
import { GlobalSearch } from '@/components/GlobalSearch'
import { Notifications } from '@/components/Notifications'
import { Toast } from '@/components/Toast'
import { NewOpModal } from '@/components/modals/NewOpModal'
import { EditOpModal } from '@/components/modals/EditOpModal'
import { NewEngModal } from '@/components/modals/NewEngModal'
import { AboutModal } from '@/components/modals/AboutModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useAppStore } from '@/store/app'
import { useDataStore } from '@/store/data'
import { useUIStore } from '@/store/ui'
import { setUnauthorizedHandler } from '@/lib/api'

export default function App() {
  const { view, selectedEngId, selectedOpId, isAuthenticated, selectOperation } = useAppStore()
  const { engagements, operations, loadAll, loaded } = useDataStore()
  const { openGlobalSearch, closeGlobalSearch } = useUIStore()

  const engagement = selectedEngId ? engagements.find(e => e.id === selectedEngId) ?? null : null
  const operation  = selectedOpId  ? operations.find(o => o.id === selectedOpId) ?? null : null

  // Sessão expirada (401 irrecuperável) → derruba auth e volta ao login
  useEffect(() => {
    setUnauthorizedHandler(() => {
      useDataStore.setState({ loaded: false })
      useAppStore.getState().logout()
      useUIStore.getState().showToast('Sessão expirada. Faça login novamente.', 'error')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Carrega os dados do backend ao autenticar
  useEffect(() => {
    if (isAuthenticated && !loaded) void loadAll()
  }, [isAuthenticated, loaded])

  // Seleciona a primeira operação quando os dados chegam e nada está selecionado
  useEffect(() => {
    if (loaded && !selectedOpId && operations.length > 0) {
      selectOperation(operations[0].id)
    }
  }, [loaded, operations, selectedOpId])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        const state = useUIStore.getState()
        state.globalSearchOpen ? closeGlobalSearch() : openGlobalSearch()
      }
      if (e.key === 'Escape') {
        const state = useUIStore.getState()
        if (state.globalSearchOpen) state.closeGlobalSearch()
        else if (state.activeModal) state.closeModal()
        else if (state.notificationsOpen) state.closeNotifications()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!isAuthenticated) return <LoginPage />

  return (
    <div className="layout">
      {view === 'engagement' && engagement && operation
        ? <Titlebar mode="engagement" operation={operation} engagement={engagement} />
        : <Titlebar mode="operations" />
      }

      <div className="main-area">
        {view === 'api-keys' ? (
          <>
            <OpsSidebar />
            <ApiKeysPage />
          </>
        ) : view === 'settings' ? (
          <>
            <OpsSidebar />
            <SettingsPage />
          </>
        ) : view === 'iocs' ? (
          <>
            <OpsSidebar />
            <IocPage />
          </>
        ) : view === 'timeline' ? (
          <>
            <OpsSidebar />
            <TimelinePage />
          </>
        ) : view === 'threat-feeds' ? (
          <>
            <OpsSidebar />
            <ThreatFeedsPage />
          </>
        ) : view === 'vulnerabilities' ? (
          <>
            <OpsSidebar />
            <VulnerabilitiesPage />
          </>
        ) : view === 'proxies' ? (
          <>
            <OpsSidebar />
            <ProxiesPage />
          </>
        ) : view === 'operations' ? (
          <>
            <OpsSidebar />
            <OperationsPanel />
            <OperationDetail />
          </>
        ) : (
          <EngagementShell />
        )}
      </div>

      {/* Global overlays */}
      <GlobalSearch />
      <Notifications />
      <NewOpModal />
      <EditOpModal />
      <NewEngModal />
      <AboutModal />
      <ConfirmDialog />
      <Toast />
    </div>
  )
}
