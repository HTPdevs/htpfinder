import { useState } from 'react'
import clsx from 'clsx'

import { api } from '../api.js'
import {
  Button,
  Checkbox,
  Command,
  Field,
  Hint,
  Input,
  Note,
  Score,
  Select,
  Table,
} from '../components/ui.jsx'

/**
 * Preview, then commit.
 *
 * Both are the same call with one flag flipped, so what the preview showed is
 * exactly what the commit writes. That matters because a live sweep spends
 * Google Places quota and reaches out to real businesses' websites, and neither
 * should ever happen because a button was ambiguous.
 */
export default function Collect({ state, query, go, onChange }) {
  // Prefilled from the hash, which is how the homepage form arrives here. The
  // sweep is still one deliberate click away, because a live one spends quota.
  const [form, setForm] = useState(() => ({
    industry: query?.get('industry') || state.industries[0]?.id || '',
    near: query?.get('near') || '',
    limit: Number(query?.get('limit')) || 60,
    fixture: query?.get('fixture') || '',
    keepLive: false,
    check: true,
  }))
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [written, setWritten] = useState(null)
  const [progress, setProgress] = useState(null)

  const set = (patch) => {
    setForm((current) => ({ ...current, ...patch }))
    setPreview(null)
    setWritten(null)
  }

  const usingFixture = Boolean(form.fixture)
  const ready = form.industry && (usingFixture || form.near.trim())

  const command = [
    'htpfinder collect',
    form.industry,
    usingFixture ? `--fixture ${form.fixture}` : form.near && `--near "${form.near}"`,
    form.limit !== 60 && `--limit ${form.limit}`,
    form.keepLive && '--keep-live',
    !form.check && '--no-check',
  ]
    .filter(Boolean)
    .join(' ')

  async function run(dryRun) {
    setBusy(true)
    setError(null)
    setProgress({ lines: [], checked: 0, total: 0, kept: 0 })

    try {
      const result = await api.collect({ ...form, limit: Number(form.limit), dryRun }, (event) =>
        setProgress((current) => ({
          // Capped, because a sweep of two hundred would otherwise grow the
          // page as it ran and push the buttons off the screen.
          lines: [...(current?.lines || []), event].slice(-8),
          checked: event.checked ?? current?.checked ?? 0,
          total: event.total ?? current?.total ?? 0,
          kept: event.kept ?? current?.kept ?? 0,
        }))
      )

      if (dryRun) {
        setPreview(result)
      } else {
        setWritten(result)
        setPreview(null)
        onChange()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Find prospects</h1>
        <p className="mt-1 text-sm text-text-muted">
          Sweep{' '}
          <Hint term="a sweep">
            One search of one trade in one place. It asks Google for businesses, then opens
            whatever website each one lists to see whether it actually works. Businesses with a
            working site are dropped.
          </Hint>{' '}
          a trade in one place and keep the businesses with no working website.
        </p>
      </div>

      {!state.placesKey && !usingFixture && (
        <Note tone="warn" title="No Google Places key">
          Add <code className="command">GOOGLE_PLACES_API_KEY</code> to your .env to search for
          real businesses. Until then, pick a recorded sweep below to try this out offline.
        </Note>
      )}

      <div className="panel space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trade">
            <Select value={form.industry} onChange={(event) => set({ industry: event.target.value })}>
              {state.industries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Near" hint="Any place Google understands, like Portland, OR">
            <Input
              placeholder="Portland, OR"
              value={form.near}
              disabled={usingFixture}
              onChange={(event) => set({ near: event.target.value })}
            />
          </Field>

          <Field
            label={
              <>
                Limit
                <Hint term="the limit">
                  How many businesses to look at. Google charges for each one, so a first pass in
                  a new place is cheaper at twenty than at two hundred.
                </Hint>
              </>
            }
            hint="How many places to consider"
          >
            <Input
              type="number"
              min="1"
              max="200"
              value={form.limit}
              onChange={(event) => set({ limit: event.target.value })}
            />
          </Field>

          <Field
            label={
              <>
                Recorded sweep
                <Hint term="a recorded sweep">
                  A search someone already ran, saved to a file. It replays instantly, costs
                  nothing and reaches no real business, so it is the safe way to see how this
                  works. The results are invented, and cannot be built into a page.
                </Hint>
              </>
            }
            hint="Runs offline and spends no quota"
          >
            <Select value={form.fixture} onChange={(event) => set({ fixture: event.target.value })}>
              <option value="">Search live</option>
              {state.fixtures.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 border-t border-ink-line pt-4 sm:grid-cols-2">
          <Checkbox
            label="Check every listed site"
            hint="Catches parked domains and dead links. Slower."
            checked={form.check}
            onChange={(event) => set({ check: event.target.checked })}
          />
          <Checkbox
            label="Keep businesses that already have a site"
            hint="Off by default, since those are not prospects."
            checked={form.keepLive}
            onChange={(event) => set({ keepLive: event.target.checked })}
          />
        </div>

        <Command>{command}</Command>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => run(true)} loading={busy} disabled={!ready}>
            Preview this sweep
          </Button>
          {preview && (
            <Button variant="default" onClick={() => run(false)} loading={busy}>
              Write {preview.kept.length} prospect{preview.kept.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
        {!ready && (
          <p className="text-xs text-text-faint">
            Pick a trade and either a place to search near or a recorded sweep.
          </p>
        )}
      </div>

      {progress && <Progress progress={progress} />}

      {error && <Note tone="bad" title="That sweep did not run">{error}</Note>}

      {written && (
        <Note tone="good" title={`Wrote ${written.kept.length} prospects`}>
          They are in your list now. Open one and use its research brief to fill in the details.
        </Note>
      )}

      {(preview || written) && <Results result={preview || written} go={go} written={Boolean(written)} />}
    </div>
  )
}

/**
 * What the sweep is doing, while it does it.
 *
 * Every line here is one fetch against a real business's website, which is
 * where the minutes go. Showing the name being checked is also the honest
 * thing: this tool reaches out to other people's servers, and that should be
 * visible rather than hidden behind a spinner.
 */
function Progress({ progress }) {
  const { checked, total, kept, lines } = progress
  const percent = total ? Math.round((checked / total) * 100) : 0

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="eyebrow">Sweeping</h2>
        <p className="font-mono text-xs text-text-muted">
          {total ? `${checked} of ${total} checked` : 'searching'}
          {kept ? ` · ${kept} kept` : ''}
        </p>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-ink-line" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-signal transition-[width] duration-200"
          style={{ width: `${total ? percent : 12}%` }}
        />
      </div>

      <ol className="space-y-1">
        {lines.map((line, index) => (
          <li
            key={`${line.message}-${index}`}
            className={clsx(
              'truncate font-mono text-xs',
              // The last line is the one happening now.
              index === lines.length - 1 ? 'text-text' : 'text-text-faint'
            )}
          >
            {line.keeping === false && <span className="text-text-faint">skip </span>}
            {line.message}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Results({ result, go, written }) {
  const uncertain = result.kept.filter((row) => row.website.uncertain)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">
          {written ? 'Written' : 'Would write'} {result.kept.length}, skipped {result.skipped.length}
        </h2>
        <p className="font-mono text-xs text-text-faint">from {result.source}</p>
      </div>

      {uncertain.length > 0 && (
        <Note tone="warn" title={`${uncertain.length} site check${uncertain.length === 1 ? '' : 's'} were inconclusive`}>
          Those businesses may still have a working site. Confirm before you reach out.
        </Note>
      )}

      <Table
        rows={result.kept}
        onRowClick={written ? (row) => go(`/prospects/${row.slug}`) : undefined}
        columns={[
          { label: 'Score', get: (r) => <Score value={r.score?.total} />, className: 'w-28' },
          {
            label: 'Business',
            get: (r) => (
              <span className="block">
                <span className="block text-text">{r.name}</span>
                <span className="block font-mono text-xs text-text-faint">{r.slug}</span>
              </span>
            ),
          },
          {
            label: 'Reviews',
            get: (r) => (
              <span className="font-mono text-xs text-text-muted">
                {r.place.reviewCount}
                {r.place.rating ? ` at ${r.place.rating}` : ''}
              </span>
            ),
          },
          {
            label: 'Phone',
            get: (r) => (
              <span className={r.place.phone ? 'text-text-muted' : 'text-text-faint'}>
                {r.place.phone ? 'yes' : 'none'}
              </span>
            ),
          },
          { label: 'Why it qualified', get: (r) => <span className="text-text-muted">{r.website.reason}</span> },
        ]}
      />

      {result.skipped.length > 0 && (
        <details className="panel px-4 py-3">
          <summary className="cursor-pointer text-sm text-text-muted">
            {result.skipped.length} skipped for having a working site
          </summary>
          <ul className="mt-3 space-y-1.5">
            {result.skipped.map((row) => (
              <li key={row.name} className="text-sm text-text-muted">
                <span className="text-text">{row.name}</span>
                <span className="font-mono text-xs text-text-faint"> &middot; {row.website.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
