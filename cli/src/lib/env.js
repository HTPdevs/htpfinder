/**
 * Reads `.env` from the app root into `process.env`.
 *
 * A dependency for this would be about forty lines of parsing we do not need.
 * Real environment variables always win, so `GOOGLE_PLACES_API_KEY=... htpfinder
 * collect` behaves the way anyone would expect.
 */

import fs from 'node:fs'
import path from 'node:path'

import { APP_ROOT } from './paths.js'

let loaded = false

export function loadEnv({ file = path.join(APP_ROOT, '.env'), force = false } = {}) {
  if (loaded && !force) return process.env
  loaded = true

  if (!fs.existsSync(file)) return process.env

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    if (!key || key in process.env) continue

    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }

  return process.env
}
