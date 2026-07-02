import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:  'border-transparent bg-rn-purple/20 text-rn-purple',
        critical: 'border-transparent bg-rn-red/20 text-rn-red',
        high:     'border-transparent bg-rn-red/10 text-rn-red/80',
        medium:   'border-transparent bg-rn-yellow/20 text-rn-yellow',
        low:      'border-transparent bg-rn-green/20 text-rn-green',
        info:     'border-transparent bg-rn-cyan/20 text-rn-cyan',
        blue:     'border-transparent bg-rn-blue/20 text-rn-blue',
        muted:    'border-white/5 bg-white/5 text-rn-muted',
        outline:  'border-white/10 text-rn-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
