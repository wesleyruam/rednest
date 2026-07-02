import { motion } from 'framer-motion'
import { AlertTriangle, Shield, Globe, User, Database, Bell, FileText, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TimelineEvent, IOCThreatLevel } from '@/types'

const eventIcon: Record<string, React.ElementType> = {
  alert_triggered:    AlertTriangle,
  ioc_added:          Shield,
  domain_found:       Globe,
  profile_found:      User,
  leak_found:         Database,
  evidence_collected: FileText,
  operation_created:  Plus,
  engagement_created: Plus,
  note_added:         FileText,
  monitoring_alert:   Bell,
}

const severityColors: Record<IOCThreatLevel, string> = {
  critical:      'text-rn-red border-rn-red/40 bg-rn-red/10',
  high:          'text-rn-red/70 border-rn-red/20 bg-rn-red/5',
  medium:        'text-rn-yellow border-rn-yellow/40 bg-rn-yellow/10',
  low:           'text-rn-green border-rn-green/40 bg-rn-green/10',
  informational: 'text-rn-muted border-white/10 bg-white/5',
}

const lineColors: Record<IOCThreatLevel, string> = {
  critical:      'bg-rn-red/40',
  high:          'bg-rn-red/20',
  medium:        'bg-rn-yellow/30',
  low:           'bg-rn-green/30',
  informational: 'bg-white/10',
}

interface TimelineProps {
  events: TimelineEvent[]
  limit?: number
}

export function Timeline({ events, limit }: TimelineProps) {
  const displayed = limit ? events.slice(0, limit) : events

  return (
    <div className="relative space-y-0">
      {displayed.map((event, i) => {
        const Icon = eventIcon[event.type] ?? Bell
        const severity = event.severity ?? 'informational'
        const colors = severityColors[severity]
        const lineColor = lineColors[severity]
        const isLast = i === displayed.length - 1

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className="relative flex gap-3 pl-1"
          >
            {/* timeline line */}
            {!isLast && (
              <div className={cn('absolute left-[18px] top-8 bottom-0 w-px', lineColor)} />
            )}

            {/* icon */}
            <div className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] mt-3', colors)}>
              <Icon className="h-3.5 w-3.5" />
            </div>

            {/* content */}
            <div className="flex-1 min-w-0 pb-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-rn-text leading-tight">{event.title}</p>
                <time className="text-[10px] text-rn-muted whitespace-nowrap tabular-nums mt-0.5">
                  {new Date(event.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              <p className="text-xs text-rn-muted mt-0.5 leading-relaxed">{event.description}</p>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
