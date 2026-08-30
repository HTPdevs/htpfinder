import { Check, MapPin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Section, SectionHeading } from '@/components/ui/section'
import { ABOUT } from '@/data/site'
import { getIcon } from '@/lib/icons'

export function About() {
  return (
    <Section id="about" tone="muted">
      <SectionHeading eyebrow={ABOUT.eyebrow} title={ABOUT.headline} intro={ABOUT.body} />

      <div className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <ul className="flex flex-col gap-4">
          {ABOUT.points.map((point) => (
            <li key={point.title} className="flex gap-3.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-[0.98rem] font-semibold">{point.title}</p>
                <p className="mt-0.5 text-[0.95rem] leading-relaxed text-muted-foreground">
                  {point.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-3">
          {ABOUT.stats.map((stat) => (
            <Card key={stat.label} className="bg-brand-soft/60">
              <CardContent className="p-5">
                <p className="font-display text-[clamp(1.5rem,4vw,2rem)] font-bold leading-none tracking-tight text-brand-ink tabular-nums">
                  {stat.value}
                </p>
                <p className="mt-2 text-[0.7rem] font-semibold uppercase leading-snug tracking-[0.1em] text-brand-ink/70">
                  {stat.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-14">
        <h3 className="text-[1.2rem] font-semibold tracking-tight">{ABOUT.servicesHeadline}</h3>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ABOUT.services.map((service) => {
            const Icon = getIcon(service.icon)
            return (
              <Card
                key={service.title}
                className="transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
              >
                <CardHeader>
                  <span className="flex size-10 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="mt-2">{service.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{service.blurb}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="mt-14">
        <h3 className="text-[1.2rem] font-semibold tracking-tight">{ABOUT.areaHeadline}</h3>
        <p className="mt-3 max-w-2xl text-[1rem] leading-relaxed text-muted-foreground">
          {ABOUT.areaBody}
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {ABOUT.places.map((place) => (
            <li key={place}>
              <Badge size="lg" className="gap-2">
                <MapPin className="size-3.5 text-brand" />
                {place}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
