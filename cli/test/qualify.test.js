import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  classifyWebsite,
  isAggregator,
  qualifies,
  scoreProspect,
  WEBSITE_STATUS,
} from '../src/lib/qualify.js'

const profile = { qualify: { minRating: 3.5, minReviews: 5, idealReviews: 50 } }
const respond = (status, url) => async () => ({ ok: status >= 200 && status < 300, status, url })

test('a missing website qualifies', async () => {
  const result = await classifyWebsite(null)
  assert.equal(result.status, WEBSITE_STATUS.NONE)
  assert.ok(qualifies(result.status))
})

test('a directory listing is not a website', () => {
  assert.ok(isAggregator('https://www.yelp.com/biz/example'))
  assert.ok(isAggregator('https://facebook.com/example'))
  assert.ok(!isAggregator('https://example-landscaping.com'))
})

test('a blocked site counts as live, not dead', async () => {
  // Regression: small business sites often sit behind a WAF that rejects an
  // unfamiliar user agent. Treating 403 as "no website" filled the prospect
  // list with businesses that already had one.
  for (const status of [401, 403, 429]) {
    const result = await classifyWebsite('https://example.com', {
      fetchImpl: respond(status, 'https://example.com'),
    })
    assert.equal(result.status, WEBSITE_STATUS.LIVE, `${status} should read as live`)
    assert.ok(result.uncertain, `${status} should be flagged uncertain`)
    assert.ok(!qualifies(result.status))
  }
})

test('a 404 counts as no website', async () => {
  const result = await classifyWebsite('https://example.com', {
    fetchImpl: respond(404, 'https://example.com'),
  })
  assert.equal(result.status, WEBSITE_STATUS.UNREACHABLE)
  assert.ok(qualifies(result.status))
})

test('a network failure is uncertain rather than proof of absence', async () => {
  const result = await classifyWebsite('https://example.com', {
    fetchImpl: async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
    },
  })
  assert.equal(result.status, WEBSITE_STATUS.UNREACHABLE)
  assert.ok(result.uncertain)
})

test('a live site does not qualify', async () => {
  const result = await classifyWebsite('https://example.com', {
    fetchImpl: respond(200, 'https://example.com'),
  })
  assert.equal(result.status, WEBSITE_STATUS.LIVE)
  assert.ok(!qualifies(result.status))
})

test('scoring rewards no website, real customers and a reachable phone', () => {
  const strong = scoreProspect(
    { rating: 4.8, reviewCount: 60, websiteStatus: WEBSITE_STATUS.NONE, hasPhone: true },
    profile
  )
  const weak = scoreProspect(
    { rating: 3.0, reviewCount: 1, websiteStatus: WEBSITE_STATUS.NONE, hasPhone: false },
    profile
  )
  assert.ok(strong.total > weak.total)
  assert.ok(strong.total <= 100)
  assert.ok(strong.reasons.length >= 4, 'every contribution is explained')
})

test('review thresholds are per industry', () => {
  const lawn = { qualify: { minRating: 3.5, minReviews: 3, idealReviews: 20 } }
  const auto = { qualify: { minRating: 3.5, minReviews: 15, idealReviews: 100 } }
  const shop = { rating: 4.5, reviewCount: 12, websiteStatus: WEBSITE_STATUS.NONE, hasPhone: true }

  // Twelve reviews is a healthy lawn crew and a struggling auto shop.
  assert.ok(scoreProspect(shop, lawn).total > scoreProspect(shop, auto).total)
})
