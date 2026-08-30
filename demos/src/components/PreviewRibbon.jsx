import { BUSINESS } from '@/data/site'

/**
 * Honest framing: this page is a pitch, not a live site. Keeping the ribbon
 * on every demo means a prospect can never mistake it for something already
 * published under their name.
 */
export function PreviewRibbon() {
  return (
    <div className="bg-brand-ink px-4 py-2.5 text-center text-[0.75rem] leading-snug text-[hsl(var(--brand-soft))] sm:text-[0.8rem]">
      <span className="font-semibold text-[hsl(var(--highlight))]">&gt; HTPdevs</span>
      <span className="mx-2 opacity-40">/</span>
      <span>
        Concept preview for <span className="font-semibold">{BUSINESS.name}</span>, not a live
        site
      </span>
    </div>
  )
}
