import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Every page section is one of these, so vertical rhythm and the container
 * width are set in a single place.
 */
const Section = React.forwardRef(({ className, id, tone = 'default', children, ...props }, ref) => {
  const tones = {
    default: 'bg-background',
    muted: 'border-y border-border bg-muted',
    brand: 'bg-brand-ink text-[hsl(var(--brand-soft))]',
  }

  return (
    <section ref={ref} id={id} className={cn(tones[tone], className)} {...props}>
      <div className="container py-16 sm:py-20 lg:py-24">{children}</div>
    </section>
  )
})
Section.displayName = 'Section'

const SectionHeading = React.forwardRef(
  ({ className, eyebrow, title, intro, align = 'left', ...props }, ref) => (
    <div
      ref={ref}
      className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}
      {...props}
    >
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="mt-3 text-[clamp(1.6rem,3.6vw,2.35rem)] font-bold leading-tight tracking-[-0.015em]">
        {title}
      </h2>
      {intro ? (
        <p className="mt-4 text-[1.02rem] leading-relaxed text-muted-foreground">{intro}</p>
      ) : null}
    </div>
  )
)
SectionHeading.displayName = 'SectionHeading'

export { Section, SectionHeading }
