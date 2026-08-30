/**
 * The panel's own signed in session, separate from the CLI's.
 *
 * `/api/state` hands over the project URL and publishable key: not secrets,
 * since the publishable key ships in client bundles by design and every table
 * policy keys off `auth.uid()` regardless of who holds it. Building the client
 * here, from values the server already exposes, means no second copy of the
 * connection settings has to live in a `ui/.env` file.
 *
 * PKCE rather than the implicit flow, and deliberately: the implicit flow
 * returns tokens in a URL fragment, which is exactly where this app's own hash
 * router reads the current screen from. PKCE returns a `?code=` query param
 * instead, so a GitHub or Google redirect back here can never collide with it.
 */

import { createClient } from '@supabase/supabase-js'

let client = null
let clientKey = null

export function getSupabase({ url, key }) {
  if (!url || !key) return null

  const identity = `${url}::${key}`
  if (client && clientKey === identity) return client

  client = createClient(url, key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  clientKey = identity
  return client
}

const PROVIDERS = {
  github: 'github',
  google: 'google',
}

/** Kicks off the redirect. Comes back to wherever the panel is running now. */
export function signInWithProvider(supabase, provider) {
  return supabase.auth.signInWithOAuth({
    provider: PROVIDERS[provider],
    options: { redirectTo: window.location.origin },
  })
}

export function signOut(supabase) {
  return supabase.auth.signOut()
}
