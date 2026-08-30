import fs from 'node:fs'
import path from 'node:path'

import * as log from '../lib/log.js'
import { loadProfiles } from '../lib/profiles.js'
import { INDUSTRIES_ROOT } from '../lib/paths.js'
import { PALETTES, PALETTE_FAMILIES } from '../lib/palettes.js'
import { rendererVocabulary } from '../lib/renderer-vocab.js'
import { BANNED_WORDS } from '../lib/copy-rules.js'
import { slugify } from '../lib/slug.js'

export const help = `
htpfinder profile <industry>

  Prints the industry research brief: what a profile has to answer, which of
  those answers cannot be guessed from a desk, the vocabularies the renderer
  actually implements, and where to write the result. Hand this to the agent
  adding a trade.

  This is the industry level twin of \`packet\`. Same shape, one level up: a
  brief goes out, research comes back as a file, the file gets validated.

Options
  --id <id>     Profile id and filename. Defaults to a slug of the name.
  --scaffold    Also write industries/<id>.js from the template.
  --json        Emit the brief as JSON instead of prose.
`

export async function run(args) {
  const name = args._.join(' ').trim()
  if (!name) {
    log.fail('An industry is required. Try: htpfinder profile "roofing"')
    return 1
  }

  const id = typeof args.id === 'string' ? slugify(args.id) : slugify(name)
  if (!id) {
    log.fail(`Could not derive a profile id from "${name}". Pass one with --id.`)
    return 1
  }

  const file = path.join(INDUSTRIES_ROOT, `${id}.js`)
  if (fs.existsSync(file) && !args.json) {
    log.warn(`industries/${id}.js already exists. This brief describes what it should contain.`)
  }

  const { profiles } = await loadProfiles()
  const brief = await buildBrief({ id, label: titleCase(name), shipped: profiles })

  if (args.json) {
    console.log(JSON.stringify(brief, null, 2))
    return 0
  }

  console.log(renderBrief(brief))

  if (args.scaffold) {
    const written = scaffold(id, brief.industryLabel)
    console.log('')
    if (written) log.ok(`scaffolded industries/${id}.js`)
    else log.warn(`industries/${id}.js already exists, left alone`)
  }
  return 0
}

export async function buildBrief({ id, label, shipped = [] }) {
  const vocabulary = await rendererVocabulary()

  return {
    industry: id,
    industryLabel: label,
    outputPath: path.join('cli/industries', `${id}.js`),
    /**
     * The shipped profiles are the argument against copying one. Printing their
     * directory lists and thresholds side by side shows how little two trades
     * share, which reads as evidence rather than as a warning to skim past.
     */
    priorArt: shipped.map((profile) => ({
      id: profile.id,
      label: profile.label,
      minReviews: profile.qualify?.minReviews ?? null,
      idealReviews: profile.qualify?.idealReviews ?? null,
      directories: profile.directories || [],
      services: profile.serviceTaxonomy?.length ?? 0,
    })),
    vocabulary: {
      ...vocabulary,
      paletteFamilies: PALETTE_FAMILIES.map((family) => ({
        family,
        palettes: PALETTES.filter((p) => p.family === family).map((p) => p.id),
      })),
    },
  }
}

export function renderBrief(brief) {
  const lines = []

  lines.push(`INDUSTRY BRIEF: ${brief.industryLabel} (${brief.industry})`)
  lines.push('')

  lines.push('WHAT THIS FILE DRIVES')
  lines.push('  The Places sweep, the enrichment brief every prospect in this trade gets,')
  lines.push('  the validator, and the renderer. One file, no component edits.')
  lines.push('')

  lines.push('DO THE RESEARCH FIRST (this is the whole job)')
  lines.push('  Find three real businesses in this trade, on Google, in a real city.')
  lines.push('  Then go looking for years in business, owner name and service list.')
  lines.push('  Two things fall out of that pass and cannot be derived any other way:')
  lines.push('')
  lines.push('    directories   which sites actually had the answer, in that order')
  lines.push('    qualify       how many reviews a normal business in this trade has')
  lines.push('')
  lines.push('  Guessing either produces a profile that looks right and quietly returns')
  lines.push('  nothing useful, because the enrichment step then has nowhere to look.')
  lines.push('')

  if (brief.priorArt.length) {
    lines.push('HOW LITTLE TWO TRADES SHARE (do not copy one of these)')
    brief.priorArt.forEach((profile) => {
      lines.push(`  ${profile.label} (${profile.id})`)
      lines.push(
        `    reviews      min ${profile.minReviews}, ideal ${profile.idealReviews}, ${profile.services} services`
      )
      lines.push(`    directories  ${profile.directories.join(', ') || 'none'}`)
    })
    lines.push('')
  }

  lines.push('FIELDS TO FILL')
  lines.push('  id             must match the filename')
  lines.push('  label          human readable trade name')
  lines.push('  places         includedTypes plus keywords. Categories are coarse, so the')
  lines.push('                 keyword sweep is what finds small operators. Use the phrasing')
  lines.push('                 a customer would use, not the industry term.')
  lines.push('  qualify        minRating, minReviews, idealReviews, from the research pass')
  lines.push('  directories    ordered by how often each paid off, from the research pass')
  lines.push('  serviceTaxonomy  key, label and icon per service the trade actually sells')
  lines.push('  design         motif, mark, paletteFamilies')
  lines.push('  guidance       audience, proofPoints, anglesToAvoid, seasonalNote')
  lines.push('  research       the three businesses, so the two fields above are checkable')
  lines.push('')

  lines.push('ICONS (serviceTaxonomy.icon must be one of these)')
  lines.push(wrap(brief.vocabulary.icons))
  lines.push('  If this trade genuinely needs an icon that is not here, add the name to')
  lines.push('  demos/src/lib/icon-names.js and the component to demos/src/lib/icons.js.')
  lines.push('  Both, or the cross check test fails. Never point at a near miss instead.')
  lines.push('')

  lines.push('MOTIF (design.motif, hero texture)')
  lines.push(wrap(brief.vocabulary.motifs))
  lines.push('  Add a new one as a .motif-* rule in demos/src/styles/index.css.')
  lines.push('')

  lines.push('MARK (design.mark, header icon)')
  lines.push(wrap(brief.vocabulary.marks))
  lines.push('  Add a new one to the MARKS map in demos/src/components/BrandMark.jsx.')
  lines.push('')

  lines.push('PALETTE FAMILIES (design.paletteFamilies)')
  brief.vocabulary.paletteFamilies.forEach((entry) => {
    lines.push(`  ${entry.family}: ${entry.palettes.join(', ')}`)
  })
  lines.push('  Narrowing to one or two families is usually right. A trade rendered in a')
  lines.push('  family that does not suit it is a worse demo than a plain one.')
  lines.push('')

  lines.push('RULES')
  lines.push('  Every directory earns its place by having answered a question during the')
  lines.push('  research pass. Record which business it answered for, in `research`.')
  lines.push('  Thresholds come from observed review counts, never from another profile.')
  lines.push('  anglesToAvoid names the claims this trade makes that are tempting and')
  lines.push('  unsafe: licensing, insurance, certifications, outcome claims.')
  lines.push('  No dashes of any kind in copy. Phone numbers are the only exemption.')
  lines.push(`  Banned words: ${BANNED_WORDS.join(', ')}`)
  lines.push('')
  lines.push('FULL PROCEDURE: docs/ADDING-AN-INDUSTRY.md')
  lines.push('')
  lines.push(`WRITE TO: ${brief.outputPath}`)
  lines.push(`THEN RUN: htpfinder industries`)
  lines.push(`          htpfinder collect ${brief.industry} --near "<a real city>" --dry-run`)

  return lines.join('\n')
}

/** Writes the template with the id and label already filled in. */
export function scaffold(id, label) {
  const target = path.join(INDUSTRIES_ROOT, `${id}.js`)
  if (fs.existsSync(target)) return null

  const template = fs.readFileSync(path.join(INDUSTRIES_ROOT, '_template.js'), 'utf8')
  const header = `/**
 * ${label} industry profile.
 *
 * Scaffolded by \`htpfinder profile ${id}\`, and not researched yet. Every
 * value below is a placeholder, so this shows up under \`htpfinder industries\`
 * as started rather than usable. Run that same command again for the brief
 * that says what each field needs and where the answers come from.
 */`

  const filled = template
    // The template's own header explains how to copy the template, which stops
    // being true the moment it has been copied.
    .replace(/^\/\*\*[\s\S]*?\*\//, header)
    .replace("id: 'your-industry'", `id: '${id}'`)
    .replace("label: 'Human readable name'", `label: '${label}'`)
  fs.writeFileSync(target, filled)
  return target
}

function wrap(values, indent = '  ', width = 76) {
  const lines = []
  let current = indent
  values.forEach((value) => {
    const next = current === indent ? `${current}${value}` : `${current}, ${value}`
    if (next.length > width) {
      lines.push(current)
      current = `${indent}${value}`
    } else {
      current = next
    }
  })
  if (current.trim()) lines.push(current)
  return lines.join('\n')
}

function titleCase(value) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}
