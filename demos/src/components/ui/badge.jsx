import * as React from 'react'
import { cva } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-mono text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground shadow-sm',
        brand: 'border-transparent bg-brand-soft text-brand-ink',
        outline: 'border-border bg-transparent text-muted-foreground',
        highlight:
          'border-[hsl(var(--highlight)/0.4)] bg-[hsl(var(--highlight)/0.1)] text-[hsl(var(--highlight))]',
      },
      size: {
        default: 'px-3 py-1',
        lg: 'px-4 py-1.5 text-[0.8rem]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

function Badge({ className, variant, size, ...props }) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

export { Badge, badgeVariants }
