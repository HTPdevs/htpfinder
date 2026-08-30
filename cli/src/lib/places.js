/**
 * Google Places API client.
 *
 * Places is the spine of stage one because it is the one legitimate, licensed
 * source that carries the qualifying signal itself: whether a business has a
 * website. It also gives name, phone, address, rating, review count, hours and
 * a handful of reviews in the same call.
 *
 * Set GOOGLE_PLACES_API_KEY in the environment. Fixture mode exists so the
 * rest of the pipeline can be developed and tested without spending quota.
 */

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'

const FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.primaryType',
  'places.types',
  'places.location',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.reviews',
].join(',')

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      'GOOGLE_PLACES_API_KEY is not set.\n' +
        'Either export a key, or run with --fixture to work from recorded results.'
    )
    this.name = 'MissingApiKeyError'
  }
}

/**
 * Runs one text search. Places caps a text search at 20 results per page and
 * returns a token for the next, so callers that want more must page.
 */
async function searchText({ query, apiKey, includedType, locationBias, pageToken, fetchImpl = fetch }) {
  const body = { textQuery: query }
  if (includedType) body.includedType = includedType
  if (locationBias) body.locationBias = locationBias
  if (pageToken) body.pageToken = pageToken

  const response = await fetchImpl(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': `${FIELDS},nextPageToken`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Places search failed (${response.status}): ${detail.slice(0, 300)}`)
  }
  return response.json()
}

/**
 * Sweeps every keyword in a profile against one location and returns unique
 * places. Category filters are coarse, so the keyword sweep is what actually
 * finds the small operators that matter here.
 */
export async function collectPlaces({
  profile,
  near,
  limit = 60,
  apiKey = process.env.GOOGLE_PLACES_API_KEY,
  fetchImpl = fetch,
  onProgress = () => {},
}) {
  if (!apiKey) throw new MissingApiKeyError()

  const seen = new Map()
  const queries = buildQueries(profile, near)

  for (const { query, includedType } of queries) {
    if (seen.size >= limit) break
    let pageToken
    let pages = 0

    do {
      const data = await searchText({ query, apiKey, includedType, pageToken, fetchImpl })
      const places = data.places || []
      places.forEach((place) => {
        if (place.id && !seen.has(place.id)) seen.set(place.id, place)
      })
      onProgress({ query, found: places.length, total: seen.size })
      pageToken = data.nextPageToken
      pages += 1
      // Three pages is 60 results for one phrasing, past which the sweep is
      // returning neighbouring towns rather than better matches.
    } while (pageToken && pages < 3 && seen.size < limit)
  }

  return [...seen.values()].slice(0, limit)
}

export function buildQueries(profile, near) {
  const keywords = profile.places?.keywords?.length
    ? profile.places.keywords
    : [profile.label.toLowerCase()]
  const types = profile.places?.includedTypes || []

  const queries = keywords.map((keyword) => ({
    query: `${keyword} in ${near}`,
    includedType: types[0] || undefined,
  }))

  // One untyped sweep catches businesses Google filed under an odd category.
  queries.push({ query: `${profile.label} in ${near}`, includedType: undefined })
  return queries
}

/** Normalizes a Places record into the fields the rest of the pipeline uses. */
export function normalizePlace(place) {
  const reviews = (place.reviews || [])
    .filter((review) => review.text?.text?.trim())
    .map((review) => ({
      text: review.text.text.trim(),
      author: review.authorAttribution?.displayName || null,
      rating: review.rating ?? null,
      publishedAt: review.publishTime || null,
      url: review.googleMapsUri || place.googleMapsUri || null,
    }))

  return {
    placeId: place.id,
    name: place.displayName?.text || null,
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    address: place.shortFormattedAddress || place.formattedAddress || null,
    websiteUri: place.websiteUri || null,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? 0,
    hours: place.regularOpeningHours?.weekdayDescriptions || null,
    primaryType: place.primaryType || null,
    types: place.types || [],
    location: place.location || null,
    mapsUri: place.googleMapsUri || null,
    businessStatus: place.businessStatus || null,
    reviews,
  }
}
