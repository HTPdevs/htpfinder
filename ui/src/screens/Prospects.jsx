import { useMemo, useState } from 'react'

import { Empty, Input, Score, Select, Status, Table } from '../components/ui.jsx'

/**
 * The list. Sorted by score, because the score is the whole point of the
 * collect stage: it ranks who is worth a call first.
 */
export default function Prospects({ state, go }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [industry, setIndustry] = useState('')

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase()
    return state.prospects
      .filter((p) => !status || p.status === status)
      .filter((p) => !industry || p.industry === industry)
      .filter(
        (p) => !term || p.slug.includes(term) || (p.name || '').toLowerCase().includes(term)
      )
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  }, [state.prospects, query, status, industry])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Prospects</h1>
        <p className="mt-1 text-sm text-text-muted">
          Businesses with no working website, ranked by how good a prospect they are.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          placeholder="Search by name or slug"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Any status</option>
          {state.statuses.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
        <Select value={industry} onChange={(event) => setIndustry(event.target.value)}>
          <option value="">Any trade</option>
          {state.industries.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>

      <Table
        rows={rows}
        onRowClick={(row) => go(`/prospects/${row.slug}`)}
        columns={[
          { label: 'Score', get: (r) => <Score value={r.score} />, className: 'w-28' },
          {
            label: 'Business',
            get: (r) => (
              <span className="block">
                <span className="block text-text">{r.name || r.slug}</span>
                <span className="block font-mono text-xs text-text-faint">{r.slug}</span>
              </span>
            ),
          },
          { label: 'Trade', get: (r) => <span className="text-text-muted">{r.industry}</span> },
          { label: 'Status', get: (r) => <Status value={r.status} /> },
          {
            label: 'Phone',
            get: (r) => (
              <span className={r.hasPhone ? 'text-text-muted' : 'text-text-faint'}>
                {r.hasPhone ? 'yes' : 'none'}
              </span>
            ),
          },
          {
            label: 'Research',
            get: (r) => (
              <span className="font-mono text-xs text-text-muted">
                {r.services} services &middot; {r.quotes} quotes
              </span>
            ),
          },
        ]}
        empty={
          <Empty title={state.prospects.length ? 'Nothing matches those filters' : 'No prospects yet'}>
            {state.prospects.length ? (
              'Clear the search or pick a different status.'
            ) : (
              <>Head to Find and sweep a trade in a place you want to work.</>
            )}
          </Empty>
        }
      />

      {rows.length > 0 && (
        <p className="text-xs text-text-faint">
          {rows.length} of {state.prospects.length} shown. Click a row to open it.
        </p>
      )}
    </div>
  )
}
