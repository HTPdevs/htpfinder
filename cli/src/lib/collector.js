/**
 * Sweeping Places and deciding what to keep.
 *
 * Lifted out of the collect command so the command and the local UI run the
 * same code. Returns results as data and leaves the reporting to the caller,
 * which is what lets the UI show a dry run and then commit the same pass.
 */

import fs from 'node:fs'
import path from 'node:path'

import { collectPlaces, normalizePlace } from './places.js'
import { classifyWebsite, qualifies, scoreProspect, WEBSITE_STATUS } from './qualify.js'
import { emptyProspect } from './schema.js'
import { loadProfile } from './profiles.js'
import { uniqueSlug } from './slug.js'
import { FIXTURES_ROOT, listProspectSlugs, prospectDir, prospectFile, readJson, writeJson } from './paths.js'

export class CollectError extends Error {
  constructor(message, { code = 'collect_failed' } = {}) {
    super(message)
    this.name = 'CollectError'
    this.code = code
  }
}

export function listFixtures() {
  if (!fs.existsSync(FIXTURES_ROOT)) return []
  return fs
    .readdirSync(FIXTURES_ROOT)
    .filter((name) => name.endsWith('.json'))
    .sort()
}

function readFixture(name) {
  const file = path.isAbsolute(name) ? name : path.join(FIXTURES_ROOT, name)
  if (!fs.existsSync(file)) throw new CollectError(`Fixture not found: ${file}`, { code: 'no_fixture' })
  const raw = readJson(file)
  return { places: raw.places || raw, label: path.basename(file) }
}

function shallowClassify(url) {
  if (!url) return { status: WEBSITE_STATUS.NONE, reason: 'no website listed' }
  return { status: WEBSITE_STATUS.LIVE, reason: 'not checked', url, uncertain: true }
}

/**
 * One collection pass.
 *
 * With `dryRun` nothing is written, and the returned results are identical to
 * what a real pass would produce. That is what makes preview then confirm
 * honest: the second run is not a different decision, it is the same one.
 */
export async function collect({
  industry,
  near,
  limit = 60,
  fixture = null,
  keepLive = false,
  check = true,
  dryRun = false,
  onProgress = () => {},
} = {}) {
  if (!industry) throw new CollectError('An industry is required.', { code: 'no_industry' })
  if (!near && !fixture) {
    throw new CollectError('A place to search near is required.', { code: 'no_near' })
  }

  const profile = await loadProfile(industry)

  let places
  let source
  if (fixture) {
    const read = readFixture(fixture)
    places = read.places.slice(0, limit)
    source = `fixture ${read.label}`
    onProgress({ message: `Reading ${places.length} recorded places from ${read.label}` })
  } else {
    onProgress({ message: `Searching Places for ${profile.label} near ${near}` })
    places = await collectPlaces({
      profile,
      near,
      limit,
      onProgress: ({ query, total }) => onProgress({ message: `    ${query} -> ${total} unique` }),
    })
    source = 'google-places'
  }

  const normalized = places.map(normalizePlace)
  const operating = normalized.filter(
    (place) => !place.businessStatus || place.businessStatus === 'OPERATIONAL'
  )
  const closed = normalized.length - operating.length

  const taken = listProspectSlugs()
  const results = []

  for (const place of operating) {
    const website = check ? await classifyWebsite(place.websiteUri) : shallowClassify(place.websiteUri)

    if (!(keepLive || qualifies(website.status))) {
      results.push({ kept: false, name: place.name, website, place })
      continue
    }

    const slug = uniqueSlug(place.name, taken)
    taken.push(slug)

    const score = scoreProspect(
      {
        rating: place.rating,
        reviewCount: place.reviewCount,
        websiteStatus: website.status,
        hasPhone: Boolean(place.phone),
      },
      profile
    )

    results.push({ kept: true, slug, name: place.name, website, score, place })

    if (!dryRun) {
      writeProspect({ place, website, slug, score, profile, fromFixture: Boolean(fixture) })
    }
  }

  results.sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0))

  return {
    industry: profile.id,
    industryLabel: profile.label,
    source,
    dryRun,
    closed,
    kept: results.filter((r) => r.kept),
    skipped: results.filter((r) => !r.kept),
  }
}

export function writeProspect({ place, website, slug, score, profile, fromFixture }) {
  const now = new Date().toISOString()
  const dir = prospectDir(slug)

  // Raw Places output is kept verbatim next to the derived file, so a later
  // change to how facts are extracted never requires paying for the search
  // again, and any extraction bug stays auditable against the original.
  writeJson(path.join(dir, 'raw.json'), { collectedAt: now, source: 'google-places', place })

  const existing = fs.existsSync(prospectFile(slug, 'prospect.json'))
    ? readJson(prospectFile(slug, 'prospect.json'))
    : null

  const prospect = existing || emptyProspect({ slug, industry: profile.id, collectedAt: now })
  const mapsUri = place.mapsUri || null

  // Fixture runs are for offline development. Marking the prospect keeps
  // placeholder data from ever reaching a page that carries a real name.
  prospect.provenance = fromFixture ? 'fixture' : 'google-places'
  prospect.placeId = place.placeId || null
  prospect.score = score
  prospect.website = {
    listed: place.websiteUri || null,
    status: website.status,
    reason: website.reason,
    uncertain: Boolean(website.uncertain),
    checkedAt: now,
  }

  // Only overwrite facts Places is authoritative for. Anything enrichment
  // added by hand survives a re-collect.
  prospect.facts.name = place.name ? { value: place.name, source: mapsUri } : null
  prospect.facts.phone = place.phone ? { value: place.phone, source: mapsUri } : null
  prospect.facts.address = place.address ? { value: place.address, source: mapsUri } : null
  prospect.facts.hours = place.hours?.length
    ? { value: place.hours.join('; '), source: mapsUri }
    : null
  prospect.facts.location = place.location || null
  prospect.facts.placesTypes = place.types?.length ? place.types : null

  const googleRating =
    place.rating != null
      ? { source: 'Google', url: mapsUri, score: place.rating, count: place.reviewCount || 0 }
      : null
  const otherRatings = (prospect.facts.ratings || []).filter((r) => r.source !== 'Google')
  prospect.facts.ratings = googleRating ? [googleRating, ...otherRatings] : otherRatings

  // Google review text arrives verbatim with an attributable author and a URL,
  // which is exactly what the validator demands of a quote.
  const googleQuotes = place.reviews.map((review) => ({
    text: review.text,
    author: review.author,
    source: 'Google',
    url: review.url,
    rating: review.rating,
  }))
  const otherQuotes = (prospect.facts.reviewQuotes || []).filter((q) => q.source !== 'Google')
  prospect.facts.reviewQuotes = [...googleQuotes, ...otherQuotes]

  writeJson(prospectFile(slug, 'prospect.json'), prospect)
  return prospect
}
