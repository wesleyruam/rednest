import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  color?: 'purple' | 'cyan' | 'green' | 'yellow' | 'red' | 'blue'
  trend?: { value: number; label: string }
  className?: string
}

const colorMap = {
  purple: { icon: 'text-rn-purple', bg: 'bg-rn-purple/10', glow: 'hover:shadow-glow-purple' },
  cyan:   { icon: 'text-rn-cyan',   bg: 'bg-rn-cyan/10',   glow: 'hover:shadow-glow-cyan' },
  green:  { icon: 'text-rn-green',  bg: 'bg-rn-green/10',  glow: 'hover:shadow-glow-green' },
  yellow: { icon: 'text-rn-yellow', bg: 'bg-rn-yellow/10', glow: '' },
  red:    { icon: 'text-rn-red',    bg: 'bg-rn-red/10',    glow: 'hover:shadow-glow-red' },
  blue:   { icon: 'text-rn-blue',   bg: 'bg-rn-blue/10',   glow: '' },
}

export function StatCard({ label, value, icon: Icon, color = 'purple', trend, className }: StatCardProps) {
  const c = colorMap[color]
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'relative rounded-lg border border-white/5 bg-rn-surface p-5 transition-shadow duration-200',
        c.glow,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-rn-muted mb-1">{label}</p>
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-rn-text tabular-nums"
          >
            {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
          </motion.p>
          {trend && (
            <p className={cn('text-xs mt-1', trend.value >= 0 ? 'text-rn-green' : 'text-rn-red')}>
              {trend.value >= 0 ? '+' : ''}{trend.value} {trend.label}
            </p>
          )}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0', c.bg)}>
          <Icon className={cn('h-5 w-5', c.icon)} />
        </div>
      </div>
    </motion.div>
  )
}
