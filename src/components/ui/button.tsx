import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:   'bg-rn-purple text-white hover:bg-rn-purple/90 hover:shadow-glow-purple',
        secondary: 'bg-white/5 text-rn-text border border-white/10 hover:bg-white/10',
        ghost:     'text-rn-muted hover:bg-white/5 hover:text-rn-text',
        danger:    'bg-rn-red/20 text-rn-red border border-rn-red/30 hover:bg-rn-red/30',
        outline:   'border border-white/10 text-rn-muted hover:bg-white/5 hover:text-rn-text',
        link:      'text-rn-purple underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-7 px-3 text-xs',
        lg:      'h-11 px-6',
        icon:    'h-9 w-9',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
