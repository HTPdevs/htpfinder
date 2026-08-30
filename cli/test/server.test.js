import assert from 'node:assert/strict'
import http from 'node:http'
import { after, before, test } from 'node:test'

import { createServer } from '../src/server/http.js'

/**
 * The local server needs no login, because it only ever answers the loopback
 * address. These pin the checks that make that true. A regression here does not
 * look like a broken page; it looks like any website you happen to be visiting
 * being able to drive a tool that writes files and spends Places quota.
 */

let base
let server
let wrote = 0

before(async () => {
  server = createServer([
    { method: 'GET', path: '/api/ping', handler: async () => ({ pong: true }) },
    {
      method: 'POST',
      path: '/api/write',
      handler: async ({ body }) => {
        wrote += 1
        return { got: body }
      },
    },
    { method: 'GET', path: '/api/prospects/:slug', handler: async ({ params }) => params },
    {
      method: 'POST',
      path: '/api/stream',
      stream: true,
      handler: async ({ body, send }) => {
        send({ event: 'progress', message: 'one' })
        send({ event: 'progress', message: 'two' })
        if (body.fail) throw new Error('halfway through')
        return { finished: true }
      },
    },
  ])

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

test('a normal request is answered', async () => {
  const response = await fetch(`${base}/api/ping`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { pong: true })
})

test('route params are decoded', async () => {
  const response = await fetch(`${base}/api/prospects/key-concepts-landscape`)
  assert.deepEqual(await response.json(), { slug: 'key-concepts-landscape' })
})

test('a request for a hostname that is not loopback is refused', async () => {
  // Sent with node:http rather than fetch, because fetch derives the Host
  // header from the URL and will not let a test forge it. A browser doing this
  // for real is a DNS rebinding attack: a name the attacker controls, resolved
  // to 127.0.0.1, so the browser sends the request straight here.
  const { status, body } = await raw({ host: 'evil.example' })

  assert.equal(status, 403)
  assert.match(JSON.parse(body).error, /Refusing a request for host/)
})

test('a loopback hostname is allowed', async () => {
  const { status } = await raw({ host: 'localhost' })
  assert.equal(status, 200)
})

function raw(headers) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port: server.address().port, path: '/api/ping', headers },
      (response) => {
        let body = ''
        response.on('data', (chunk) => {
          body += chunk
        })
        response.on('end', () => resolve({ status: response.statusCode, body }))
      }
    )
    request.on('error', reject)
    request.end()
  })
}

test('a cross origin request is refused', async () => {
  const response = await fetch(`${base}/api/ping`, {
    headers: { origin: 'https://evil.example' },
  })

  assert.equal(response.status, 403)
  assert.match((await response.json()).error, /cross origin/)
})

test('a write that is not json never reaches its handler', async () => {
  const before = wrote

  // A cross origin form post cannot set application/json without a preflight,
  // and no CORS headers are ever sent, so requiring it here is what stops one.
  const response = await fetch(`${base}/api/write`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'status=rejected',
  })

  assert.equal(response.status, 415)
  assert.equal(wrote, before, 'the handler must not have run')
})

test('a json write is accepted', async () => {
  const response = await fetch(`${base}/api/write`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'contacted' }),
  })

  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).got, { status: 'contacted' })
})

test('no CORS headers are ever sent', async () => {
  // Without these a permitted read cannot be read back by another origin, which
  // is the second half of the protection above.
  const response = await fetch(`${base}/api/ping`)
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('a demo that has not been built says how to build it', async () => {
  const response = await fetch(`${base}/demo/not-a-real-prospect/`)

  assert.equal(response.status, 404)
  assert.match(await response.text(), /htpfinder build not-a-real-prospect --run/)
})

test('a demo path cannot escape the demos directory', async () => {
  // Encoded, because fetch normalises ../ out of a URL before sending it.
  const response = await fetch(`${base}/demo/..%2f..%2fpackage.json`)
  assert.ok(response.status === 403 || response.status === 404, `got ${response.status}`)
  assert.doesNotMatch(await response.text(), /htpfinder-cli/)
})

async function ndjson(body) {
  const response = await fetch(`${base}/api/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  return {
    status: response.status,
    lines: text.trim().split('\n').map((line) => JSON.parse(line)),
  }
}

test('a streaming route reports as it works and ends with its result', async () => {
  const { status, lines } = await ndjson({})

  assert.equal(status, 200)
  assert.deepEqual(lines.map((line) => line.event), ['progress', 'progress', 'done'])
  assert.deepEqual(lines.at(-1).result, { finished: true })
})

test('a streaming route that fails halfway sends an error line', async () => {
  // The 200 left with the first byte, so a status code cannot carry this.
  const { status, lines } = await ndjson({ fail: true })

  assert.equal(status, 200)
  assert.equal(lines.at(-1).event, 'error')
  assert.equal(lines.at(-1).error, 'halfway through')
})

test('a streaming route still refuses a write that is not json', async () => {
  const response = await fetch(`${base}/api/stream`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{}',
  })
  assert.equal(response.status, 415)
})

test('an unknown route is a 404 rather than a crash', async () => {
  const response = await fetch(`${base}/api/nope`)
  assert.equal(response.status, 404)
})

test('a handler that throws answers with its message', async () => {
  const boom = createServer([
    {
      method: 'GET',
      path: '/api/boom',
      handler: async () => {
        throw new Error('something specific went wrong')
      },
    },
  ])
  await new Promise((resolve) => boom.listen(0, '127.0.0.1', resolve))

  const response = await fetch(`http://127.0.0.1:${boom.address().port}/api/boom`)
  assert.equal(response.status, 500)
  assert.equal((await response.json()).error, 'something specific went wrong')

  boom.close()
})
