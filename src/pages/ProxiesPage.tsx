import { ProxiesTab } from '@/components/operations/ProxiesTab'

export function ProxiesPage() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--bg-base)', padding: '18px 24px' }}>
      <ProxiesTab />
    </div>
  )
}
