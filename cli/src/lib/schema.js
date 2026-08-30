/**
 * The prospect.json contract.
 *
 * Two ideas carry the whole design:
 *
 *   1. `facts` are claims about a real business and every one carries a source
 *      URL. `copy` is editorial text we wrote. Separating them makes provenance
 *      machine checkable instead of a promise in a code comment.
 *
 *   2. A missing fact is `null`, never an invented value. The renderer already
 *      degrades correctly around nulls: no phone drops the call action, no
 *      review text shows aggregate scores with an honest note.
 */

export const SCHEMA_VERSION = 1

export const STATUSES = ['collected', 'enriched', 'built', 'contacted', 'rejected']

/** A sourced claim. `approx` marks values a listing gave as a range or "about". */
export function fact(value, source, extra = {}) {
  return { value, source, ...extra }
}

/** Fields the collector fills from Places, before any agent involvement. */
export const COLLECTED_FACTS = [
  'name',
  'phone',
  'address',
  'hours',
  'ratings',
  'placesTypes',
  'location',
]

/** Fields only enrichment can fill, because they live on directory listings. */
export const ENRICHED_FACTS = [
  'yearsInBusiness',
  'crewSize',
  'ownerName',
  'paymentMethods',
  'freeEstimates',
  'languages',
  'certifications',
  'services',
  'serviceArea',
  'reviewQuotes',
]

export const COPY_SECTIONS = ['seo', 'hero', 'cta', 'about', 'reviews', 'contact', 'footer']

/**
 * Shape reference. Kept as a comment rather than a JSON Schema dependency,
 * since `validate.js` enforces it and this file stays dependency free.
 *
 * {
 *   schemaVersion: 1,
 *   slug: 'key-concepts-landscape',
 *   industry: 'lawn-care',
 *   status: 'enriched',
 *   collectedAt: '2026-08-26T00:00:00.000Z',
 *   enrichedAt: '2026-08-26T00:00:00.000Z',
 *   score: { total: 74, reasons: [...] },
 *
 *   facts: {
 *     name:        { value: 'Key Concepts Landscape', source: 'https://...' },
 *     phone:       { value: '(503) 839-8283', source: 'https://...' } | null,
 *     address:     { value: '...', source: '...' } | null,
 *     hours:       { value: 'Mon to Fri, 8am to 5pm', source: '...' } | null,
 *     ratings:     [ { source: 'Angi', url: '...', score: 4.8, count: 12 } ],
 *     yearsInBusiness: { value: 15, approx: true, source: '...' } | null,
 *     crewSize:    { value: 5, approx: true, source: '...' } | null,
 *     ownerName:   { value: 'Errin Jacobs', source: '...' } | null,
 *     paymentMethods: { value: ['cash', 'check'], source: '...' } | null,
 *     freeEstimates:  { value: true, source: '...' } | null,
 *     languages:   { value: ['English', 'Spanish'], source: '...' } | null,
 *     certifications: { value: ['ASE'], source: '...' } | null,
 *     services:    [ { key: 'mowing', blurb: '...', source: '...' } ],
 *     serviceArea: { value: ['Portland'], source: '...', confirmed: false } | null,
 *     reviewQuotes:[ { text: '...', author: '...', source: 'Google', url: '...' } ],
 *   },
 *
 *   // Conflicts and gaps worth raising on the call. Never silently resolved.
 *   unresolved: [ 'BBB and Angi list different addresses' ],
 *
 *   copy: { seo, hero, cta, about, reviews, contact, footer },
 *
 *   design: { paletteId: 'autumn-sienna', motif: 'mow-stripes', mark: 'leaf' },
 * }
 */

/** A blank prospect, used by the collector. */
export function emptyProspect({ slug, industry, collectedAt }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    slug,
    industry,
    status: 'collected',
    // Google's one durable identifier, and the only piece of the Places
    // response the store keeps. Everything else about a place is refetched.
    placeId: null,
    collectedAt,
    enrichedAt: null,
    score: null,
    website: null,
    facts: {
      name: null,
      phone: null,
      address: null,
      hours: null,
      location: null,
      placesTypes: null,
      ratings: [],
      yearsInBusiness: null,
      crewSize: null,
      ownerName: null,
      paymentMethods: null,
      freeEstimates: null,
      languages: null,
      certifications: null,
      services: [],
      serviceArea: null,
      reviewQuotes: [],
    },
    unresolved: [],
    copy: null,
    design: null,
  }
}
