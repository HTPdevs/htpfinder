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

export const api = {
  state: () => request('/api/state'),

  prospect: (slug) => request(`/api/prospects/${encodeURIComponent(slug)}`),
  packet: (slug) => request(`/api/prospects/${encodeURIComponent(slug)}/packet`),
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

  collect: (options) => request('/api/collect', { method: 'POST', body: options }),

  syncStatus: () => request('/api/sync/status'),
  syncPush: (options = {}) => request('/api/sync/push', { method: 'POST', body: options }),
  syncPull: (options = {}) => request('/api/sync/pull', { method: 'POST', body: options }),
}
