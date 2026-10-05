import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  countChannels,
  estimateSearchCost,
  findLeads,
  matchesLocation,
  normalizeBusiness,
  pitchFor,
  scoreLead,
} from '../src/lib/inbox.js'
import { parseTregOutput } from '../src/lib/treg.js'
import { TIERS } from '../src/lib/widgets.js'
import { loadVertical } from '../src/lib/verticals.js'

const vertical = loadVertical('dental')

const row = {
  id: 'abc',
  match_score: 169,
  content: {
    business_name: 'Cape Dental Care',
    website_url: 'https://capedental.com/',
    root_domain: 'capedental.com',
    business_phones: ['+12395551212'],
    business_emails: ['front@capedental.com'],
    city: 'Cape Coral',
    state: 'Florida',
    google_rating: 4.9,
    google_reviews_count: 562,
    business_type: 'Dentist',
    staffs: [{ name: 'A', role: 'Owner' }, { name: 'B', role: 'Office Manager' }],
    social_media_links: {
      FACEBOOK: ['https://facebook.com/CapeDentalCare/'],
      INSTAGRAM: ['https://instagram.com/capedentalcares/'],
      LINKEDIN: null,
    },
  },
}

test('a provider row normalizes to the fields the pipeline uses', () => {
  const business = normalizeBusiness(row)
  assert.equal(business.name, 'Cape Dental Care')
  assert.equal(business.domain, 'capedental.com')
  assert.equal(business.reviewCount, 562)
  assert.equal(business.staffNamed, 2)
  assert.equal(business.socials.instagram, 'https://instagram.com/capedentalcares/')
  // A null social must not become a channel.
  assert.equal(business.socials.linkedin, undefined)
})

test('channels count every way in, including the widget', () => {
  const business = normalizeBusiness(row)
  const site = { vendors: [{ id: 'podium', tier: TIERS.INBOX_PLATFORM }], tier: TIERS.INBOX_PLATFORM }
  const channels = countChannels(business, site)
  assert.deepEqual(channels, ['phone', 'email', 'facebook', 'instagram', 'web chat'])
})

test('a business already paying a suite outscores a greenfield one', () => {
  const business = normalizeBusiness(row)
  const paying = scoreLead({
    business,
    site: { tier: TIERS.INBOX_PLATFORM, vendors: [{ id: 'podium', label: 'Podium', tier: TIERS.INBOX_PLATFORM }] },
    vertical,
  })
  const cold = scoreLead({ business, site: { tier: TIERS.NONE, vendors: [] }, vertical })
  assert.ok(paying.total > cold.total)
  assert.match(paying.reasons.join(' '), /budget and procurement are settled/)
})

test('every score contribution is explained', () => {
  const score = scoreLead({
    business: normalizeBusiness(row),
    site: { tier: TIERS.SOCIAL_CLICK, vendors: [{ id: 'whatsapp-link', label: 'WhatsApp link', tier: TIERS.SOCIAL_CLICK }] },
    vertical,
  })
  assert.ok(score.reasons.length >= 5)
  score.reasons.forEach((reason) => assert.match(reason, /\(\+\d+\)/))
})

test('a thin staff list is scored as unconfirmed rather than as a headcount', () => {
  const thin = normalizeBusiness({ content: { ...row.content, staffs: [{ name: 'A', role: 'Owner' }] } })
  const score = scoreLead({ business: thin, site: { tier: TIERS.NONE, vendors: [] }, vertical })
  assert.match(score.reasons.join(' '), /floor and not a headcount/)
})

test('the pitch angle follows the tier', () => {
  assert.equal(pitchFor({ tier: TIERS.INBOX_PLATFORM }), 'switch')
  assert.equal(pitchFor({ tier: TIERS.CHAT_WIDGET }), 'upgrade')
  assert.equal(pitchFor({ tier: TIERS.SOCIAL_CLICK }), 'consolidate')
  assert.equal(pitchFor({ tier: TIERS.NONE }), 'cold')
})

test('location is matched locally because the provider ignores it', () => {
  const business = normalizeBusiness(row)
  assert.ok(matchesLocation(business, 'Cape Coral, FL'))
  assert.ok(!matchesLocation(business, 'Phoenix, AZ'))
  assert.ok(matchesLocation(business, null))
})

test('the charge line the CLI appends to the json body is stripped', () => {
  const parsed = parseTregOutput('{"output":{"ok":true}}treg: charged $0.0894 · call id 03f2669')
  assert.deepEqual(parsed.output, { ok: true })
  assert.equal(parsed.cost, 0.0894)
})

test('a sweep drops off location rows, excludes chatwoot, and ranks what is left', async () => {
  const chatwootRow = {
    id: 'cw',
    content: { ...row.content, business_name: 'Already Sorted Dental', root_domain: 'sorted.com', website_url: 'https://sorted.com' },
  }
  const farRow = {
    id: 'far',
    content: { ...row.content, business_name: 'Far Dental', root_domain: 'far.com', website_url: 'https://far.com', city: 'Fargo', state: 'North Dakota' },
  }

  const call = async () => ({ output: { 0: row, 1: chatwootRow, 2: farRow }, cost: 0.027, callId: 'x', servedBy: 'openmart' })
  const inspectImpl = async (url) => {
    if (url === 'https://sorted.com') return { tier: TIERS.CHATWOOT, vendors: [{ id: 'chatwoot', label: 'Chatwoot', tier: TIERS.CHATWOOT }], uncertain: false, reachable: true, url }
    return { tier: TIERS.SOCIAL_CLICK, vendors: [{ id: 'whatsapp-link', label: 'WhatsApp link', tier: TIERS.SOCIAL_CLICK }], uncertain: false, reachable: true, url }
  }

  const result = await findLeads({ vertical: 'dental', near: 'Cape Coral, FL', limit: 3, call, inspectImpl })

  assert.equal(result.offLocation, 1)
  assert.equal(result.leads.length, 1)
  assert.equal(result.leads[0].business.name, 'Cape Dental Care')
  assert.equal(result.skipped[0].why, 'already runs Chatwoot')
  assert.ok(result.cost > 0)
})

test('a blocked site earns no tier points and is pitched as unknown', () => {
  const business = normalizeBusiness(row)
  const blocked = { tier: TIERS.NONE, vendors: [], blocked: true, uncertain: true }
  const empty = { tier: TIERS.NONE, vendors: [], blocked: false, uncertain: true }
  assert.ok(scoreLead({ business, site: blocked, vertical }).total < scoreLead({ business, site: empty, vertical }).total)
  assert.match(scoreLead({ business, site: blocked, vertical }).reasons.join(' '), /vendor is unknown/)
  assert.equal(pitchFor(blocked), 'unknown')
})

test('the cost estimate models the provider rounding up per call', () => {
  // Observed live: 10 rows settled at $0.0894 and a 4 row call reserved $0.0596.
  assert.ok(Math.abs(estimateSearchCost(10) - 0.0894) < 0.0005)
  assert.ok(Math.abs(estimateSearchCost(4) - 0.0596) < 0.0005)
  // Splitting a sweep across keywords costs more than asking once.
  assert.ok(3 * estimateSearchCost(4) > estimateSearchCost(12))
  assert.equal(estimateSearchCost(0), 0)
})

test('an unknown vertical fails with the list of real ones', async () => {
  await assert.rejects(() => findLeads({ vertical: 'nope' }), /Unknown vertical/)
})
