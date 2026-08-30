import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Building2, Database, Radar, Users } from 'lucide-react'

import { api } from './api.js'
import { Note, Spinner } from './components/ui.jsx'
import Prospects from './screens/Prospects.jsx'
import Prospect from './screens/Prospect.jsx'
import Collect from './screens/Collect.jsx'
import Industries from './screens/Industries.jsx'
import Sync from './screens/Sync.jsx'

const TABS = [
  { id: 'prospects', label: 'Prospects', icon: Users },
  { id: 'collect', label: 'Find', icon: Radar },
  { id: 'industries', label: 'Trades', icon: Building2 },
  { id: 'sync', label: 'Store', icon: Database },
]

/**
 * Hash routing, so a reload keeps you where you were and the server needs no
 * rewrite rules. Two shapes only: `#/prospects` and `#/prospects/<slug>`.
 */
function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/prospects')

  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash.slice(1) || '/prospects')
      // Opening a prospect from halfway down the list should start at the top
      // of the prospect, not halfway down it.
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const [, tab = 'prospects', slug] = hash.split('/')
  return { tab, slug, go: (path) => { window.location.hash = path } }
}

export default function App() {
  const { tab, slug, go } = useRoute()
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setState(await api.state())
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <a href="#/prospects" className="flex items-baseline gap-2">
            <span className="font-mono text-sm text-teal-bright">&gt;</span>
            <span className="font-display text-lg font-bold tracking-tight text-text">htpfinder</span>
          </a>

          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
            {TABS.map((item) => {
              const Icon = item.icon
              const active = tab === item.id
              return (
                <a
                  key={item.id}
                  href={`#/${item.id}`}
                  className={clsx(
                    'flex shrink-0 items-center gap-2 rounded-panel px-3 py-1.5 text-sm transition-colors',
                    active ? 'bg-ink-panel text-text' : 'text-text-muted hover:text-text'
                  )}
                >
                  <Icon size={15} />
                  {item.label}
                </a>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3 font-mono text-micro uppercase tracking-wider">
            <span className="text-text-faint">
              {state ? `${state.prospects.length} prospects` : ''}
            </span>
            <span
              className={clsx(
                'flex items-center gap-1.5',
                state?.supabase.configured ? 'text-teal-bright' : 'text-text-faint'
              )}
              title={
                state?.supabase.configured
                  ? 'Supabase is configured'
                  : `Supabase is not configured: ${state?.supabase.missing.join(', ')}`
              }
            >
              <span className="size-1.5 rounded-full bg-current" />
              store
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {error && (
          <Note tone="bad" title="Cannot reach the htpfinder server">
            {error}. Check the terminal where you ran <code className="command">htpfinder ui</code>.
          </Note>
        )}

        {!state && !error && <Spinner label="Reading prospects" />}

        {state && (
          <>
            {tab === 'prospects' && !slug && <Prospects state={state} go={go} />}
            {tab === 'prospects' && slug && <Prospect slug={slug} go={go} onChange={refresh} />}
            {tab === 'collect' && <Collect state={state} go={go} onChange={refresh} />}
            {tab === 'industries' && <Industries />}
            {tab === 'sync' && <Sync state={state} />}
          </>
        )}
      </main>
    </div>
  )
}
