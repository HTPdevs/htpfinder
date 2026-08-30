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

/**
 * The order fields are written in.
 *
 * jsonb stores a parsed document rather than its text, so anything read back
 * from the database arrives with object keys sorted by length. That loses
 * nothing, but `prospect.json` is a file people and agents read and edit, and
 * a file where `name` sits between `hours` and `address` is materially harder
 * to work with. Restoring the documented order on the way out keeps a pulled
 * prospect looking like a written one, and keeps diffs meaningful.
 */
const ORDER = {
  prospect: [
    'schemaVersion',
    'slug',
    'industry',
    'status',
    'provenance',
    'placeId',
    'collectedAt',
    'enrichedAt',
    'score',
    'website',
    'facts',
    'unresolved',
    'copy',
    'design',
  ],
  score: ['total', 'reasons'],
  website: ['listed', 'status', 'reason', 'uncertain', 'checkedAt'],
  fact: ['value', 'approx', 'source', 'confirmed'],
  location: ['latitude', 'longitude'],
  rating: ['source', 'url', 'score', 'count'],
  quote: ['text', 'author', 'source', 'url', 'rating', 'publishedAt'],
  service: ['key', 'blurb', 'source'],
  design: ['paletteId', 'motif', 'mark'],
  // Not COPY_SECTIONS: that lists the sections a build requires, and `nav` is
  // written during enrichment without being one of them.
  copy: ['seo', 'nav', ...COPY_SECTIONS.filter((section) => section !== 'seo')],
  seo: ['title', 'description', 'themeColor'],
  hero: ['eyebrow', 'headline', 'subhead', 'footnote', 'chips'],
  cta: ['primary', 'secondary', 'eyebrow', 'headline', 'body', 'points'],
  about: [
    'eyebrow',
    'headline',
    'body',
    'points',
    'stats',
    'servicesHeadline',
    'areaHeadline',
    'areaBody',
  ],
  reviews: ['eyebrow', 'headline', 'body', 'placeholder'],
  contact: ['eyebrow', 'headline', 'body', 'noPhoneNote', 'formPlaceholder', 'formButton'],
  footer: ['shortName', 'tagline', 'legalNote', 'sourceNote'],
}

/** Known keys first in the given order, then anything unrecognised, unchanged. */
function order(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const known = keys.filter((key) => key in value)
  const rest = Object.keys(value).filter((key) => !keys.includes(key))
  return Object.fromEntries([...known, ...rest].map((key) => [key, value[key]]))
}

const FACT_SHAPES = {
  location: ORDER.location,
  ratings: ORDER.rating,
  reviewQuotes: ORDER.quote,
  services: ORDER.service,
}

/** Rewrites a prospect with its fields in the documented order. */
export function orderProspect(prospect) {
  const facts = prospect.facts ?? {}
  const factKeys = Object.keys(emptyProspect({}).facts)

  const orderedFacts = order(
    Object.fromEntries(
      Object.entries(facts).map(([key, value]) => {
        const shape = FACT_SHAPES[key] || ORDER.fact
        return [key, Array.isArray(value) ? value.map((item) => order(item, shape)) : order(value, shape)]
      })
    ),
    factKeys
  )

  const copy =
    prospect.copy == null
      ? prospect.copy
      : order(
          Object.fromEntries(
            Object.entries(prospect.copy).map(([section, value]) => [
              section,
              ORDER[section] ? order(value, ORDER[section]) : value,
            ])
          ),
          ORDER.copy
        )

  return order(
    {
      ...prospect,
      score: order(prospect.score, ORDER.score),
      website: order(prospect.website, ORDER.website),
      facts: orderedFacts,
      copy,
      design: order(prospect.design, ORDER.design),
    },
    ORDER.prospect
  )
}

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
