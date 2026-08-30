import { Quote, Star } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Section, SectionHeading } from '@/components/ui/section'
import { REVIEWS } from '@/data/site'
import { plural } from '@/lib/utils'

function Stars({ score }) {
  const filled = Math.round(Number(score))
  return (
    <span className="flex items-center gap-0.5" aria-label={`${score} out of 5`}>
      {[0, 1, 2, 3, 4].map((index) => (
        <Star
          key={index}
          className={
            index < filled
              ? 'size-4 fill-[hsl(var(--highlight))] text-[hsl(var(--highlight))]'
              : 'size-4 text-border'
          }
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

export function Reviews() {
  return (
    <Section id="reviews">
      <SectionHeading eyebrow={REVIEWS.eyebrow} title={REVIEWS.headline} intro={REVIEWS.body} />

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
        <div className="flex flex-col gap-3">
          {REVIEWS.ratings.map((rating) => (
            <Card key={rating.source}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-display text-[1.9rem] font-bold leading-none tracking-tight tabular-nums">
                    {rating.score}
                  </p>
                  <p className="mt-1.5 text-[0.8rem] text-muted-foreground">
                    {plural(rating.count, 'review')} on {rating.source}
                  </p>
                </div>
                <Stars score={rating.score} />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {REVIEWS.items.length ? (
            REVIEWS.items.map((item) => (
              <Card key={item.quote} className="border-l-[3px] border-l-brand">
                <CardContent className="p-6">
                  <Quote className="size-5 text-brand" aria-hidden="true" />
                  <blockquote className="mt-3 font-display text-[1.05rem] font-medium leading-snug">
                    {item.quote}
                  </blockquote>
                  <figcaption className="mt-3 text-[0.8rem] text-muted-foreground">
                    {item.attribution}
                  </figcaption>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed bg-transparent shadow-none">
              <CardContent className="p-6">
                <p className="text-[0.95rem] leading-relaxed text-muted-foreground">
                  {REVIEWS.placeholder}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Section>
  )
}
