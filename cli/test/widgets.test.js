import assert from 'node:assert/strict'
import { test } from 'node:test'

import { detectVendors, inspectSite, primaryTier, TIERS } from '../src/lib/widgets.js'

const page = (body) => async () => ({ ok: true, status: 200, url: 'https://example.com', text: async () => body })

test('a messaging suite is detected and ranked above a chat widget', () => {
  const vendors = detectVendors(
    '<script src="https://assets.podium.com/widget.js"></script>' +
      '<script src="https://embed.tawk.to/abc/default"></script>'
  )
  const ids = vendors.map((vendor) => vendor.id)
  assert.ok(ids.includes('podium'))
  assert.ok(ids.includes('tawk'))
  assert.equal(primaryTier(vendors), TIERS.INBOX_PLATFORM)
})

test('a whatsapp link counts as messaging, not as an empty page', () => {
  const vendors = detectVendors('<a href="https://wa.me/15555551234">Text us</a>')
  assert.equal(vendors[0].id, 'whatsapp-link')
  assert.equal(primaryTier(vendors), TIERS.SOCIAL_CLICK)
})

test('detection is case insensitive', () => {
  assert.equal(detectVendors('<SCRIPT SRC="https://CLIENT.CRISP.CHAT/l.js">').length, 1)
})

test('a page with nothing on it is reported as uncertain rather than as proof', async () => {
  const result = await inspectSite('https://example.com', { fetchImpl: page('<html><body>hi</body></html>') })
  assert.equal(result.tier, TIERS.NONE)
  assert.equal(result.uncertain, true)
})

test('a found vendor is not uncertain', async () => {
  const result = await inspectSite('https://example.com', {
    fetchImpl: page('<script src="https://getweave.com/chat.js"></script>'),
  })
  assert.equal(result.tier, TIERS.INBOX_PLATFORM)
  assert.equal(result.uncertain, false)
})

test('a site that refuses the check is marked blocked, not empty', async () => {
  const result = await inspectSite('https://example.com', {
    fetchImpl: async () => ({ ok: false, status: 403, url: 'https://example.com' }),
  })
  assert.equal(result.blocked, true)
  assert.equal(result.uncertain, true)
  assert.match(result.reason, /vendor unknown/)
})

test('a genuine error code is not treated as a block', async () => {
  const result = await inspectSite('https://example.com', {
    fetchImpl: async () => ({ ok: false, status: 500, url: 'https://example.com' }),
  })
  assert.equal(result.blocked, false)
})

test('an unreachable homepage does not throw', async () => {
  const result = await inspectSite('https://example.com', {
    fetchImpl: async () => {
      throw Object.assign(new Error('nope'), { code: 'ENOTFOUND' })
    },
  })
  assert.equal(result.reachable, false)
  assert.match(result.reason, /did not load/)
})

test('chatwoot is its own tier so it can be excluded', () => {
  assert.equal(primaryTier(detectVendors('<script>window.chatwootSDK.run()</script>')), TIERS.CHATWOOT)
})
