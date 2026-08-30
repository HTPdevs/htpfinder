import fs from 'node:fs'
import path from 'node:path'

import * as log from '../lib/log.js'
import { collectPlaces, MissingApiKeyError, normalizePlace } from '../lib/places.js'
import { classifyWebsite, qualifies, scoreProspect, WEBSITE_STATUS } from '../lib/qualify.js'
import { emptyProspect } from '../lib/schema.js'
import { loadProfile } from '../lib/profiles.js'
import { uniqueSlug } from '../lib/slug.js'
import {
  FIXTURES_ROOT,
  listProspectSlugs,
  prospectDir,
  prospectFile,
  readJson,
  writeJson,
} from '../lib/paths.js'

export const help = `
htpfinder collect <industry> --near "<place>" [options]

  Sweeps Google Places for businesses in an industry, keeps the ones without a
  real website, and writes a collected prospect file for each.

Options
  --near <place>     Required. Any place string Google understands.
  --limit <n>        Max places to consider. Default 60.
  --fixture <file>   Read recorded Places results instead of calling the API.
                     Useful offline, and for testing without spending quota.
  --keep-live        Also record businesses that already have a working site.
  --no-check         Skip the fetch that detects parked and broken domains.
  --dry-run          Print what would be written without writing anything.
`

export async function run(args) {
  const industry = args._[0]
  if (!industry) {
    log.fail('An industry is required. Try: htpfinder industries')
    return 1
  }
  if (!args.near && !args.fixture) {
    log.fail('--near is required, for example --near "Portland, OR"')
    return 1
  }

  const profile = await loadProfile(industry)
  const limit = Number(args.limit) || 60

  let places
  if (args.fixture) {
    const file = path.isAbsolute(args.fixture)
      ? args.fixture
      : path.join(FIXTURES_ROOT, args.fixture)
    if (!fs.existsSync(file)) {
      log.fail(`Fixture not found: ${file}`)
      return 1
    }
    const raw = readJson(file)
    places = (raw.places || raw).slice(0, limit)
    log.step(`Reading ${places.length} recorded places from ${path.basename(file)}`)
  } else {
    try {
      log.step(`Searching Places for ${profile.label} near ${args.near}`)
      places = await collectPlaces({
        profile,
        near: args.near,
        limit,
        onProgress: ({ query, total }) => log.info(log.dim(`    ${query} -> ${total} unique`)),
      })
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        log.fail(err.message)
        return 1
      }
      throw err
    }
  }

  const normalized = places.map(normalizePlace)
  const operating = normalized.filter(
    (place) => !place.businessStatus || place.businessStatus === 'OPERATIONAL'
  )
  if (operating.length !== normalized.length) {
    log.info(log.dim(`    skipped ${normalized.length - operating.length} closed or moved`))
  }

  const taken = listProspectSlugs()
  const results = []

  for (const place of operating) {
    const website = args['no-check']
      ? shallowClassify(place.websiteUri)
      : await classifyWebsite(place.websiteUri)

    const keep = args['keep-live'] || qualifies(website.status)
    if (!keep) {
      results.push({ place, website, kept: false })
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

    results.push({ place, website, kept: true, slug, score })

    if (args['dry-run']) continue

    writeProspect({ place, website, slug, score, profile, fromFixture: Boolean(args.fixture) })
  }

  report(results, { dryRun: Boolean(args['dry-run']) })
  return 0
}

function shallowClassify(url) {
  if (!url) return { status: WEBSITE_STATUS.NONE, reason: 'no website listed' }
  return { status: WEBSITE_STATUS.LIVE, reason: 'not checked', url, uncertain: true }
}

function writeProspect({ place, website, slug, score, profile, fromFixture }) {
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
}

function report(results, { dryRun }) {
  const kept = results.filter((r) => r.kept)
  const skipped = results.filter((r) => !r.kept)

  kept.sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0))

  log.info('')
  log.table(kept, [
    { label: 'SCORE', get: (r) => r.score?.total ?? '' },
    { label: 'SLUG', get: (r) => r.slug },
    { label: 'REVIEWS', get: (r) => r.place.reviewCount },
    { label: 'RATING', get: (r) => r.place.rating ?? '' },
    { label: 'PHONE', get: (r) => (r.place.phone ? 'yes' : 'no') },
    { label: 'WHY', get: (r) => r.website.reason },
  ])

  log.info('')
  const uncertain = kept.filter((r) => r.website.uncertain)
  if (uncertain.length) {
    log.warn(
      `${uncertain.length} site check(s) were inconclusive, so those may still have a live site. ` +
        'Confirm before outreach.'
    )
  }
  log.ok(
    `${kept.length} prospect${kept.length === 1 ? '' : 's'} ${dryRun ? 'would be written' : 'written'}, ` +
      `${skipped.length} skipped for having a working site.`
  )
  if (!dryRun && kept.length) {
    log.info(log.dim('Next: htpfinder packet <slug> to prepare the enrichment step.'))
  }
}
