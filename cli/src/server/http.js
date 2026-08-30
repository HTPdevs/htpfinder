/**
 * The local server behind `htpfinder ui`.
 *
 * Zero dependencies, same as the rest of the CLI: node:http plus a route table
 * is genuinely all this needs, and a framework would be the first runtime
 * dependency in the project.
 *
 * It binds to the loopback address and refuses requests that did not come from
 * it. That matters more than it looks: this server writes files, spends Places
 * quota and talks to Supabase with a signed in session, all with no login of
 * its own. The protections are deliberate and documented in `guard` below.
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

import { APP_ROOT, DEMOS_DIST, demoDistDir, isDemoBuilt } from '../lib/paths.js'

export const UI_ROOT = path.join(APP_ROOT, 'ui')
export const UI_DIST = path.join(UI_ROOT, 'dist')

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    // Nothing here should ever be cached or embedded elsewhere.
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })
  res.end(payload)
}

/**
 * What keeps a local server that needs no password from being a hole.
 *
 * Host check: a page on the internet can point a hostname it controls at
 * 127.0.0.1 and have the browser send requests here. Requiring the Host header
 * to be a loopback name defeats that, because the rebound name will not match.
 *
 * Origin check: a browser attaches Origin to cross site requests. Anything with
 * an Origin that is not this server is refused outright.
 *
 * JSON content type on writes: a cross origin form or an img tag can issue a
 * request without a preflight, but it cannot set application/json. Requiring it
 * on every mutation means those requests never reach a handler. No CORS headers
 * are ever sent, so even a permitted read cannot be read back cross origin.
 */
function guard(req, res, origin) {
  const host = (req.headers.host || '').split(':')[0]
  if (!ALLOWED_HOSTS.has(host)) {
    json(res, 403, { error: `Refusing a request for host "${host}". Use localhost.` })
    return false
  }

  const sent = req.headers.origin
  if (sent && sent !== origin) {
    json(res, 403, { error: 'Refusing a cross origin request.' })
    return false
  }

  const method = req.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    const type = (req.headers['content-type'] || '').split(';')[0].trim()
    if (type !== 'application/json') {
      json(res, 415, { error: 'Mutations must be application/json.' })
      return false
    }
  }

  return true
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    // Nothing this API accepts is large. A cap keeps a stray upload from
    // sitting in memory.
    if (size > 1_000_000) throw new Error('Request body is too large.')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function text(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

/**
 * A file from inside `root`, or the directory's index.html.
 *
 * Resolved and then checked, so ../ in a request cannot escape the directory.
 * Both static roots are single page apps, hence the fallback: a path that names
 * no file is a route rather than a mistake.
 */
function serveFrom(res, root, relative) {
  const resolved = path.resolve(path.join(root, decodeURIComponent(relative).replace(/^\/+/, '')))
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    res.writeHead(403)
    res.end()
    return
  }

  const target =
    fs.existsSync(resolved) && fs.statSync(resolved).isFile()
      ? resolved
      : path.join(root, 'index.html')

  if (!fs.existsSync(target)) {
    text(res, 404, 'Not found.\n')
    return
  }

  const body = fs.readFileSync(target)
  res.writeHead(200, {
    'content-type': TYPES[path.extname(target)] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(body)
}

function serveStatic(res, urlPath) {
  if (!fs.existsSync(UI_DIST)) {
    text(
      res,
      503,
      'The UI has not been built yet.\n\n' +
        '  cd ui && npm install && npm run build\n\n' +
        'Then start this again.\n'
    )
    return
  }

  serveFrom(res, UI_DIST, urlPath || '/index.html')
}

/**
 * A built demo site, at /demo/<slug>/.
 *
 * The point is that the person looking at a prospect can see the page that
 * prospect would get, without a second dev server and without knowing what
 * Vite is. The demos build with a relative base, so serving them from a
 * subdirectory needs no rebuild.
 */
function serveDemo(res, urlPath) {
  const [slug, ...rest] = urlPath.slice('/demo/'.length).split('/')
  if (!slug) {
    text(res, 404, 'Name a demo: /demo/<slug>/\n')
    return
  }

  const root = path.resolve(demoDistDir(slug))
  if (root !== DEMOS_DIST && !root.startsWith(DEMOS_DIST + path.sep)) {
    res.writeHead(403)
    res.end()
    return
  }

  if (!isDemoBuilt(slug)) {
    text(
      res,
      404,
      `No built demo for "${slug}".\n\n` +
        `  htpfinder build ${slug} --run\n\n` +
        'Then reload this page.\n'
    )
    return
  }

  // Without the trailing slash the browser resolves the demo's relative asset
  // paths against /demo/ rather than /demo/<slug>/, and the page loads blank.
  if (!rest.length && !urlPath.endsWith('/')) {
    res.writeHead(302, { location: `${urlPath}/`, 'cache-control': 'no-store' })
    res.end()
    return
  }

  serveFrom(res, root, rest.join('/'))
}

/**
 * A route that reports as it works, one JSON object per line.
 *
 * A sweep of sixty businesses fetches sixty websites, and a spinner for two
 * minutes is indistinguishable from a hang. The handler is handed `send` and
 * calls it as often as it likes.
 *
 * It stays a POST rather than becoming an EventSource, and that is the whole
 * security argument: the JSON content type requirement is what stops a page on
 * the internet from starting a sweep here, and EventSource cannot set it.
 *
 * Once the first line is out the status code is already sent, so a failure
 * halfway through arrives as an error line rather than a 500.
 */
async function streamRoute(res, route, context) {
  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  })

  const send = (event) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`)
  }

  try {
    const result = await route.handler({ ...context, send })
    send({ event: 'done', result: result ?? {} })
  } catch (err) {
    send({ event: 'error', error: err.message, code: err.code || null })
  }
  res.end()
}

/**
 * Matches `/api/prospects/:slug/build` style patterns.
 * Returns the captured params, or null when the route does not match.
 */
function match(pattern, pathname) {
  const a = pattern.split('/').filter(Boolean)
  const b = pathname.split('/').filter(Boolean)
  if (a.length !== b.length) return null

  const params = {}
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}

export function createServer(routes) {
  return http.createServer(async (req, res) => {
    const origin = `http://${req.headers.host}`
    const url = new URL(req.url, origin)

    if (!guard(req, res, origin)) return

    if (url.pathname === '/demo' || url.pathname.startsWith('/demo/')) {
      serveDemo(res, url.pathname)
      return
    }

    if (!url.pathname.startsWith('/api/')) {
      serveStatic(res, url.pathname)
      return
    }

    for (const route of routes) {
      if (route.method !== req.method) continue
      const params = match(route.path, url.pathname)
      if (!params) continue

      try {
        const body = req.method === 'GET' ? {} : await readBody(req)

        if (route.stream) {
          await streamRoute(res, route, { params, body, query: url.searchParams })
          return
        }

        const result = await route.handler({ params, body, query: url.searchParams })
        json(res, result?.status || 200, result?.body ?? result ?? {})
      } catch (err) {
        // The message is the useful part and this only ever answers loopback,
        // so it is safe to pass along rather than swallow.
        json(res, err.status || 500, {
          error: err.message,
          code: err.code || null,
          problems: err.problems || undefined,
          slugs: err.slugs || undefined,
        })
      }
      return
    }

    json(res, 404, { error: `No route for ${req.method} ${url.pathname}` })
  })
}
