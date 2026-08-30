import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'

import { cn } from '@/lib/utils'

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'font-mono text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground',
      className
    )}
    {...props}
  />
))
Label.displayName = 'Label'

export { Label }
