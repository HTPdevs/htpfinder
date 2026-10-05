/**
 * treg client.
 *
 * treg is a gateway that holds the provider keys and injects them server side,
 * so the one thing this module must never do is hold a token itself. It shells
 * out to the `treg` CLI, which keeps its own signed in session, rather than
 * calling https://treg.to directly with a key read from the environment. No
 * credential ends up in this repo, in a `.env`, or in a process argument.
 *
 * Install and sign in once:
 *   curl -fsSL https://treg.to/install.sh | sh -s -- --token <token>
 *
 * Every call is billed against the team balance, so cost is returned alongside
 * the data and the pipeline totals it. A lead list that silently spent real
 * money is the failure mode worth designing against.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * The CLI appends a settlement line with no separator after the JSON body:
 * `...}treg: charged $0.0894 - call id abc123`. Splitting on newlines does not
 * remove it, so match the marker itself.
 *
 * It goes to stderr while the body goes to stdout, which is why both streams
 * are searched for it. Reading stdout alone parses cleanly and silently
 * reports every call as free, which is the worst of both outcomes: a sweep
 * that spends real money and a total that says it did not.
 */
const CHARGE_LINE = /treg:\s+charged\s+\$([0-9.]+)(?:\s+\S+\s+call id\s+(\w+))?[\s\S]*$/

export class TregError extends Error {
  constructor(message, { code } = {}) {
    super(message)
    this.name = 'TregError'
    this.code = code
  }
}

export class TregNotInstalledError extends TregError {
  constructor() {
    super(
      'The treg CLI is not installed or not signed in.\n' +
        'Install it with:  curl -fsSL https://treg.to/install.sh | sh -s -- --token <token>\n' +
        'Then check it with:  treg whoami',
      { code: 'treg_missing' }
    )
    this.name = 'TregNotInstalledError'
  }
}

export function parseTregOutput(stdout, stderr = '') {
  const charge = stdout.match(CHARGE_LINE) || stderr.match(CHARGE_LINE)
  const cost = charge ? Number(charge[1]) : 0
  const callId = charge?.[2] || null

  const body = stdout.replace(CHARGE_LINE, '').trim()
  if (!body) throw new TregError('treg returned no body')

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new TregError(`treg returned output that is not JSON: ${body.slice(0, 200)}`)
  }

  // A routed endpoint wraps the provider payload; a direct one does not.
  const output = parsed?.output ?? parsed
  const servedBy = parsed?._treg?.served_by || null
  return { output, raw: parsed, cost, callId, servedBy }
}

/**
 * Calls one catalog endpoint.
 *
 * `maxCost` becomes X-Treg-Route-Max-Cost, which caps what a routed endpoint
 * is allowed to spend walking its provider waterfall. Without it the default
 * ceiling is a dollar per call, which is the wrong default for a sweep that
 * makes hundreds of them.
 */
export async function tregCall(
  endpoint,
  body = {},
  { maxCost = 0.05, timeoutMs = 60000, execImpl = run } = {}
) {
  const args = [
    'call',
    endpoint,
    '--method',
    'POST',
    '--data',
    JSON.stringify(body),
    '--header',
    `X-Treg-Route-Max-Cost: ${maxCost}`,
  ]

  let stdout
  let stderr
  try {
    ;({ stdout, stderr = '' } = await execImpl('treg', args, {
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
    }))
  } catch (err) {
    if (err?.code === 'ENOENT') throw new TregNotInstalledError()
    // A non zero exit still prints the provider's error body, which says far
    // more than the exit code does.
    const detail = (err?.stdout || err?.stderr || err?.message || '').trim()
    throw new TregError(`treg call ${endpoint} failed: ${detail.slice(0, 400)}`)
  }

  return parseTregOutput(stdout, stderr)
}

/** Current prepaid balance in USD, or null when the CLI cannot report one. */
export async function tregBalance({ execImpl = run } = {}) {
  try {
    const { stdout, stderr = '' } = await execImpl('treg', ['balance'], { timeout: 20000 })
    const match = `${stdout}\n${stderr}`.match(/Balance\s+\$([0-9.]+)/)
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}
