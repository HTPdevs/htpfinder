import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { api } from '../api.js'
import { Button, Command, Field, Input, Note, Spinner } from '../components/ui.jsx'

/**
 * The trades this tool covers, and how to add one.
 *
 * Adding a trade is research, not configuration: the directory list and the
 * review thresholds cannot be worked out from a desk, and getting them wrong
 * makes the tool quietly bad at that trade. So this hands over a brief rather
 * than pretending a form could produce one.
 */
export default function Industries() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .industries()
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <Note tone="bad" title="Cannot read the trades">{error}</Note>
  if (!data) return <Spinner label="Reading trade profiles" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Trades</h1>
        <p className="mt-1 text-sm text-text-muted">
          Each trade knows where to look for a business, how many reviews count as established, and
          which services to expect.
        </p>
      </div>

      <div className="space-y-3">
        {data.industries.map((industry) => (
          <article key={industry.id} className="panel p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-bold">{industry.label}</h2>
              <span className="font-mono text-xs text-text-faint">{industry.id}</span>
            </div>

            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Stat label="Services" value={industry.services} />
              <Stat
                label="Reviews to qualify"
                value={`${industry.minReviews ?? '?'} min, ${industry.idealReviews ?? '?'} ideal`}
              />
              <Stat label="Researched" value={`${industry.researched} businesses`} />
            </dl>

            {industry.directories.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-1.5">
                {industry.directories.map((domain) => (
                  <span
                    key={domain}
                    className="rounded-full border border-ink-line px-2 py-0.5 font-mono text-xs text-text-muted"
                  >
                    {domain}
                  </span>
                ))}
              </p>
            )}

            {industry.warnings.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-ink-line pt-3">
                {industry.warnings.map((warning) => (
                  <li key={warning} className="text-sm text-signal">
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <NewTrade />
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-text">{value}</dd>
    </div>
  )
}

function NewTrade() {
  const [name, setName] = useState('')
  const [brief, setBrief] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  const id = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  async function load() {
    setBusy(true)
    setError(null)
    try {
      setBrief(await api.industryBrief(id))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(brief.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="panel space-y-4 p-4">
      <div>
        <h2 className="font-display text-lg font-bold">Add a trade</h2>
        <p className="mt-1 text-sm text-text-muted">
          Naming a trade gets you the brief for it. Three businesses need looking up before the
          profile can be written.
        </p>
      </div>

      <div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Trade">
            <Input
              placeholder="roofing"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setBrief(null)
              }}
            />
          </Field>
          <Button variant="primary" loading={busy} disabled={!id} onClick={load}>
            Get the brief
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-text-faint">
          Plain words, like 'roofing' or 'mobile detailing'.
        </p>
      </div>

      {id && <Command>{`htpfinder profile "${name.trim()}" --scaffold`}</Command>}

      {error && <Note tone="bad" title="Cannot build that brief">{error}</Note>}

      {brief && (
        <>
          <div className="flex gap-2">
            <Button onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy brief'}
            </Button>
            <Button variant="quiet" onClick={() => setBrief(null)}>
              Hide
            </Button>
          </div>
          <pre className="command max-h-96 overflow-auto whitespace-pre-wrap rounded-panel border border-ink-line bg-ink p-3">
            {brief.text}
          </pre>
        </>
      )}
    </div>
  )
}
