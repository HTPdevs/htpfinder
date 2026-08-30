import assert from 'node:assert/strict'
import { test } from 'node:test'

import { listProfileIds, loadAllProfiles, loadProfiles, serviceKeys } from '../src/lib/profiles.js'
import { getPalette, palettesInFamilies, suggestPalette } from '../src/lib/palettes.js'
import { slugify, uniqueSlug } from '../src/lib/slug.js'
import { ICON_NAMES } from '../../demos/src/lib/icon-names.js'

test('every usable industry profile is valid', async () => {
  const profiles = await loadAllProfiles()
  assert.ok(profiles.length >= 2, 'at least two profiles keep the abstraction honest')
  profiles.forEach((profile) => {
    assert.ok(profile.directories.length, `${profile.id} has directories`)
    assert.ok(profile.serviceTaxonomy.length, `${profile.id} has services`)
  })
})

test('an unfinished profile is reported, not fatal', async () => {
  // Somebody copying the template and not finishing it is a normal state.
  // It must not break listing or using every other trade.
  const { profiles, incomplete } = await loadProfiles()
  assert.ok(profiles.length >= 2)
  incomplete.forEach((entry) => {
    assert.ok(entry.id, 'incomplete entries name the profile')
    assert.ok(entry.problems.length, `${entry.id} explains what is missing`)
  })
})

test('every service icon exists in the renderer registry', async () => {
  // Catches the failure where a profile references an icon the renderer
  // cannot draw, which would otherwise show up as a silent fallback.
  const profiles = await loadAllProfiles()
  profiles.forEach((profile) => {
    profile.serviceTaxonomy.forEach((entry) => {
      assert.ok(
        ICON_NAMES.includes(entry.icon),
        `${profile.id}: icon "${entry.icon}" for "${entry.key}" is not in the registry`
      )
    })
  })
})

test('profiles do not accidentally share a configuration', async () => {
  const profiles = await loadAllProfiles()
  const a = profiles.find((p) => p.id === 'lawn-care')
  const b = profiles.find((p) => p.id === 'auto-repair')
  assert.notDeepEqual(serviceKeys(a), serviceKeys(b))
  assert.notDeepEqual(a.directories, b.directories)
  assert.notDeepEqual(a.qualify, b.qualify)
})

test('the template is not loaded as a real industry', () => {
  assert.ok(!listProfileIds().includes('_template'))
})

test('palettes spread across families before repeating one', () => {
  const families = ['autumn-leaves', 'spring-flowers', 'summer', 'icy-blue']
  const taken = []
  for (let i = 0; i < 4; i += 1) {
    taken.push(suggestPalette(families, taken).id)
  }
  const chosenFamilies = taken.map((id) => getPalette(id).family)
  assert.equal(new Set(chosenFamilies).size, 4, 'first four prospects get four seasons')
})

test('palette suggestions respect the allowed families', () => {
  const palette = suggestPalette(['icy-blue'], [])
  assert.equal(palette.family, 'icy-blue')
  assert.equal(palettesInFamilies(['icy-blue']).length, 3)
})

test('every palette defines the full token set', () => {
  const required = ['background', 'foreground', 'brand', 'brand-soft', 'brand-ink', 'highlight']
  palettesInFamilies().forEach((palette) => {
    required.forEach((token) => {
      assert.ok(palette.tokens[token], `${palette.id} is missing --${token}`)
    })
  })
})

test('slugs stay readable', () => {
  assert.equal(slugify("Kevin's Landscaping"), 'kevins-landscaping')
  assert.equal(slugify('Nice Yard Inc'), 'nice-yard')
  assert.equal(slugify('A-1 Automotive & Fleet'), 'a-1-automotive-and-fleet')
  assert.equal(uniqueSlug('Example', ['example']), 'example-2')
})
