export { mockOperations } from './operations'
export { mockEngagements } from './engagements'
export { mockEvents } from './events'
export { mockAlerts } from './alerts'
export { mockIOCs } from './iocs'

import { mockOperations } from './operations'
import { mockAlerts } from './alerts'
import type { PlatformStats } from '@/types'

export const platformStats: PlatformStats = {
  operations: mockOperations.length,
  activeOperations: mockOperations.filter(o => o.status === 'active').length,
  engagements: mockOperations.reduce((a, o) => a + o.engagementCount, 0),
  targetsMonitored: 0,
  activeAlerts: mockAlerts.filter(a => !a.acknowledged).length,
  reports: 0,
}
