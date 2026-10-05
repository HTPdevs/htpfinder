/**
 * The inbox pipeline: find businesses whose messages are spread across more
 * channels than they can answer from one place.
 *
 * Three stages, in order, because each one is more expensive than the last and
 * should only ever run on what survived the one before:
 *
 *   1. source   one paid search per keyword, returns firmographics and socials
 *   2. inspect  one free homepage fetch per prospect, returns the vendor
 *   3. score    free, local, and explainable line by line
 *
 * Enrichment is deliberately not stage four. `treg.companies.enrich` is worth
 * running on a shortlist a human has already looked at, not on a sweep, and
 * the command prints the call to make rather than making it.
 */

import { loadVertical } from './verticals.js'
import { inspectSite, TIERS } from './widgets.js'
import { slugify } from './slug.js'
import { tregCall } from './treg.js'

/** Business search, the one provider treg routes this capability to. */
export const SEARCH_ENDPOINT = 'openmart.businesses.search'

/**
 * What a search of `rows` rows actually costs.
 *
 * Openmart bills 3 credits per 10 returned records at about $0.0298 a credit,
 * rounded up per operation. The rounding is the part that matters: a four row
 * call reserves two whole credits, so three keywords asking for four rows each
 * costs half again what one keyword asking for twelve does. Splitting a sweep
 * across keywords is therefore not free, and the projection has to model the
 * rounding or it under quotes every small run.
 */
export const CREDIT_USD = 0.0298

export function estimateSearchCost(rows) {
  if (rows <= 0) return 0
  return Math.ceil((rows * 3) / 10) * CREDIT_USD
}

export class InboxError extends Error {
  constructor(message, { code } = {}) {
    super(message)
    this.name = 'InboxError'
    this.code = code
  }
}

const SOCIAL_KEYS = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'TWITTER', 'X']

/**
 * Normalizes one provider row.
 *
 * `staffs` deserves a warning. It is a list of named people scraped off the
 * business's own website, so it is a floor on headcount and not a headcount.
 * A practice that lists four dentists and no hygienists reads as four here
 * while employing thirty. It is recorded as `staffNamed` for that reason and
 * the band filter treats it as evidence rather than as truth.
 */
export function normalizeBusiness(row) {
  const content = row?.content || row || {}
  const social = content.social_media_links || {}
  const socials = {}
  SOCIAL_KEYS.forEach((key) => {
    const value = social[key]
    if (Array.isArray(value) && value.length) socials[key.toLowerCase()] = value[0]
  })

  const phones = content.business_phones || content.store_phones || []
  const emails = content.business_emails || content.store_emails || []

  return {
    sourceId: row?.id || content.store_id || content.brand_id || null,
    name: content.business_name || content.store_name || null,
    website: content.website_url || null,
    domain: content.root_domain || null,
    phone: phones[0] || null,
    email: emails[0] || null,
    city: content.city || null,
    state: content.state || null,
    country: content.country || null,
    rating: content.google_rating ?? null,
    reviewCount: content.google_reviews_count ?? 0,
    businessType: content.business_type || null,
    staffNamed: Array.isArray(content.staffs) ? content.staffs.length : null,
    staffRoles: Array.isArray(content.staffs)
      ? content.staffs.map((entry) => entry?.role).filter(Boolean)
      : [],
    socials,
    matchScore: row?.match_score ?? null,
  }
}

/**
 * Counts the places a customer could start a conversation.
 *
 * This is the number the whole offer rests on. One inbox is only worth two
 * hundred a month to somebody currently checking four.
 */
export function countChannels(business, site) {
  const channels = []
  if (business.phone) channels.push('phone')
  if (business.email) channels.push('email')
  if (business.socials.facebook) channels.push('facebook')
  if (business.socials.instagram) channels.push('instagram')
  if (business.socials.tiktok) channels.push('tiktok')

  const vendorTiers = new Set((site?.vendors || []).map((vendor) => vendor.tier))
  if (vendorTiers.has(TIERS.INBOX_PLATFORM) || vendorTiers.has(TIERS.CHAT_WIDGET)) {
    channels.push('web chat')
  }
  if ((site?.vendors || []).some((vendor) => vendor.id === 'whatsapp-link')) channels.push('whatsapp')
  if ((site?.vendors || []).some((vendor) => vendor.id === 'sms-link')) channels.push('sms')

  return channels
}

/**
 * Scores a prospect for the one inbox offer.
 *
 * Every contribution is recorded. An unexplained number in a lead list is a
 * number the person making the call will not trust, and rightly.
 */
export function scoreLead({ business, site, vertical }) {
  const reasons = []
  let total = 0

  const channels = countChannels(business, site)
  const [minStaff, maxStaff] = vertical.staffBand

  if (site.tier === TIERS.INBOX_PLATFORM) {
    const names = site.vendors.filter((v) => v.tier === TIERS.INBOX_PLATFORM).map((v) => v.label)
    total += 35
    reasons.push(`already pays for ${names.join(' and ')}, so budget and procurement are settled (+35)`)
  } else if (site.tier === TIERS.SOCIAL_CLICK) {
    total += 28
    reasons.push('messaging is a link out to a personal phone, which is the exact problem (+28)')
  } else if (site.tier === TIERS.CHAT_WIDGET) {
    const names = site.vendors.filter((v) => v.tier === TIERS.CHAT_WIDGET).map((v) => v.label)
    total += 20
    reasons.push(`runs ${names.join(' and ')}, a single channel widget with no shared inbox (+20)`)
  } else if (site.blocked) {
    // The site refused the check, so nothing is known about its vendor. Paying
    // out the greenfield points here would rank an unexamined business
    // alongside one that was actually looked at.
    reasons.push('homepage refused the check, so the vendor is unknown (+0)')
  } else {
    total += 8
    reasons.push('no messaging vendor found, which may mean no budget rather than an opening (+8)')
  }

  // Fragmentation. Two channels is a business. Five is a problem worth paying
  // to solve, and the count is what the opening line of the pitch quotes.
  const spread = Math.max(0, channels.length - 2)
  const spreadPoints = Math.min(25, spread * 7)
  total += spreadPoints
  reasons.push(
    channels.length
      ? `${channels.length} ways in (${channels.join(', ')}) (+${spreadPoints})`
      : 'no contact channel found at all (+0)'
  )

  const reviews = Number(business.reviewCount) || 0
  const reviewPoints = Math.round(20 * Math.min(1, reviews / 200))
  total += reviewPoints
  reasons.push(`${reviews} Google reviews, proof of inbound volume (+${reviewPoints})`)

  const named = business.staffNamed
  if (named === null) {
    reasons.push('no staff list found, headcount unverified (+0)')
  } else if (named >= minStaff) {
    total += 15
    reasons.push(`${named} staff named on the site, inside the ${minStaff} to ${maxStaff} band (+15)`)
  } else {
    total += 5
    reasons.push(
      `only ${named} staff named on the site, which is a floor and not a headcount, ` +
        `so the ${minStaff} to ${maxStaff} band is unconfirmed (+5)`
    )
  }

  if (business.phone || business.email) {
    total += 5
    reasons.push('reachable without more research (+5)')
  } else {
    reasons.push('no direct contact found, needs a route before outreach (+0)')
  }

  return { total: Math.min(100, total), reasons, channels }
}

/** The pitch angle a tier implies, printed next to the score. */
export function pitchFor(site) {
  if (site.blocked) return 'unknown'
  switch (site.tier) {
    case TIERS.INBOX_PLATFORM:
      return 'switch'
    case TIERS.CHAT_WIDGET:
      return 'upgrade'
    case TIERS.SOCIAL_CLICK:
      return 'consolidate'
    case TIERS.CHATWOOT:
      return 'already chatwoot'
    default:
      return 'cold'
  }
}

/** Loose location match, since the provider does not filter on one reliably. */
export function matchesLocation(business, near) {
  if (!near) return true
  const haystack = `${business.city || ''} ${business.state || ''}`.toLowerCase()
  return near
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((token) => token.length > 1)
    .some((token) => haystack.includes(token))
}

async function searchBusinesses({ vertical, near, limit, call }) {
  const queries = vertical.search.map((keyword) => (near ? `${keyword} in ${near}` : keyword))
  const perQuery = Math.max(1, Math.ceil(limit / queries.length))
  const seen = new Map()
  let cost = 0

  // The ceiling is per call and the provider reserves against it before it
  // returns anything, so it has to cover one query rather than the whole
  // sweep. A little headroom absorbs a provider price change without turning
  // it into an unexplained refusal mid run.
  const maxCost = Number((estimateSearchCost(perQuery) * 1.5).toFixed(4))

  for (const query of queries) {
    if (seen.size >= limit) break
    const result = await call(SEARCH_ENDPOINT, { query, limit: perQuery }, { maxCost })
    cost += result.cost

    // The provider returns an object keyed by index rather than an array.
    const rows = Array.isArray(result.output) ? result.output : Object.values(result.output || {})
    rows.forEach((row) => {
      const business = normalizeBusiness(row)
      const key = business.domain || business.sourceId || business.name
      if (key && !seen.has(key)) seen.set(key, { ...business, query })
    })
  }

  return { businesses: [...seen.values()], cost }
}

/**
 * Runs the whole sweep.
 *
 * `onProgress` is called with a message per stage so the command can narrate a
 * run that spends money as it goes.
 */
export async function findLeads({
  vertical: verticalId,
  near,
  limit = 30,
  minScore = 0,
  inspect = true,
  call = tregCall,
  inspectImpl = inspectSite,
  onProgress = () => {},
} = {}) {
  if (!verticalId) throw new InboxError('Pick a vertical.', { code: 'no_vertical' })
  const vertical = loadVertical(verticalId)

  onProgress({ message: `searching ${vertical.search.length} keyword(s) for ${vertical.label}` })
  const { businesses, cost } = await searchBusinesses({ vertical, near, limit, call })
  onProgress({ message: `${businesses.length} businesses returned, spent $${cost.toFixed(4)}` })

  const located = businesses.filter((business) => matchesLocation(business, near))
  const offLocation = businesses.length - located.length
  if (offLocation) {
    onProgress({
      message: `${offLocation} dropped for sitting outside "${near}", which the provider ignored`,
    })
  }

  const leads = []
  const skipped = []

  for (const business of located) {
    const site = inspect
      ? await inspectImpl(business.website)
      : { url: business.website, reachable: false, vendors: [], tier: TIERS.NONE, uncertain: true, reason: 'site check skipped' }

    if (site.tier === TIERS.CHATWOOT) {
      skipped.push({ business, site, why: 'already runs Chatwoot' })
      continue
    }

    const score = scoreLead({ business, site, vertical })
    if (score.total < minScore) {
      skipped.push({ business, site, why: `scored ${score.total}, below the ${minScore} floor` })
      continue
    }

    leads.push({
      slug: slugify(business.name || business.domain || 'unknown'),
      business,
      site,
      score,
      pitch: pitchFor(site),
    })
    onProgress({ message: `checked ${business.name || business.domain}` })
  }

  leads.sort((a, b) => b.score.total - a.score.total)
  return { vertical, near: near || null, leads, skipped, cost, offLocation }
}
