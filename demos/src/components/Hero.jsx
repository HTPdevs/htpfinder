import { ArrowRight, Phone, Star } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BUSINESS, CTA, DESIGN, HERO } from '@/data/site'
import { plural, telHref } from '@/lib/utils'

export function Hero() {
  const tel = telHref(BUSINESS.phone)

  return (
    <section id="top" className="relative isolate overflow-hidden">
      <div aria-hidden="true" className={`motif-${DESIGN.motif} absolute inset-0 -z-10 opacity-[0.55]`} />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-[hsl(var(--background)/0.3)] via-[hsl(var(--background)/0.7)] to-background"
      />

      <div className="container flex flex-col items-center py-16 text-center sm:py-20 lg:py-28">
        <p className="eyebrow">{HERO.eyebrow}</p>

        <h1 className="mt-4 max-w-[19ch] text-[clamp(2rem,6.2vw,3.6rem)] font-bold leading-[1.06] tracking-[-0.02em]">
          {HERO.headline}
        </h1>

        <p className="mt-5 max-w-[54ch] text-[1.02rem] leading-relaxed text-muted-foreground sm:text-[1.1rem]">
          {HERO.subhead}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {HERO.rating ? (
            <Badge variant="highlight" size="lg">
              <Star className="size-3.5 fill-current" />
              {HERO.rating.score} from {plural(HERO.rating.count, 'review')} on {HERO.rating.source}
            </Badge>
          ) : null}
          {HERO.chips.map((chip) => (
            <Badge key={chip} size="lg">
              {chip}
            </Badge>
          ))}
        </div>

        <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href={tel || '#contact'}>
              {tel ? <Phone className="size-4" /> : null}
              {tel ? `Call ${BUSINESS.phone}` : CTA.primary}
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <a href="#about">
              {CTA.secondary}
              <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>

        {HERO.footnote ? (
          <p className="mt-5 text-[0.85rem] text-muted-foreground">{HERO.footnote}</p>
        ) : null}
      </div>
    </section>
  )
}
