import { useState } from 'react'
import { CheckCircle2, Clock, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BUSINESS, CONTACT } from '@/data/site'
import { telHref } from '@/lib/utils'

export function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const tel = telHref(BUSINESS.phone)

  function handleSubmit(event) {
    // No backend in a demo build. Wiring this to email and SMS is part of
    // the real engagement, so say so rather than faking a success state.
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <section id="contact" className="bg-brand-ink text-[hsl(var(--brand-soft))]">
      <div className="container grid grid-cols-1 items-start gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--highlight))]">
            {CONTACT.eyebrow}
          </p>
          <h2 className="mt-3 text-[clamp(1.7rem,4vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.02em] text-white">
            {CONTACT.headline}
          </h2>
          <p className="mt-4 max-w-[46ch] text-[1.02rem] leading-relaxed text-[hsl(var(--brand-soft)/0.8)]">
            {CONTACT.body}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {tel ? (
              <a
                href={tel}
                className="inline-flex w-fit items-center gap-3 text-[1.15rem] font-semibold tabular-nums text-white transition-colors hover:text-[hsl(var(--highlight))]"
              >
                <Phone className="size-4" />
                {BUSINESS.phone}
              </a>
            ) : (
              <p className="max-w-[42ch] text-[0.85rem] leading-relaxed text-[hsl(var(--brand-soft)/0.65)]">
                {CONTACT.noPhoneNote}
              </p>
            )}

            {BUSINESS.hours ? (
              <p className="inline-flex items-center gap-3 text-[0.9rem] text-[hsl(var(--brand-soft)/0.8)]">
                <Clock className="size-4" />
                {BUSINESS.hours}
              </p>
            ) : null}
          </div>
        </div>

        <div className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-7">
          {submitted ? (
            <div className="flex flex-col items-start gap-3 py-6">
              <CheckCircle2 className="size-8 text-[hsl(var(--highlight))]" />
              <p className="font-display text-lg font-semibold text-white">That is the idea.</p>
              <p className="text-[0.95rem] leading-relaxed text-[hsl(var(--brand-soft)/0.8)]">
                On a live site this request lands in your inbox and as a text, so you can reply
                from your phone between jobs. Nothing was sent from this demo.
              </p>
              <Button variant="inverted" size="sm" onClick={() => setSubmitted(false)}>
                Reset form
              </Button>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name" className="text-[hsl(var(--brand-soft)/0.7)]">
                  Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                  className="border-white/15 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-[hsl(var(--highlight))]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact" className="text-[hsl(var(--brand-soft)/0.7)]">
                  Phone or email
                </Label>
                <Input
                  id="contact"
                  name="contact"
                  autoComplete="tel"
                  placeholder="Best way to reach you"
                  className="border-white/15 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-[hsl(var(--highlight))]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="details" className="text-[hsl(var(--brand-soft)/0.7)]">
                  What do you need?
                </Label>
                <Textarea
                  id="details"
                  name="details"
                  placeholder={CONTACT.formPlaceholder}
                  className="border-white/15 bg-white/5 text-white placeholder:text-white/35 focus-visible:border-[hsl(var(--highlight))]"
                />
              </div>

              <Button type="submit" variant="inverted" size="lg" className="mt-1 w-full">
                {CONTACT.formButton}
              </Button>

              <p className="text-[0.72rem] leading-relaxed text-[hsl(var(--brand-soft)/0.5)]">
                Demo only. This form does not send anything yet.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
