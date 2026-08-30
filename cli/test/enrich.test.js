import assert from 'node:assert/strict'
import { test } from 'node:test'

import lawnCare from '../industries/lawn-care.js'
import { hexOf, placeOf, writeCopy } from '../src/lib/enrich.js'
import { getPalette } from '../src/lib/palettes.js'
import { COPY_SECTIONS, SCHEMA_VERSION } from '../src/lib/schema.js'
import { summarize, validateProspect } from '../src/lib/validate.js'
import { walkStrings } from '../src/lib/copy-rules.js'

const PALETTE = getPalette('autumn-sienna')
const LISTING = 'https://maps.google.com/?cid=1'

/**
 * Generated copy has to clear the same bar as hand written copy, because the
 * validator is what stands between a demo page and a claim nobody sourced.
 * These pin the two ways a generator fails: writing something no fact
 * supports, and writing a sentence with a hole where a missing fact was.
 */
function collected(facts = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    slug: 'example-yard-care',
    industry: 'lawn-care',
    status: 'collected',
    provenance: 'google-places',
    facts: {
      name: { value: 'Example Yard Care', source: LISTING },
      phone: { value: '(503) 555-0134', source: LISTING },
      address: { value: '1234 SE Foo St, Portland, OR 97202, USA', source: LISTING },
      hours: null,
      ratings: [{ source: 'Google', url: LISTING, score: 4.7, count: 31 }],
      services: [],
      reviewQuotes: [],
      ...facts,
    },
    unresolved: [],
    design: { paletteId: PALETTE.id, motif: 'mow-stripes', mark: 'leaf' },
    copy: null,
  }
}

const strings = (copy) => [...walkStrings(copy)].map((entry) => entry.text)

test('generated copy fills every section a build requires', () => {
  const copy = writeCopy(collected(), lawnCare, PALETTE)
  COPY_SECTIONS.forEach((section) => assert.ok(copy[section], `${section} is missing`))
  assert.ok(copy.hero.headline)
  assert.ok(copy.seo.title)
})

test('a prospect with only collected facts validates for a build', () => {
  const prospect = collected()
  prospect.copy = writeCopy(prospect, lawnCare, PALETTE)

  const { errors } = summarize(validateProspect(prospect, lawnCare, { stage: 'build' }))
  assert.deepEqual(errors, [])
})

test('generated copy carries no dashes and no banned words', () => {
  const prospect = collected()
  prospect.copy = writeCopy(prospect, lawnCare, PALETTE)

  // The copy rules run over the whole document, so this asserts the same thing
  // the validator does. It is here as well because a generator that trips it
  // trips it for every prospect at once.
  const problems = validateProspect(prospect, lawnCare, { stage: 'build' })
  assert.equal(problems.filter((p) => /dash|banned/.test(p.message)).length, 0)
})

test('a missing fact removes its sentence rather than leaving a hole', () => {
  const copy = writeCopy(
    collected({ phone: null, address: null, ratings: [] }),
    lawnCare,
    PALETTE
  )

  const text = strings(copy).join(' ')
  assert.doesNotMatch(text, /undefined|null|NaN/)
  assert.doesNotMatch(text, /\bin \./)
  // No phone means the page leads with the form and says so.
  assert.ok(copy.contact.noPhoneNote)
  assert.doesNotMatch(copy.cta.primary, /call/i)
})

test('nothing is claimed that the facts do not carry', () => {
  const text = strings(writeCopy(collected(), lawnCare, PALETTE)).join(' ')

  // The grounding checks in the validator look for exactly these.
  assert.doesNotMatch(text, /\byears? in business\b/i)
  assert.doesNotMatch(text, /\b(certified|licensed|bonded|insured)\b/i)
  assert.doesNotMatch(text, /\bowner[\s']*(operated|run)\b/i)
})

test('a rating is only mentioned when one was collected', () => {
  const withRating = strings(writeCopy(collected(), lawnCare, PALETTE)).join(' ')
  assert.match(withRating, /4\.7/)

  const without = strings(writeCopy(collected({ ratings: [] }), lawnCare, PALETTE)).join(' ')
  assert.doesNotMatch(without, /\d\.\d on /)
})

test('the city comes out of a Places address, or nothing does', () => {
  assert.deepEqual(placeOf('1234 SE Foo St, Portland, OR 97202, USA'), {
    city: 'Portland',
    region: 'OR',
    full: 'Portland, OR',
  })
  // A short address with no state still names a city.
  assert.equal(placeOf('2820 SE Powell Blvd, Portland').city, 'Portland')
  assert.equal(placeOf(null), null)
})

test('the theme color is hex, because a meta tag cannot read HSL', () => {
  assert.match(hexOf(PALETTE.tokens.brand), /^#[0-9a-f]{6}$/)
  assert.equal(hexOf('0 0% 100%'), '#ffffff')
  assert.equal(hexOf('0 0% 0%'), '#000000')
})
