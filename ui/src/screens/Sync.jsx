import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { api } from '../api.js'
import { Button, Command, Empty, Hint, Note, Score, Spinner, Status, Table } from '../components/ui.jsx'

/**
 * No hint on `in sync`. Repeating "the copies match" down a column of matching
 * rows is noise; the hint is there for the states that need a decision.
 */
const STATE_COPY = {
  'in sync': { tone: 'text-text-muted' },
  // Amber is the one that wants an action from you, green the one that is
  // already safely stored. They sit in the same column, so they cannot share.
  'local only': { tone: 'text-signal', hint: 'On this machine, not stored yet' },
  'remote only': { tone: 'text-ok', hint: 'Stored, not on this machine' },
  differs: { tone: 'text-alert', hint: 'Changed in both places' },
}

/**
 * Push and pull.
 *
 * Neither direction merges. When something changed in both places this says so
 * and stops, because guessing which edit to keep is how sourced research gets
 * lost quietly.
 */
export default function Sync({ state }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)
  const [conflicts, setConflicts] = useState([])

  const load = useCallback(async () => {
    if (!state.supabase.configured) return
    try {
      const data = await api.syncStatus()
      setRows(data.rows)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [state.supabase.configured])

  useEffect(() => {
    load()
  }, [load])

  if (!state.supabase.configured) {
    return (
      <div className="space-y-5">
        <Header />
        <Note tone="warn" title="The store is not connected">
          Add these to your .env, then restart:{' '}
          <code className="command">{state.supabase.missing.join(', ')}</code>
        </Note>
      </div>
    )
  }

  async function act(name, run) {
    setBusy(name)
    setError(null)
    setResult(null)
    setConflicts([])
    try {
      setResult({ name, ...(await run()) })
      await load()
    } catch (err) {
      if (err.slugs?.length) setConflicts(err.slugs)
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const counts = (rows || []).reduce((acc, row) => ({ ...acc, [row.state]: (acc[row.state] || 0) + 1 }), {})

  return (
    <div className="space-y-5">
      <Header />

      {error && (
        <Note tone={conflicts.length ? 'warn' : 'bad'} title={conflicts.length ? 'Both copies changed' : 'That did not run'}>
          {conflicts.length ? (
            <>
              <p>
                {conflicts.join(', ')} changed here and in the store. Nothing was written. Open each
                one and decide, or take the stored copy and lose the local edits.
              </p>
              <Button
                variant="danger"
                className="mt-2"
                loading={busy === 'pull-force'}
                onClick={() => act('pull-force', () => api.syncPull({ force: true }))}
              >
                Take the stored copy
              </Button>
            </>
          ) : (
            error
          )}
        </Note>
      )}

      {result && <Outcome result={result} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="panel space-y-3 p-4">
          <h2 className="eyebrow">Send up</h2>
          <p className="text-sm text-text-muted">
            Stores everything on this machine. The raw Google response never leaves, so only the
            research travels.
          </p>
          <Command>htpfinder sync push</Command>
          <Button variant="primary" loading={busy === 'push'} onClick={() => act('push', () => api.syncPush())}>
            <ArrowUp size={14} /> Send up
          </Button>
        </div>

        <div className="panel space-y-3 p-4">
          <h2 className="eyebrow">Bring down</h2>
          <p className="text-sm text-text-muted">
            Writes stored prospects onto this machine. Anything changed in both places is left
            alone until you say which one wins.
          </p>
          <Command>htpfinder sync pull</Command>
          <Button loading={busy === 'pull'} onClick={() => act('pull', () => api.syncPull())}>
            <ArrowDown size={14} /> Bring down
          </Button>
        </div>
      </div>

      {!rows && <Spinner label="Comparing with the store" />}

      {rows && (
        <>
          <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
            {Object.entries(counts).map(([label, count]) => (
              <span key={label} className={STATE_COPY[label]?.tone}>
                {count} {label}
              </span>
            ))}
          </p>

          <Table
            rows={rows}
            columns={[
              {
                label: 'State',
                get: (r) => (
                  <span className={STATE_COPY[r.state]?.tone}>
                    <span className="block">{r.state}</span>
                    {STATE_COPY[r.state]?.hint && (
                      <span className="block text-xs text-text-faint">
                        {STATE_COPY[r.state].hint}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                label: 'Business',
                get: (r) => (
                  <a href={`#/prospects/${r.slug}`} className="font-mono text-sm text-text hover:text-signal">
                    {r.slug}
                  </a>
                ),
              },
              { label: 'Score', get: (r) => <Score value={r.score} />, className: 'w-28' },
              { label: 'Status', get: (r) => <Status value={r.status} /> },
              {
                label: 'Stored',
                get: (r) => (
                  <span className="font-mono text-xs text-text-faint">
                    {r.storedAt ? String(r.storedAt).slice(0, 10) : 'never'}
                  </span>
                ),
              },
            ]}
            empty={
              <Empty title="Nothing here and nothing stored">
                Find some prospects first, then send them up.
              </Empty>
            }
          />
        </>
      )}
    </div>
  )
}

function Header() {
  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
        Store
        <Hint term="the store">
          A database in the cloud holding your research, so it survives this machine and can be
          reached from another one. Nothing goes up on its own: sending and bringing down are
          both buttons you press.
        </Hint>
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Files on this machine are what you edit. The store is where the research lives, scoped to
        your account and able to forget a business when asked.
      </p>
    </div>
  )
}

function Outcome({ result }) {
  const moved = result.pushed || result.pulled || []
  const verb = result.pushed ? 'sent up' : 'brought down'

  if (!moved.length) {
    return <Note tone="good" title="Nothing to do">{result.alreadyInSync} prospects already match.</Note>
  }

  return (
    <Note tone="good" title={`${moved.length} ${verb}`}>
      <ul className="space-y-0.5 font-mono text-xs">
        {moved.map((row) => (
          <li key={row.slug}>
            {row.action} {row.slug}
          </li>
        ))}
      </ul>
      {result.skipped?.length > 0 && (
        <p className="mt-2 text-signal">
          Skipped {result.skipped.join(', ')}, deleted from the store on purpose.
        </p>
      )}
    </Note>
  )
}
