import { Loader2 } from 'lucide-react'

import { Button, Note } from '../components/ui.jsx'
import githubMark from '../assets/icons/github.svg'

/** A rough approximation of Google's mark. Lucide carries no brand logos. */
function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.17v2.92h6.51c-.33 3.09-2.92 4.42-6.5 4.42A7.16 7.16 0 0 1 5 11.02 7.16 7.16 0 0 1 12.19 4c1.94 0 3.6.7 4.87 1.86l2.23-2.23A10.65 10.65 0 0 0 12.19 1a10.65 10.65 0 0 0-9.5 15.63A10.4 10.4 0 0 0 12 22c5.79 0 10.19-4.07 10.19-10.19 0-.7-.08-1.2-.18-1.71z"
      />
    </svg>
  )
}

/**
 * Gates the panel. Nobody sees a prospect, a sweep or the Supabase status
 * without a Supabase session, signed in through GitHub or Google.
 *
 * The server's host and origin checks (see `cli/src/server/http.js`) still
 * decide who can reach `/api` at all. This decides who the panel says is using
 * it, which matters once more than one person has it open.
 */
export default function Login({ onSignIn, pending, error }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <p className="eyebrow">htpfinder</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-text">Sign in to continue</h1>
      </div>

      {error && (
        <Note tone="bad" title="Sign in failed">
          {error}
        </Note>
      )}

      <div className="space-y-2.5">
        <Button
          className="w-full"
          loading={pending === 'github'}
          disabled={Boolean(pending) && pending !== 'github'}
          onClick={() => onSignIn('github')}
        >
          {pending !== 'github' && (
            // The mark is drawn solid black; inverted here so it reads on this button's dark fill.
            <img src={githubMark} width={16} height={16} alt="" aria-hidden="true" className="invert" />
          )}
          Continue with GitHub
        </Button>
        <Button
          className="w-full"
          loading={pending === 'google'}
          disabled={Boolean(pending) && pending !== 'google'}
          onClick={() => onSignIn('google')}
        >
          {pending !== 'google' && <GoogleIcon />}
          Continue with Google
        </Button>
      </div>

      {pending && (
        <p className="flex items-center justify-center gap-2 text-xs text-text-faint">
          <Loader2 size={13} className="animate-spin" />
          Redirecting…
        </p>
      )}
    </div>
  )
}
