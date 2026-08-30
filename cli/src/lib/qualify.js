/**
 * Deciding whether a business actually lacks a website.
 *
 * The naive check, "Places returned no websiteUri", misses most of the real
 * prospects. From the Portland pass by hand:
 *
 *   - Several businesses listed a directory mill domain that was not a site
 *     they controlled.
 *   - One listed a domain belonging to a same named company in another state.
 *   - Several pointed at a Facebook page, which is a presence but not a site
 *     and is exactly the gap worth pitching against.
 *   - Two pointed at domains that no longer resolved.
 *
 * So the qualifier has three tiers, and the reason is recorded so it can be
 * reviewed rather than trusted blindly.
 */

/** Domains that are a listing or a social page, not a website the owner owns. */
export const AGGREGATOR_DOMAINS = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'nextdoor.com',
  'yelp.com',
  'angi.com',
  'angieslist.com',
  'homeadvisor.com',
  'homeguide.com',
  'thumbtack.com',
  'porch.com',
  'houzz.com',
  'bbb.org',
  'yellowpages.com',
  'yourgreenpal.com',
  'networx.com',
  'manta.com',
  'mapquest.com',
  'birdeye.com',
  'chamberofcommerce.com',
  'linktr.ee',
  'business.site',
  'godaddysites.com',
  'wixsite.com',
  'repairpal.com',
  'mechanicadvisor.com',
  'carfax.com',
]

/** The site exists, it just refused an automated request. */
const BLOCKED_CODES = new Set([401, 403, 405, 429])
/** The site is genuinely not there. */
const GONE_CODES = new Set([404, 410])

export const WEBSITE_STATUS = {
  NONE: 'none',
  AGGREGATOR: 'aggregator',
  UNREACHABLE: 'unreachable',
  LIVE: 'live',
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

export function isAggregator(url, extraDomains = []) {
  const domain = domainOf(url)
  if (!domain) return false
  const list = [...AGGREGATOR_DOMAINS, ...extraDomains]
  return list.some((entry) => domain === entry || domain.endsWith(`.${entry}`))
}

/**
 * Classifies a website URL. The fetch is a cheap HEAD with a short timeout;
 * a network failure is reported as unknown rather than treated as proof the
 * site is dead, so a flaky connection cannot silently inflate the list.
 */
export async function classifyWebsite(url, { fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  if (!url) return { status: WEBSITE_STATUS.NONE, reason: 'no website listed' }

  if (isAggregator(url)) {
    return {
      status: WEBSITE_STATUS.AGGREGATOR,
      reason: `listed site is a directory or social page (${domainOf(url)})`,
      url,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'htpfinder/0.1 (prospect research)' },
    })
    // A block is not a dead site. Plenty of real small business sites sit
    // behind a WAF that refuses an unfamiliar user agent, and counting those
    // as "no website" would fill the prospect list with businesses that
    // already have one. Only a genuine absence disqualifies.
    if (BLOCKED_CODES.has(response.status)) {
      return {
        status: WEBSITE_STATUS.LIVE,
        reason: `listed site is up but blocked our check (${response.status})`,
        url,
        uncertain: true,
      }
    }
    if (GONE_CODES.has(response.status)) {
      return {
        status: WEBSITE_STATUS.UNREACHABLE,
        reason: `listed site returned ${response.status}`,
        url,
      }
    }
    if (!response.ok) {
      return {
        status: WEBSITE_STATUS.UNREACHABLE,
        reason: `listed site returned ${response.status}`,
        url,
        uncertain: true,
      }
    }
    // A redirect off the original domain usually means the domain was parked
    // or sold, which is the same practical situation as having no site.
    const landed = domainOf(response.url)
    if (landed && landed !== domainOf(url) && isAggregator(response.url)) {
      return {
        status: WEBSITE_STATUS.AGGREGATOR,
        reason: `listed site redirects to ${landed}`,
        url,
      }
    }
    return { status: WEBSITE_STATUS.LIVE, reason: 'listed site responded', url }
  } catch (err) {
    const aborted = err?.name === 'AbortError'
    return {
      status: WEBSITE_STATUS.UNREACHABLE,
      reason: aborted ? 'listed site timed out' : `listed site did not resolve (${err?.code || err?.message || 'error'})`,
      url,
      uncertain: true,
    }
  } finally {
    clearTimeout(timer)
  }
}

export function qualifies(websiteStatus) {
  return websiteStatus !== WEBSITE_STATUS.LIVE
}

/**
 * Scores a prospect so agent time goes to the best ones first.
 *
 * Deliberately simple and explainable. Every contribution is recorded, since
 * an unexplained number in a list is a number nobody trusts.
 */
export function scoreProspect({ rating, reviewCount, websiteStatus, hasPhone }, profile) {
  const { minRating = 0, minReviews = 0, idealReviews = 50 } = profile.qualify || {}
  const reasons = []
  let total = 0

  if (websiteStatus === WEBSITE_STATUS.NONE) {
    total += 40
    reasons.push('no website listed at all (+40)')
  } else if (websiteStatus === WEBSITE_STATUS.AGGREGATOR) {
    total += 34
    reasons.push('only a directory or social presence (+34)')
  } else if (websiteStatus === WEBSITE_STATUS.UNREACHABLE) {
    total += 30
    reasons.push('listed site is broken or parked (+30)')
  }

  const count = Number(reviewCount) || 0
  if (count >= minReviews) {
    const share = Math.min(1, count / Math.max(idealReviews, minReviews || 1))
    const points = Math.round(30 * share)
    total += points
    reasons.push(`${count} reviews, proof of real customers (+${points})`)
  } else {
    reasons.push(`only ${count} reviews, below the ${minReviews} bar for this trade (+0)`)
  }

  const score = Number(rating) || 0
  if (score >= minRating) {
    const points = Math.round(20 * Math.min(1, (score - minRating) / Math.max(5 - minRating, 0.1)))
    total += points
    reasons.push(`rated ${score} (+${points})`)
  } else if (score > 0) {
    reasons.push(`rated ${score}, below the ${minRating} bar (+0)`)
  }

  if (hasPhone) {
    total += 10
    reasons.push('phone number available, outreach can start immediately (+10)')
  } else {
    reasons.push('no phone found, needs a contact route before outreach (+0)')
  }

  return { total: Math.min(100, total), reasons }
}
