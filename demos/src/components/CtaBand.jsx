import { ArrowRight, Check, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BUSINESS, CTA } from '@/data/site'
import { telHref } from '@/lib/utils'

/**
 * Sits directly under the hero. One offer, one action, no competing links.
 */
export function CtaBand() {
  const tel = telHref(BUSINESS.phone)

  return (
    <section id="offer" className="border-y border-border bg-brand text-primary-foreground">
      <div className="container py-12 sm:py-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="max-w-xl">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
              {CTA.eyebrow}
            </p>
            <h2 className="mt-3 text-[clamp(1.5rem,3.4vw,2.1rem)] font-bold leading-tight tracking-[-0.015em] text-primary-foreground">
              {CTA.headline}
            </h2>
            <p className="mt-3 text-[1rem] leading-relaxed text-primary-foreground/80">
              {CTA.body}
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-4">
            <ul className="flex flex-col gap-2">
              {CTA.points.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-2.5 text-[0.92rem] text-primary-foreground/85"
                >
                  <Check className="size-4 shrink-0" strokeWidth={3} />
                  {point}
                </li>
              ))}
            </ul>

            {/*
              With a phone on file the call is the primary action and the form
              is the fallback. Without one, a second button would just repeat
              the first, so only the form is offered.
            */}
            <div className="flex flex-col gap-2.5 sm:flex-row">
              {tel ? (
                <>
                  <Button asChild size="lg" variant="inverted" className="w-full sm:w-auto">
                    <a href={tel}>
                      <Phone className="size-4" />
                      Call {BUSINESS.phone}
                    </a>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="ghost"
                    className="w-full text-primary-foreground hover:bg-white/10 sm:w-auto"
                  >
                    <a href="#contact">
                      Or send a message
                      <ArrowRight className="size-4" />
                    </a>
                  </Button>
                </>
              ) : (
                <Button asChild size="lg" variant="inverted" className="w-full sm:w-auto">
                  <a href="#contact">
                    {CTA.primary}
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
