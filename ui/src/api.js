/**
 * Talking to the local server.
 *
 * Every mutation sends application/json, which is not a formality: the server
 * requires it precisely so that a cross origin request, which cannot set that
 * header without a preflight, never reaches a handler.
 */

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with ${response.status}`)
    error.code = payload.code
    error.problems = payload.problems
    error.slugs = payload.slugs
    throw error
  }
  return payload
}

/**
 * A POST that reports as it works, one JSON object per line.
 *
 * Still a POST rather than an EventSource, because the server requires
 * application/json on every mutation and that requirement is what stops a page
 * on the internet from starting a sweep on this machine.
 *
 * The final line carries the result. A failure halfway through arrives as an
 * error line, since the 200 went out with the first byte.
 */
async function stream(path, body, onEvent) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || `Request failed with ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // The last piece is whatever arrived without its newline yet.
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line)

      if (event.event === 'error') {
        const error = new Error(event.error)
        error.code = event.code
        throw error
      }
      if (event.event === 'done') result = event.result
      else onEvent?.(event)
    }
  }

  return result
}

export const api = {
  state: () => request('/api/state'),

  prospect: (slug) => request(`/api/prospects/${encodeURIComponent(slug)}`),
  packet: (slug) => request(`/api/prospects/${encodeURIComponent(slug)}/packet`),
  enrich: (slug, options = {}) =>
    request(`/api/prospects/${encodeURIComponent(slug)}/enrich`, { method: 'POST', body: options }),
  build: (slug, options) =>
    request(`/api/prospects/${encodeURIComponent(slug)}/build`, { method: 'POST', body: options }),
  setStatus: (slug, status) =>
    request(`/api/prospects/${encodeURIComponent(slug)}/status`, {
      method: 'POST',
      body: { status },
    }),

  industries: () => request('/api/industries'),
  industryBrief: (id) => request(`/api/industries/${encodeURIComponent(id)}/brief`),
  palettes: () => request('/api/palettes'),

  collect: (options, onProgress) => stream('/api/collect', options, onProgress),

  syncStatus: () => request('/api/sync/status'),
  syncPush: (options = {}) => request('/api/sync/push', { method: 'POST', body: options }),
  syncPull: (options = {}) => request('/api/sync/pull', { method: 'POST', body: options }),
}
