import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fromRow, sameContent, toRow } from '../src/lib/store.js'
import { emptyProspect, SCHEMA_VERSION } from '../src/lib/schema.js'

/**
 * The round trip is the whole risk in the store.
 *
 * A prospect is hours of sourced research. If `toRow` and `fromRow` are not
 * exact inverses, a push followed by a pull quietly rewrites that research into
 * something slightly wrong, and nothing in the pipeline would notice.
 */

function enriched() {
  return {
    schemaVersion: SCHEMA_VERSION,
    slug: 'meadowline-yard',
    industry: 'lawn-care',
    status: 'enriched',
    provenance: 'manual-research',
    placeId: 'ChIJexample',
    collectedAt: '2026-08-26T00:00:00.000Z',
    enrichedAt: '2026-08-27T12:30:00.000Z',
    score: { total: 72, reasons: ['no website listed', '49 reviews'] },
    website: { listed: null, status: 'none', reason: 'no website listed', uncertain: false },
    facts: {
      name: { value: 'Meadowline Yard', source: 'https://maps.google.com/?cid=1' },
      phone: { value: '(503) 555-0142', source: 'https://maps.google.com/?cid=1' },
      address: null,
      hours: null,
      location: { latitude: 45.54, longitude: -122.81 },
      placesTypes: ['landscaper'],
      ratings: [{ source: 'Google', url: 'https://maps.google.com/?cid=1', score: 4.3, count: 49 }],
      yearsInBusiness: { value: 15, approx: true, source: 'https://www.bbb.org/x' },
      crewSize: null,
      ownerName: { value: 'A Name', source: 'https://www.bbb.org/x' },
      paymentMethods: { value: ['cash', 'check'], source: 'https://www.bbb.org/x' },
      freeEstimates: { value: true, source: 'https://www.bbb.org/x' },
      languages: null,
      certifications: null,
      services: [{ key: 'mowing', blurb: 'Weekly cuts.', source: 'https://www.bbb.org/x' }],
      serviceArea: { value: ['Portland'], source: 'https://www.bbb.org/x', confirmed: false },
      reviewQuotes: [
        { text: 'On time, every time.', author: 'A Reviewer', source: 'Google', url: 'https://maps.google.com/?cid=1' },
      ],
    },
    unresolved: ['BBB and Angi list different addresses. Address omitted.'],
    copy: { seo: { title: 'Meadowline Yard' }, hero: { headline: 'Yard work, done right' } },
    design: { paletteId: 'autumn-sienna', motif: 'mow-stripes', mark: 'leaf' },
  }
}

/**
 * Stands in for what PostgREST hands back, timestamp formatting included.
 *
 * Postgres returns an offset where JavaScript returns a Z, which is exactly the
 * shape that would make a naive comparison report every row as different.
 */
const asPostgresTimestamp = (iso) => (iso ? iso.replace(/\.\d+Z$/, '+00:00') : null)

/**
 * jsonb stores a parsed document, not its text, and hands object keys back
 * ordered by length then bytewise. Reproducing that here is what makes these
 * tests answer the question a real push asks, rather than an easier one.
 */
function asJsonb(value) {
  if (Array.isArray(value)) return value.map(asJsonb)
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
    return Object.fromEntries(keys.map((key) => [key, asJsonb(value[key])]))
  }
  return value
}

function asStoredRow(prospect, overrides = {}) {
  const row = asJsonb(toRow(prospect))
  return {
    ...row,
    id: '00000000-0000-0000-0000-000000000001',
    owner_id: '00000000-0000-0000-0000-000000000002',
    collected_at: asPostgresTimestamp(row.collected_at),
    enriched_at: asPostgresTimestamp(row.enriched_at),
    created_at: '2026-08-30T00:00:00+00:00',
    updated_at: '2026-08-30T00:00:00+00:00',
    deleted_at: null,
    ...overrides,
  }
}

test('a fully enriched prospect survives the round trip unchanged', () => {
  const before = enriched()
  const after = fromRow(asStoredRow(before))
  assert.deepEqual(after, before)
})

test('a freshly collected prospect survives the round trip unchanged', () => {
  const before = emptyProspect({
    slug: 'alder-street-yard-care',
    industry: 'lawn-care',
    collectedAt: '2026-08-29T00:00:00.000Z',
  })
  before.provenance = 'google-places'

  const after = fromRow(asStoredRow(before))
  assert.deepEqual(after, before)
})

test('a row does not share mutable state with the prospect it came from', () => {
  // Without a copy here, comparing a local file against a stored row compares
  // an object with itself, every prospect reads as in sync, and push does
  // nothing while reporting success.
  const prospect = enriched()
  const row = toRow(prospect)

  prospect.facts.crewSize = { value: 5, source: 'https://www.bbb.org/x' }
  prospect.copy.hero.headline = 'Changed'
  prospect.unresolved.push('another conflict')

  assert.equal(row.facts.crewSize, null)
  assert.equal(row.copy.hero.headline, 'Yard work, done right')
  assert.equal(row.unresolved.length, 1)
})

test('no score stays no score, rather than becoming a score of zero', () => {
  const prospect = { ...enriched(), score: null }
  const row = toRow(prospect)

  assert.equal(row.score_total, null)
  assert.equal(fromRow(asStoredRow(prospect)).score, null)

  // The distinction that makes this worth a test: zero is a real score.
  const zero = { ...enriched(), score: { total: 0, reasons: ['has a live site'] } }
  assert.deepEqual(fromRow(asStoredRow(zero)).score, { total: 0, reasons: ['has a live site'] })
})

test('the raw Places response is never part of a row', () => {
  const columns = Object.keys(toRow(enriched()))

  // Google's terms restrict storing Places content. The place id is the one
  // identifier they allow keeping, and it is the only one here.
  assert.ok(columns.includes('google_place_id'))
  assert.ok(!columns.some((column) => /raw|places_response|review_text/.test(column)))
})

test('a prospect with no provenance is refused rather than guessed at', () => {
  const prospect = enriched()
  delete prospect.provenance

  assert.throws(() => toRow(prospect), /provenance is missing/)
})

test('a prospect with no slug is refused', () => {
  assert.throws(() => toRow({ ...enriched(), slug: undefined }), /no slug/)
})

test('sameContent ignores the bookkeeping the database keeps for itself', () => {
  const prospect = enriched()
  const row = asStoredRow(prospect, { updated_at: '2027-01-01T00:00:00+00:00' })

  assert.equal(sameContent(prospect, row), true)
})

test('sameContent survives jsonb reordering the keys', () => {
  // Without this, a push reports success and the very next status calls every
  // prospect changed, so push is never idempotent and re pushes everything.
  const prospect = enriched()
  const row = asStoredRow(prospect)

  const order = Object.keys(row.website)
  assert.notDeepEqual(order, Object.keys(prospect.website), 'the fixture should reorder keys')
  assert.equal(sameContent(prospect, row), true)
})

test('sameContent notices a real edit', () => {
  const prospect = enriched()
  const row = asStoredRow(prospect)

  prospect.facts.crewSize = { value: 5, source: 'https://www.bbb.org/x' }
  assert.equal(sameContent(prospect, row), false)
})

test('sameContent notices an edit buried in the copy', () => {
  const prospect = enriched()
  const row = asStoredRow(prospect)

  prospect.copy.hero.headline = 'Yard work, done well'
  assert.equal(sameContent(prospect, row), false)
})
