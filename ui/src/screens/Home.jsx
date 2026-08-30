import { useState } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'

import { Button, Empty, Field, Hint, Input, Note, Score, Select } from '../components/ui.jsx'

/**
 * The way in.
 *
 * One question gets asked here, and it is the one this tool exists to answer:
 * which trade, and where. Everything else, the limits, the recorded sweeps, the
 * site check, lives on the Find screen for the run where it matters. The form
 * hands off through the hash query rather than running the sweep itself, so a
 * live search still takes a deliberate second click on a screen that shows what
 * it is about to spend.
 */
export default function Home({ state, go }) {
  const [industry, setIndustry] = useState(state.industries[0]?.id || '')
  const [near, setNear] = useState('')

  const ready = Boolean(industry && near.trim())
  const ranked = [...state.prospects].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const built = state.prospects.filter((prospect) => prospect.demo?.built).length
  const needCopy = state.prospects.filter((prospect) => prospect.status === 'collected').length

  function submit(event) {
    event.preventDefault()
    if (!ready) return
    go(`/collect?industry=${encodeURIComponent(industry)}&near=${encodeURIComponent(near.trim())}`)
  }

  return (
    <div className="space-y-10">
      <section className="pt-6 sm:pt-10">
        <p className="eyebrow">Local prospecting</p>
        <h1 className="mt-3 max-w-3xl font-display text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
          Find the businesses with no website,
          <span className="text-signal"> then show them one</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
          Sweep a trade in one place, keep only the businesses whose listed site is missing, parked
          or dead, and turn what is public about them into a demo page that invents nothing.
        </p>

        <form onSubmit={submit} className="panel mt-7 space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-end">
            <Field label="Trade">
              <Select value={industry} onChange={(event) => setIndustry(event.target.value)}>
                {state.industries.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Near">
              <Input
                placeholder="Portland, OR"
                value={near}
                onChange={(event) => setNear(event.target.value)}
              />
            </Field>

            <Button type="submit" variant="primary" disabled={!ready} className="h-[38px] px-4">
              Find prospects
              <ArrowRight size={15} />
            </Button>
          </div>

          <p className="text-xs text-text-faint">
            Nothing is searched yet. The next screen shows the sweep and what it will cost before
            anything runs.{' '}
            <a href="#/collect" className="text-signal hover:underline">
              Or open the full options
            </a>
          </p>
        </form>

        {!state.placesKey && (
          <Note tone="warn" title="No Google Places key">
            Live search needs <code className="command">GOOGLE_PLACES_API_KEY</code> in your .env.
            Until then, open{' '}
            <a href="#/collect" className="text-signal hover:underline">
              Find
            </a>{' '}
            and pick a recorded sweep to try this out offline.
          </Note>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Prospects" value={state.prospects.length} href="#/prospects">
          Businesses found so far whose listed website is missing, parked or broken.
        </Stat>
        <Stat label="Waiting on copy" value={needCopy} href="#/prospects">
          Found, but with no words written for their page yet. Open one and press Write the copy.
        </Stat>
        <Stat label="Demo sites built" value={built} href="#/prospects">
          Prospects with a finished page you can open and send.
        </Stat>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="eyebrow">Best prospects so far</h2>
          <a href="#/prospects" className="text-xs text-text-muted hover:text-text">
            See all {state.prospects.length}
          </a>
        </div>

        {ranked.length ? (
          <ul className="panel divide-y divide-ink-line">
            {ranked.slice(0, 5).map((prospect) => (
              <li key={prospect.slug}>
                <a
                  href={`#/prospects/${prospect.slug}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-ink-hover"
                >
                  <Score value={prospect.score} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text">
                      {prospect.name || prospect.slug}
                    </span>
                    <span className="block font-mono text-xs text-text-faint">
                      {prospect.industryLabel}
                    </span>
                  </span>
                  {prospect.demo?.built && (
                    <span className="flex items-center gap-1 font-mono text-xs text-signal">
                      demo <ExternalLink size={12} />
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No prospects yet">
            Pick a trade and a place above. The first sweep takes about a minute.
          </Empty>
        )}
      </section>
    </div>
  )
}

/**
 * A counter, with the sentence that says what it counts.
 *
 * The link is the whole card, so the hint sits outside it: a tooltip trigger
 * inside a link would follow the link when tapped on a phone.
 */
function Stat({ label, value, href, children }) {
  return (
    <div className="panel px-4 py-3">
      <span className="eyebrow flex items-center gap-1.5">
        {label}
        <Hint term={label.toLowerCase()}>{children}</Hint>
      </span>
      <a
        href={href}
        className="mt-1 block font-display text-2xl font-bold tabular-nums text-text hover:text-signal"
      >
        {value}
      </a>
    </div>
  )
}
