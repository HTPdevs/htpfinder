import assert from 'node:assert/strict'
import { test } from 'node:test'

import lawnCare from '../industries/lawn-care.js'
import { summarize, validateProspect } from '../src/lib/validate.js'
import { SCHEMA_VERSION } from '../src/lib/schema.js'

/**
 * The build command treats a provenance error as unbypassable, unlike every
 * other validation error which `--force` can override. These tests pin the
 * shape build.js relies on to tell them apart.
 */
function fixtureProspect() {
  return {
    schemaVersion: SCHEMA_VERSION,
    slug: 'example',
    industry: 'lawn-care',
    status: 'collected',
    provenance: 'fixture',
    facts: {
      name: { value: 'Example', source: 'https://example.com/listing' },
      phone: null,
      ratings: [],
      services: [],
      reviewQuotes: [],
    },
    unresolved: [],
    design: { paletteId: 'autumn-sienna', motif: 'mow-stripes', mark: 'leaf' },
    copy: null,
  }
}

test('fixture provenance raises an error keyed on "provenance"', () => {
  // build.js filters on this exact path to decide what --force cannot skip.
  const { errors } = summarize(validateProspect(fixtureProspect(), lawnCare, { stage: 'build' }))
  const blocking = errors.filter((e) => e.path === 'provenance')
  assert.equal(blocking.length, 1)
  assert.match(blocking[0].message, /fixture/i)
})

test('live provenance raises no provenance error', () => {
  const prospect = fixtureProspect()
  prospect.provenance = 'google-places'
  const { errors } = summarize(validateProspect(prospect, lawnCare, { stage: 'build' }))
  assert.equal(errors.filter((e) => e.path === 'provenance').length, 0)
})

test('fixture provenance does not block the collect stage', () => {
  // Collecting from a fixture is a legitimate offline workflow. Only building
  // a page from one is forbidden.
  const { errors } = summarize(validateProspect(fixtureProspect(), lawnCare, { stage: 'collect' }))
  assert.equal(errors.length, 0)
})
