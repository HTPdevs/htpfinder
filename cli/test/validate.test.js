import assert from 'node:assert/strict'
import { test } from 'node:test'

import lawnCare from '../industries/lawn-care.js'
import { summarize, validateProspect } from '../src/lib/validate.js'
import { SCHEMA_VERSION } from '../src/lib/schema.js'

const SRC = 'https://example.com/listing'

function baseProspect(overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    slug: 'example-yard-care',
    industry: 'lawn-care',
    status: 'enriched',
    provenance: 'google-places',
    facts: {
      name: { value: 'Example Yard Care', source: SRC },
      phone: { value: '(503) 555-0100', source: SRC },
      address: null,
      hours: null,
      ratings: [{ source: 'Angi', url: SRC, score: 4.6, count: 30 }],
      services: [{ key: 'mowing', blurb: 'Regular mowing.', source: SRC }],
      reviewQuotes: [],
      serviceArea: { value: ['Portland'], source: SRC },
      yearsInBusiness: { value: 12, source: SRC },
    },
    unresolved: [],
    design: { paletteId: 'autumn-sienna', motif: 'mow-stripes', mark: 'leaf' },
    copy: {
      nav: [{ id: 'about', label: 'About' }],
      seo: { title: 'Example Yard Care', description: 'Yard care.' },
      hero: { headline: 'Yards handled properly.', subhead: 'Twelve years in business.' },
      cta: { primary: 'Get a quote', headline: 'Ask for a price.', body: 'We reply fast.' },
      about: { headline: 'About us', body: 'A small crew.' },
      reviews: { headline: 'Reviews', body: 'Rated well.' },
      contact: { headline: 'Get in touch', body: 'Call us.' },
      footer: { tagline: 'Yard care in Portland.' },
    },
    ...overrides,
  }
}

const errorsOf = (prospect) =>
  summarize(validateProspect(prospect, lawnCare, { stage: 'build' })).errors

test('a complete prospect passes', () => {
  assert.equal(errorsOf(baseProspect()).length, 0)
})

test('a fact without a source URL is rejected', () => {
  const prospect = baseProspect()
  prospect.facts.yearsInBusiness = { value: 12 }
  const errors = errorsOf(prospect)
  assert.ok(errors.some((e) => e.path === 'facts.yearsInBusiness'))
})

test('a review quote without a url is rejected', () => {
  // The single most damaging failure mode is a fabricated testimonial under a
  // real business name, so a quote that cannot be verified never ships.
  const prospect = baseProspect()
  prospect.facts.reviewQuotes = [{ text: 'They were great.', author: 'A. Person', source: 'Google' }]
  assert.ok(errorsOf(prospect).some((e) => e.path.startsWith('facts.reviewQuotes')))
})

test('a service outside the industry taxonomy is rejected', () => {
  const prospect = baseProspect()
  prospect.facts.services = [{ key: 'transmission', blurb: 'Nope.', source: SRC }]
  assert.ok(errorsOf(prospect).some((e) => e.message.includes('service taxonomy')))
})

test('a dash in copy is rejected but a phone number is not', () => {
  const withDash = baseProspect()
  withDash.copy.hero.headline = 'Yards handled properly, start to finish, every time'
  assert.equal(errorsOf(withDash).length, 0)

  withDash.copy.hero.headline = 'Yards handled properly — every time'
  assert.ok(errorsOf(withDash).some((e) => e.message.includes('dash')))

  const withPhone = baseProspect()
  withPhone.copy.contact.body = 'Call (503) 555-0100 for a quote.'
  assert.equal(errorsOf(withPhone).length, 0, 'phone separators stay exempt')
})

test('banned words are rejected', () => {
  const prospect = baseProspect()
  prospect.copy.about.body = 'We harness decades of experience.'
  assert.ok(errorsOf(prospect).some((e) => e.message.includes('banned word')))
})

test('a palette outside the allowed families is rejected', () => {
  const profile = { ...lawnCare, design: { ...lawnCare.design, paletteFamilies: ['icy-blue'] } }
  const errors = summarize(validateProspect(baseProspect(), profile, { stage: 'build' })).errors
  assert.ok(errors.some((e) => e.path === 'design.paletteId'))
})

test('fixture data cannot be built into a page', () => {
  const prospect = baseProspect({ provenance: 'fixture' })
  assert.ok(errorsOf(prospect).some((e) => e.path === 'provenance'))
})

test('the collect stage tolerates missing copy', () => {
  const prospect = baseProspect({ copy: null, design: null })
  const { errors } = summarize(validateProspect(prospect, lawnCare, { stage: 'collect' }))
  assert.equal(errors.length, 0)
})

test('grounding warnings fire when copy outruns the facts', () => {
  const prospect = baseProspect()
  prospect.facts.ownerName = null
  prospect.copy.about.body = 'An owner operated crew you can rely on.'
  const { warnings } = summarize(validateProspect(prospect, lawnCare, { stage: 'build' }))
  assert.ok(warnings.some((w) => w.message.includes('owner operated')))
})
