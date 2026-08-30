import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildBrief } from '../src/commands/profile.js'
import { auditProfile, loadAllProfiles } from '../src/lib/profiles.js'
import { listMarks, listMotifs, listIcons } from '../src/lib/renderer-vocab.js'

test('the renderer vocabulary is read from the renderer, not restated', async () => {
  // If these parsers ever return nothing, the brief silently stops constraining
  // the profile it asks for, which is worse than failing.
  assert.ok((await listIcons()).length >= 10, 'icons come back')
  assert.ok(listMotifs().includes('plain'), 'motifs come back')
  assert.ok(listMarks().includes('leaf'), 'marks come back')
})

test('a brief for an unknown trade carries the real vocabularies', async () => {
  const shipped = await loadAllProfiles()
  const brief = await buildBrief({ id: 'roofing', label: 'Roofing', shipped })

  assert.equal(brief.industry, 'roofing')
  assert.ok(brief.vocabulary.icons.length, 'icons are listed for the taxonomy')
  assert.ok(brief.vocabulary.motifs.length, 'motifs are listed')
  assert.ok(brief.vocabulary.marks.length, 'marks are listed')
  assert.ok(brief.vocabulary.paletteFamilies.length, 'palette families are listed')
  assert.match(brief.outputPath, /industries\/roofing\.js$/)
})

test('the brief shows prior art without inviting a copy', async () => {
  const shipped = await loadAllProfiles()
  const brief = await buildBrief({ id: 'roofing', label: 'Roofing', shipped })

  const lawn = brief.priorArt.find((entry) => entry.id === 'lawn-care')
  const auto = brief.priorArt.find((entry) => entry.id === 'auto-repair')
  assert.ok(lawn && auto, 'both shipped trades are shown')
  assert.notDeepEqual(lawn.directories, auto.directories)
  assert.notEqual(lawn.minReviews, auto.minReviews)
})

test('an unresearched directory list is reported', async () => {
  const warnings = await auditProfile({
    id: 'test',
    directories: ['verified.com', 'guessed.com'],
    serviceTaxonomy: [],
    qualify: { minReviews: 5 },
    research: {
      businesses: [
        { name: 'A', url: 'https://a.example', reviews: 20, foundOn: ['verified.com'] },
        { name: 'B', url: 'https://b.example', reviews: 30, foundOn: ['verified.com'] },
        { name: 'C', url: 'https://c.example', reviews: 40, foundOn: ['verified.com'] },
      ],
    },
  })

  assert.ok(
    warnings.some((warning) => warning.includes('guessed.com')),
    'a directory nothing was found on is called out'
  )
  assert.ok(
    !warnings.some((warning) => warning.includes('verified.com')),
    'a directory that answered something is left alone'
  )
})

test('thresholds that would filter out the researched businesses are reported', async () => {
  const warnings = await auditProfile({
    id: 'test',
    directories: [],
    serviceTaxonomy: [],
    qualify: { minReviews: 25 },
    research: {
      businesses: [
        { name: 'A', url: 'https://a.example', reviews: 8, foundOn: [] },
        { name: 'B', url: 'https://b.example', reviews: 30, foundOn: [] },
        { name: 'C', url: 'https://c.example', reviews: 40, foundOn: [] },
      ],
    },
  })

  assert.ok(warnings.some((warning) => warning.includes('minReviews')))
})

test('an icon the renderer cannot draw is reported rather than rendered', async () => {
  const warnings = await auditProfile({
    id: 'test',
    directories: [],
    qualify: {},
    serviceTaxonomy: [{ key: 'x', label: 'X', icon: 'NotARealIcon' }],
    design: { motif: 'nope', mark: 'nope' },
  })

  assert.ok(warnings.some((warning) => warning.includes('NotARealIcon')))
  assert.ok(warnings.some((warning) => warning.includes('motif')))
  assert.ok(warnings.some((warning) => warning.includes('mark')))
})
