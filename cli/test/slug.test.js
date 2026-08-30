import assert from 'node:assert/strict'
import { test } from 'node:test'

import { labelFromSlug, slugify, uniqueSlug } from '../src/lib/slug.js'

test('a business name becomes a stable slug', () => {
  assert.equal(slugify("Kevin's Landscaping"), 'kevins-landscaping')
  assert.equal(slugify('Key Concepts Landscape LLC'), 'key-concepts-landscape')
  assert.equal(slugify('Mow & Go'), 'mow-and-go')
})

test('a taken slug gets a numeric suffix', () => {
  assert.equal(uniqueSlug('Green Yard', ['green-yard']), 'green-yard-2')
  assert.equal(uniqueSlug('Green Yard', ['green-yard', 'green-yard-2']), 'green-yard-3')
})

test('an industry id reads as a trade name', () => {
  assert.equal(labelFromSlug('lawn-care'), 'Lawn Care')
  assert.equal(labelFromSlug('house-cleaning'), 'House Cleaning')
})

test('small words inside a trade name stay lowercase', () => {
  assert.equal(labelFromSlug('lawn-and-yard-maintenance'), 'Lawn and Yard Maintenance')
  // Unless it opens the name, where lowercase would read as a mistake.
  assert.equal(labelFromSlug('the-trades'), 'The Trades')
})

test('every shipped profile carries a title case label', async () => {
  const { loadAllProfiles } = await import('../src/lib/profiles.js')
  for (const profile of await loadAllProfiles()) {
    assert.equal(
      profile.label,
      labelFromSlug(profile.label),
      `${profile.id} label "${profile.label}" is not title case`
    )
  }
})
