/**
 * Minimal Supabase client.
 *
 * PostgREST and GoTrue are plain HTTP with a bearer token, and Node has fetch,
 * so `@supabase/supabase-js` would buy realtime and storage clients this tool
 * will never call at the cost of the zero dependency rule. Roughly a hundred
 * lines covers everything the sync command does.
 *
 * The key here is always the publishable one. It is not a secret: it ships in
 * client bundles by design. What protects the data is that every policy on
 * `prospects` keys off `auth.uid()`, so this signs in as a real user and sees
 * only that user's rows. The service role key would bypass all of it and has no
 * business on a laptop.
 */

import { loadEnv } from './env.js'

export class SupabaseError extends Error {
  constructor(message, { status, body } = {}) {
    super(message)
    this.name = 'SupabaseError'
    this.status = status
    this.body = body
  }
}

export class NotConfiguredError extends Error {
  constructor(missing) {
    super(
      `Supabase is not configured. Missing: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill it in, then try again.'
    )
    this.name = 'NotConfiguredError'
    this.missing = missing
  }
}

/**
 * Two levels of configuration, because there are now two ways to be signed in.
 *
 * CONNECTION is which project to talk to, and it is all the UI needs: someone
 * signing in through the panel brings their own session, so the project only
 * has to be named. REQUIRED adds the account the CLI signs in as when nobody is
 * sitting in front of it, which is why `htpfinder sync` still wants all four.
 */
const CONNECTION = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']
const REQUIRED = [...CONNECTION, 'SUPABASE_EMAIL', 'SUPABASE_PASSWORD']

export function config() {
  loadEnv()
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    key: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    email: process.env.SUPABASE_EMAIL || '',
    password: process.env.SUPABASE_PASSWORD || '',
  }
}

export function missingConfig() {
  loadEnv()
  return REQUIRED.filter((name) => !process.env[name])
}

/** What is missing before this can reach the project at all. */
export function missingConnection() {
  loadEnv()
  return CONNECTION.filter((name) => !process.env[name])
}

export function isConfigured() {
  return missingConfig().length === 0
}

/** Whether a browser session can be verified, which is what gates the panel. */
export function isConnected() {
  return missingConnection().length === 0
}

/** Whatever the API said, said in one line. Its `message` beats our guess. */
async function fail(response, fallback) {
  let body
  const text = await response.text()
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }

  // Each service words it differently: PostgREST uses `message` and `hint`,
  // GoTrue uses `msg` or `error_description`. Taking whichever is present beats
  // reporting "Bad Request" and leaving the reason on the floor.
  const detail =
    (body &&
      (body.message || body.msg || body.error_description || body.error || body.hint)) ||
    (typeof body === 'string' && body.trim()) ||
    response.statusText

  throw new SupabaseError(`${fallback}: ${detail}`, { status: response.status, body })
}

export function createClient() {
  const missing = missingConfig()
  if (missing.length) throw new NotConfiguredError(missing)

  const { url, key, email, password } = config()
  let session = null

  async function auth(path, payload) {
    const response = await fetch(`${url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) await fail(response, 'Supabase auth failed')
    return response.json()
  }

  async function signIn() {
    if (session) return session
    const result = await auth('token?grant_type=password', { email, password })
    session = { token: result.access_token, userId: result.user?.id || null }
    return session
  }

  /** Creates the account named in .env. Separate because it is not idempotent. */
  async function signUp() {
    const result = await auth('signup', { email, password })
    // A project with email confirmation on returns a user and no session.
    return {
      userId: result.user?.id || result.id || null,
      confirmed: Boolean(result.access_token),
    }
  }

  async function rest(path, { method = 'GET', body, prefer, headers = {} } = {}) {
    const { token } = await signIn()

    const response = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(prefer ? { prefer } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

    if (!response.ok) await fail(response, `Supabase ${method} ${path} failed`)
    if (response.status === 204) return null

    const text = await response.text()
    return text ? JSON.parse(text) : null
  }

  return {
    get userId() {
      return session?.userId || null
    },
    signIn,
    signUp,
    select: (table, query = '') => rest(`${table}${query ? `?${query}` : ''}`),
    insert: (table, rows) =>
      rest(table, { method: 'POST', body: rows, prefer: 'return=representation' }),
    upsert: (table, rows, onConflict) =>
      rest(`${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        body: rows,
        prefer: 'resolution=merge-duplicates,return=representation',
      }),
    patch: (table, query, patch) =>
      rest(`${table}?${query}`, {
        method: 'PATCH',
        body: patch,
        prefer: 'return=representation',
      }),
    remove: (table, query) => rest(`${table}?${query}`, { method: 'DELETE' }),
    rpc: (fn, args = {}) => rest(`rpc/${fn}`, { method: 'POST', body: args }),
  }
}
