import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react'

import { api } from '../api.js'
import { Button, Command, Note, Score, Select, Spinner, Status } from '../components/ui.jsx'

/**
 * One prospect: what is known, where it came from, and what it still needs.
 *
 * Facts and copy stay visually separate all the way down, because that split is
 * the contract. A fact carries a source you can click; copy is what we wrote.
 */
export default function Prospect({ slug, go, onChange }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await api.prospect(slug))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <Note tone="bad" title="Cannot open that prospect">{error}</Note>
  if (!data) return <Spinner label="Reading the prospect" />

  const { prospect, validation } = data
  const facts = prospect.facts || {}
  const stage = prospect.copy ? validation.build : validation.collect

  async function act(name, run) {
    setBusy(name)
    setError(null)
    try {
      await run()
      await load()
      onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <a href="#/prospects" className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
          <ArrowLeft size={14} /> All prospects
        </a>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {facts.name?.value || prospect.slug}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-text-faint">
              <span>{prospect.slug}</span>
              <span>{prospect.industry}</span>
              <span>{prospect.provenance}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Score value={prospect.score?.total} />
            <Select
              value={prospect.status}
              aria-label="Status"
              className="w-auto"
              onChange={(event) => act('status', () => api.setStatus(slug, event.target.value))}
            >
              {['collected', 'enriched', 'built', 'contacted', 'rejected'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {prospect.provenance === 'fixture' && (
        <Note tone="warn" title="This came from a recorded sweep">
          The ratings and reviews are placeholders, so this can never be built into a demo site
          carrying a real business name. Collect it again against the live API first.
        </Note>
      )}

      <Readiness stage={stage} hasCopy={Boolean(prospect.copy)} />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* min-w-0: a grid child defaults to min-width auto, so one wide
            descendant would stretch the column past the viewport. */}
        <section className="min-w-0 space-y-4">
          <h2 className="eyebrow">What we know, and where from</h2>
          <div className="panel divide-y divide-ink-line">
            <FactRow label="Phone" fact={facts.phone} />
            <FactRow label="Address" fact={facts.address} />
            <FactRow label="Hours" fact={facts.hours} />
            <FactRow label="Owner" fact={facts.ownerName} />
            <FactRow label="Years in business" fact={facts.yearsInBusiness} />
            <FactRow label="Crew size" fact={facts.crewSize} />
            <FactRow label="Free estimates" fact={facts.freeEstimates} />
            <FactRow label="Payment" fact={facts.paymentMethods} />
            <FactRow label="Languages" fact={facts.languages} />
            <FactRow label="Certifications" fact={facts.certifications} />
            <FactRow label="Service area" fact={facts.serviceArea} />
          </div>

          <Ratings ratings={facts.ratings} />
          <Services services={facts.services} />
          <Quotes quotes={facts.reviewQuotes} />

          <Unresolved items={prospect.unresolved} />
        </section>

        {/* Sticky, because the left column runs long on a well researched
            prospect and the actions should not scroll away from it. */}
        <section className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Actions
            slug={slug}
            prospect={prospect}
            busy={busy}
            onBuild={(options) => act('build', () => api.build(slug, options))}
          />
          <Packet slug={slug} hasCopy={Boolean(prospect.copy)} />
        </section>
      </div>
    </div>
  )
}

function Readiness({ stage, hasCopy }) {
  if (stage.errors.length) {
    return (
      <Note tone="bad" title={`${stage.errors.length} thing${stage.errors.length === 1 ? '' : 's'} to fix before this can be built`}>
        <ul className="space-y-1">
          {stage.errors.map((problem) => (
            <li key={problem.path + problem.message}>
              <code className="command text-text">{problem.path}</code> {problem.message}
            </li>
          ))}
        </ul>
      </Note>
    )
  }

  if (stage.warnings.length) {
    return (
      <Note tone="warn" title={`${stage.warnings.length} thing${stage.warnings.length === 1 ? '' : 's'} worth a look`}>
        <ul className="space-y-1">
          {stage.warnings.map((problem) => (
            <li key={problem.path + problem.message}>
              <code className="command text-text">{problem.path}</code> {problem.message}
            </li>
          ))}
        </ul>
      </Note>
    )
  }

  return (
    <Note tone="good" title={hasCopy ? 'Ready to build' : 'Collected cleanly'}>
      {hasCopy
        ? 'Every claim carries a source and the copy follows the rules.'
        : 'Nothing is wrong with it. It still needs the research step before it can become a demo.'}
    </Note>
  )
}

function FactRow({ label, fact }) {
  const value = fact?.value
  const shown = Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'yes' : 'no') : value

  return (
    // The label column is a fixed width only once there is room for it. Below
    // that it stacks, rather than squeezing the value into nothing.
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5">
      <span className="w-full shrink-0 text-xs text-text-faint sm:w-36">{label}</span>
      {shown == null || shown === '' ? (
        <span className="text-sm text-text-faint">not found</span>
      ) : (
        <span className="min-w-0 flex-1 text-sm text-text">
          {shown}
          {fact.approx && <span className="ml-1 text-xs text-text-faint">approx</span>}
          {fact.confirmed === false && <span className="ml-1 text-xs text-signal">unconfirmed</span>}
        </span>
      )}
      {fact?.source && (
        <a
          href={fact.source}
          target="_blank"
          rel="noreferrer"
          title={fact.source}
          className="shrink-0 text-text-faint hover:text-teal-bright"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}

/**
 * Conflicts and gaps the research could not settle.
 *
 * Never rendered on a demo page, and the best call preparation in the file: two
 * of a business's own listings disagreeing is worth knowing before you dial. It
 * arrives as prose with sources inline, so the sources are pulled out as links
 * rather than left as raw URLs running through the middle of a sentence.
 */
function Unresolved({ items }) {
  if (!items?.length) return null

  return (
    <div className="space-y-2">
      <h2 className="eyebrow">Worth raising on the call</h2>
      <ol className="panel divide-y divide-ink-line">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3 px-4 py-3">
            <span className="font-mono text-xs text-signal">{String(index + 1).padStart(2, '0')}</span>
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-text-muted">{linkify(item)}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

const URLS = /\(?(https?:\/\/[^\s)]+)\)?/g

function linkify(text) {
  const parts = []
  let last = 0

  for (const match of text.matchAll(URLS)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      <a
        key={match.index}
        href={match[1]}
        target="_blank"
        rel="noreferrer"
        className="text-teal-bright hover:underline"
      >
        source
        <ExternalLink size={11} className="ml-0.5 inline align-baseline" />
      </a>
    )
    last = match.index + match[0].length
  }

  parts.push(text.slice(last))
  return parts
}

function Ratings({ ratings }) {
  if (!ratings?.length) return null
  return (
    <div className="space-y-2">
      <h2 className="eyebrow">Ratings</h2>
      <div className="panel divide-y divide-ink-line">
        {ratings.map((rating) => (
          <div key={rating.source + rating.url} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className="font-mono text-sm text-signal">{Number(rating.score).toFixed(1)}</span>
            <span className="text-sm text-text">{rating.source}</span>
            <span className="text-xs text-text-faint">
              {rating.count} review{rating.count === 1 ? '' : 's'}
            </span>
            {rating.url && (
              <a
                href={rating.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-text-faint hover:text-teal-bright"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Services({ services }) {
  if (!services?.length) return null
  return (
    <div className="space-y-2">
      <h2 className="eyebrow">Services</h2>
      <div className="panel divide-y divide-ink-line">
        {services.map((service) => (
          <div key={service.key} className="px-4 py-2.5">
            <p className="font-mono text-xs text-teal-bright">{service.key}</p>
            <p className="mt-0.5 text-sm text-text-muted">{service.blurb}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Quotes({ quotes }) {
  if (!quotes?.length) return null
  return (
    <div className="space-y-2">
      <h2 className="eyebrow">Reviews, verbatim</h2>
      <div className="panel divide-y divide-ink-line">
        {quotes.map((quote) => (
          <figure key={quote.text} className="px-4 py-3">
            <blockquote className="text-sm text-text">&ldquo;{quote.text}&rdquo;</blockquote>
            <figcaption className="mt-1.5 flex items-center gap-2 text-xs text-text-faint">
              {[quote.author, quote.source].filter(Boolean).join(', ')}
              {quote.url && (
                <a href={quote.url} target="_blank" rel="noreferrer" className="hover:text-teal-bright">
                  <ExternalLink size={12} />
                </a>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

function Actions({ slug, prospect, busy, onBuild }) {
  const [vite, setVite] = useState(false)
  const blocked = prospect.provenance === 'fixture'

  return (
    <div className="panel space-y-3 p-4">
      <h2 className="eyebrow">Build the demo site</h2>
      <p className="text-sm text-text-muted">
        Writes the renderer files for this business. A palette is picked for you if it does not
        have one.
      </p>

      <Command>{`htpfinder build ${slug}${vite ? ' --run' : ''}`}</Command>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={vite}
          onChange={(event) => setVite(event.target.checked)}
          className="size-4 rounded border-ink-line bg-ink accent-teal-bright"
        />
        Also run the production build
      </label>

      <Button
        variant="primary"
        loading={busy === 'build'}
        disabled={blocked}
        onClick={() => onBuild({ vite })}
      >
        Build demo site
      </Button>

      {blocked && (
        <p className="text-xs text-text-faint">
          Recorded sweeps cannot be built. Collect this business against the live API first.
        </p>
      )}

      {prospect.design?.paletteId && (
        <p className="font-mono text-xs text-text-faint">
          palette {prospect.design.paletteId} &middot; {prospect.design.motif} &middot;{' '}
          {prospect.design.mark}
        </p>
      )}
    </div>
  )
}

/**
 * The research brief.
 *
 * The enrichment stage is a person or an agent reading this and filling in the
 * file, so the useful thing the UI can do is hand over the text to paste.
 */
function Packet({ slug, hasCopy }) {
  const [text, setText] = useState(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    setBusy(true)
    try {
      const result = await api.packet(slug)
      setText(result.text)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="panel space-y-3 p-4">
      <h2 className="eyebrow">Research brief</h2>
      <p className="text-sm text-text-muted">
        {hasCopy
          ? 'The brief that shaped this page. Open it again to redo the research.'
          : 'What this prospect still needs, written for whoever does the research. Hand it to an agent or work through it yourself.'}
      </p>

      {!text ? (
        <Button loading={busy} onClick={load}>
          Show the brief
        </Button>
      ) : (
        <>
          <div className="flex gap-2">
            <Button onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy brief'}
            </Button>
            <Button variant="quiet" onClick={() => setText(null)}>
              Hide
            </Button>
          </div>
          <pre className="command max-h-96 overflow-auto whitespace-pre-wrap rounded-panel border border-ink-line bg-ink p-3">
            {text}
          </pre>
        </>
      )}
    </div>
  )
}
