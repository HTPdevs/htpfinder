import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react'

import { api } from '../api.js'
import { Button, Command, Hint, Note, Score, Select, Spinner, Status } from '../components/ui.jsx'

/**
 * One prospect: what is known, where it came from, and what it still needs.
 *
 * Facts and copy stay visually separate all the way down, because that split is
 * the contract. A fact carries a source you can click; copy is what we wrote.
 */
export default function Prospect({ slug, go, onChange }) {
  const [data, setData] = useState(null)
  // Two kinds of failure, kept apart. Not reading the prospect means there is
  // no screen to show. A build that failed is one panel reporting a problem on
  // a screen that is otherwise fine, and swapping the whole page for the error
  // takes away everything the person needs in order to understand it.
  const [loadError, setLoadError] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [saved, setSaved] = useState(null)
  const [lastBuild, setLastBuild] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await api.prospect(slug))
      setLoadError(null)
    } catch (err) {
      setLoadError(err.message)
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  if (loadError) return <Note tone="bad" title="Cannot open that prospect">{loadError}</Note>
  if (!data) return <Spinner label="Reading the prospect" />

  const { prospect, validation } = data
  const facts = prospect.facts || {}
  const stage = prospect.copy ? validation.build : validation.collect

  async function act(name, run, confirmation) {
    setBusy(name)
    setError(null)
    try {
      await run()
      await load()
      onChange()
      // Every write here changes a file on disk. Saying so is what makes an
      // accidental one noticeable, instead of it sitting there until a sync
      // reports the prospect as changed and nobody remembers changing it.
      if (confirmation) setSaved(confirmation)
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
              <span className="flex items-center gap-1">
                {prospect.slug}
                <Hint term="this short name">
                  The short name this business is filed under, in folders, in the store and in the
                  address of its demo page. It is made from the business name and never changes.
                </Hint>
              </span>
              <span>{data.profile.label}</span>
              <span className="flex items-center gap-1">
                {prospect.provenance}
                <Hint term="where the facts came from">
                  Where these facts came from. Google Places means a real search. A recorded sweep
                  means saved test data, which can never be built into a page carrying a real
                  business name.
                </Hint>
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Score value={prospect.score?.total} />
              <Hint term="the score" align="right">
                How good a prospect this is, out of 100. It goes up with a missing website, a
                strong rating, review volume and a phone number to call. It says nothing about
                the quality of the business.
              </Hint>
            </span>
            <Select
              value={prospect.status}
              aria-label="Status"
              className="w-auto"
              onChange={(event) => {
                const next = event.target.value
                const previous = prospect.status
                act(
                  'status',
                  () => api.setStatus(slug, next),
                  { from: previous, to: next }
                )
              }}
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

      {saved && (
        <Note tone="good" title={`Status changed to ${saved.to}`}>
          <span>
            This was {saved.from}. The change is saved on this machine, and the store will not
            have it until you send it up.
          </span>{' '}
          <button
            type="button"
            className="text-signal underline hover:no-underline"
            onClick={() => {
              setSaved(null)
              act('status', () => api.setStatus(slug, saved.from))
            }}
          >
            Put it back to {saved.from}
          </button>
        </Note>
      )}

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
          <h2 className="eyebrow flex items-center gap-1.5">
            What we know, and where from
            <Hint term="these facts">
              Everything here was found on a public listing, and the arrow beside a row opens the
              listing it came from. Anything nobody could find reads as not found, rather than
              being guessed at.
            </Hint>
          </h2>
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
          {error && (
            <Note tone="bad" title="That did not run">
              {/* Whitespace preserved, because a failed page build reports the
                  last few lines of the renderer's own output. */}
              <p className="whitespace-pre-wrap">{error}</p>
            </Note>
          )}

          <Copywriting
            slug={slug}
            prospect={prospect}
            busy={busy}
            onEnrich={(options) => act('enrich', () => api.enrich(slug, options))}
          />
          <Actions
            slug={slug}
            prospect={prospect}
            demo={data.demo}
            busy={busy}
            result={lastBuild}
            onBuild={(options) =>
              act('build', async () => {
                setLastBuild(null)
                setLastBuild(await api.build(slug, options))
              })
            }
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
        : 'Nothing is wrong with it. Write the copy to make it buildable, or hand the research brief to an agent first for a better page.'}
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
          className="shrink-0 text-text-faint hover:text-signal"
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
        className="text-signal hover:underline"
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
                className="ml-auto text-text-faint hover:text-signal"
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
            <p className="font-mono text-xs text-signal">{service.key}</p>
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
                <a href={quote.url} target="_blank" rel="noreferrer" className="hover:text-signal">
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

/**
 * Copy written from the facts, with no research step.
 *
 * The honest framing matters here. This is the floor: it turns a collected
 * prospect into a buildable one without inventing anything, and a researched
 * prospect will always make a better page. So the panel says what it is, and
 * replacing existing copy takes a second, deliberate click.
 */
function Copywriting({ slug, prospect, busy, onEnrich }) {
  const [confirming, setConfirming] = useState(false)
  const hasCopy = Boolean(prospect.copy)
  const blocked = prospect.provenance === 'fixture'

  return (
    <div className="panel space-y-3 p-4">
      <h2 className="eyebrow flex items-center gap-1.5">
        Write the copy
        <Hint term="copy">
          Copy is the words on the page: headlines, the about section, the closing pitch. Facts
          are found, copy is written. This writes it from the facts on the left without inventing
          anything, which is enough to build a page.
        </Hint>
      </h2>
      <p className="text-sm text-text-muted">
        {hasCopy
          ? 'This prospect already has copy. Writing it again replaces every section with copy generated from the facts.'
          : 'Turns the facts above into every section of the page. Nothing is invented: a fact that is missing is a sentence that does not get written.'}
      </p>

      <Command>{`htpfinder enrich ${slug}${hasCopy ? ' --force' : ''}`}</Command>

      {hasCopy && !confirming ? (
        <Button variant="default" disabled={blocked} onClick={() => setConfirming(true)}>
          Replace the copy
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            loading={busy === 'enrich'}
            disabled={blocked}
            onClick={() => {
              setConfirming(false)
              onEnrich({ force: hasCopy })
            }}
          >
            {hasCopy ? 'Yes, replace it' : 'Write copy from the facts'}
          </Button>
          {confirming && (
            <Button variant="quiet" onClick={() => setConfirming(false)}>
              Keep what is there
            </Button>
          )}
        </div>
      )}

      {blocked && (
        <p className="text-xs text-text-faint">
          Recorded sweeps are skipped, since they can never be built.
        </p>
      )}

      {prospect.enrichedAt && (
        <p className="font-mono text-xs text-text-faint">
          last written {new Date(prospect.enrichedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}

/**
 * Building the page.
 *
 * The button produces a page you can open, every time. It used to write two
 * source files and stop unless a checkbox was ticked, which from the outside
 * looked like a button that changed a status and did nothing else. The files
 * on their own are only useful to somebody about to run a dev server, so that
 * is now the option rather than the default.
 */
function Actions({ slug, prospect, demo, busy, result, onBuild }) {
  const [vite, setVite] = useState(true)
  const blocked = prospect.provenance === 'fixture'
  const building = busy === 'build'

  return (
    <div className="panel space-y-3 p-4">
      <h2 className="eyebrow flex items-center gap-1.5">
        Build the demo site
        <Hint term="the demo site">
          The page this business would get. It is built from the facts and copy on the left, and
          nothing else. Building it again after an edit replaces the old one.
        </Hint>
      </h2>
      <p className="text-sm text-text-muted">
        Turns this prospect into a page you can open and send. A colour scheme is picked for you
        if it does not have one.
      </p>

      <Command>{`htpfinder build ${slug}${vite ? ' --run' : ''}`}</Command>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={building} disabled={blocked} onClick={() => onBuild({ vite })}>
          {demo?.built ? 'Build it again' : 'Build the demo site'}
        </Button>

        {demo?.built && !building && (
          // Served by this same server, so the page opens without a second
          // dev server and without knowing what Vite is.
          <Button as="a" variant="default" href={demo.url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
            Open the demo
          </Button>
        )}
      </div>

      {building && vite && (
        <p className="text-xs text-text-faint">
          Rendering the page. This takes a few seconds the first time.
        </p>
      )}

      {result && !building && <BuildReport result={result} />}

      {!demo?.built && !result && !blocked && (
        <p className="text-xs text-text-faint">No page has been built for this business yet.</p>
      )}

      {blocked && (
        <p className="text-xs text-text-faint">
          Recorded sweeps cannot be built. Collect this business against the live API first.
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-2 border-t border-ink-line pt-3 text-xs text-text-faint">
        <input
          type="checkbox"
          checked={!vite}
          onChange={(event) => setVite(!event.target.checked)}
          className="mt-0.5 size-3.5 rounded border-ink-line bg-ink accent-signal"
        />
        <span>
          Write the source files only, without rendering a page. For working on the renderer with
          a dev server running.
        </span>
      </label>

      {prospect.design?.paletteId && (
        <p className="font-mono text-xs text-text-faint">
          palette {prospect.design.paletteId} &middot; {prospect.design.motif} &middot;{' '}
          {prospect.design.mark}
        </p>
      )}
    </div>
  )
}

/** What the last build actually did, in the panel that started it. */
function BuildReport({ result }) {
  return (
    <Note
      tone={result.forced ? 'warn' : 'good'}
      title={result.viteBuilt ? 'The page is ready' : 'Source files written'}
    >
      <ul className="space-y-1">
        {result.assignedPalette && (
          <li>
            Colour scheme: {result.assignedPalette.label}, picked because no other prospect is
            using it.
          </li>
        )}
        {result.viteBuilt ? (
          <li>
            Open it with the button above, or at{' '}
            <code className="command text-text">{result.demo?.url}</code>
          </li>
        ) : (
          <li>
            No page was rendered, because the source files only option is ticked below.
          </li>
        )}
        {result.forced && <li>Built with {result.errors.length} unresolved problem(s).</li>}
        {result.warnings.map((problem) => (
          <li key={problem.path + problem.message} className="text-text-muted">
            {problem.path}: {problem.message}
          </li>
        ))}
      </ul>
    </Note>
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
      <h2 className="eyebrow flex items-center gap-1.5">
        Research brief
        <Hint term="the research brief">
          A list of what is still missing about this business and which directories tend to carry
          it. Copy it and hand it to an AI assistant, or work through it yourself. It is what
          turns a page that is true into a page that is persuasive.
        </Hint>
      </h2>
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
