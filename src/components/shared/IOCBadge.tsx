import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { IOCType, IOCThreatLevel } from '@/types'

const typeLabels: Record<IOCType, string> = {
  domain:      'DOMAIN',
  ip:          'IP',
  email:       'EMAIL',
  url:         'URL',
  hash_md5:    'MD5',
  hash_sha1:   'SHA1',
  hash_sha256: 'SHA256',
  username:    'USERNAME',
  phone:       'PHONE',
  cve:         'CVE',
  wallet:      'WALLET',
  asn:         'ASN',
}

const threatVariant: Record<IOCThreatLevel, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
  critical:      'critical',
  high:          'high',
  medium:        'medium',
  low:           'low',
  informational: 'info',
}

interface IOCBadgeProps {
  type: IOCType
  threatLevel?: IOCThreatLevel
  className?: string
}

export function IOCTypeBadge({ type, className }: Pick<IOCBadgeProps, 'type' | 'className'>) {
  return (
    <Badge variant="blue" className={cn('font-mono text-[10px]', className)}>
      {typeLabels[type]}
    </Badge>
  )
}

export function ThreatBadge({ threatLevel, className }: Pick<IOCBadgeProps, 'threatLevel' | 'className'>) {
  if (!threatLevel) return null
  return (
    <Badge variant={threatVariant[threatLevel]} className={cn('uppercase text-[10px]', className)}>
      {threatLevel}
    </Badge>
  )
}

export function IOCBadge({ type, threatLevel, className }: IOCBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <IOCTypeBadge type={type} />
      {threatLevel && <ThreatBadge threatLevel={threatLevel} />}
    </span>
  )
}
