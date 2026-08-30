import path from 'node:path'

import * as log from '../lib/log.js'
import { loadProfile } from '../lib/profiles.js'
import { prospectFile, readJson } from '../lib/paths.js'
import { BANNED_WORDS } from '../lib/copy-rules.js'
import { palettesInFamilies } from '../lib/palettes.js'
import { listProspectSlugs } from '../lib/paths.js'

export const help = `
htpfinder packet <slug>

  Prints the enrichment brief for one prospect: what Places already gave us,
  what is still missing, where to look for it, and the rules the result has to
  satisfy. Hand this to the agent doing the research step.

Options
  --json    Emit the brief as JSON instead of prose.
`

export async function run(args) {
  const slug = args._[0]
  if (!slug) {
    log.fail('A slug is required. Try: htpfinder list')
    return 1
  }

  const file = prospectFile(slug, 'prospect.json')
  let prospect
  try {
    prospect = readJson(file)
  } catch {
    log.fail(`No prospect found for "${slug}". Try: htpfinder list`)
    return 1
  }

  const profile = await loadProfile(prospect.industry)
  const taken = usedPalettes()
  const brief = buildBrief(prospect, profile, taken)

  if (args.json) {
    console.log(JSON.stringify(brief, null, 2))
    return 0
  }

  console.log(renderBrief(brief))
  return 0
}

function usedPalettes() {
  return listProspectSlugs()
    .map((slug) => {
      try {
        return readJson(prospectFile(slug, 'prospect.json'))?.design?.paletteId || null
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export function buildBrief(prospect, profile, takenPalettes = []) {
  const facts = prospect.facts || {}
  const have = []
  const missing = []

  const record = (label, value, formatted) => {
    if (value) have.push({ label, value: formatted ?? value.value ?? value })
    else missing.push(label)
  }

  record('Business name', facts.name)
  record('Phone', facts.phone)
  record('Address', facts.address)
  record('Hours', facts.hours)
  record('Years in business', facts.yearsInBusiness)
  record('Crew or team size', facts.crewSize)
  record('Owner name', facts.ownerName)
  record('Payment methods', facts.paymentMethods)
  record('Free estimates', facts.freeEstimates)
  record('Languages', facts.languages)
  record('Certifications', facts.certifications)
  record('Service area', facts.serviceArea)

  if (facts.ratings?.length) {
    have.push({
      label: 'Ratings',
      value: facts.ratings.map((r) => `${r.score} from ${r.count} on ${r.source}`).join(', '),
    })
  } else {
    missing.push('Ratings')
  }

  if (facts.reviewQuotes?.length) {
    have.push({ label: 'Review quotes', value: `${facts.reviewQuotes.length} verbatim` })
  } else {
    missing.push('Review quotes')
  }

  if (facts.services?.length) {
    have.push({ label: 'Services', value: facts.services.map((s) => s.key).join(', ') })
  } else {
    missing.push('Services')
  }

  const available = palettesInFamilies(profile.design?.paletteFamilies)
  const free = available.filter((p) => !takenPalettes.includes(p.id))

  return {
    slug: prospect.slug,
    industry: profile.id,
    industryLabel: profile.label,
    website: prospect.website || null,
    score: prospect.score || null,
    have,
    missing,
    directories: profile.directories,
    serviceTaxonomy: profile.serviceTaxonomy,
    guidance: profile.guidance || {},
    palettes: {
      allowedFamilies: profile.design?.paletteFamilies || [],
      available: (free.length ? free : available).map((p) => ({
        id: p.id,
        family: p.family,
        label: p.label,
      })),
      alreadyUsed: takenPalettes,
    },
    outputPath: path.join('data/prospects', prospect.slug, 'prospect.json'),
  }
}

function renderBrief(brief) {
  const lines = []
  const rule = '-'.repeat(0) // no dashes in output text

  lines.push(`ENRICHMENT BRIEF: ${brief.slug}`)
  lines.push(`Industry: ${brief.industryLabel} (${brief.industry})`)
  if (brief.website) {
    lines.push(`Website status: ${brief.website.status}, ${brief.website.reason}`)
  }
  if (brief.score) lines.push(`Score: ${brief.score.total}`)
  lines.push('')

  lines.push('ALREADY KNOWN (from Google Places, do not re research these)')
  brief.have.forEach((item) => lines.push(`  ${item.label}: ${item.value}`))
  if (!brief.have.length) lines.push('  nothing yet')
  lines.push('')

  lines.push('STILL MISSING (this is the job)')
  brief.missing.forEach((label) => lines.push(`  ${label}`))
  if (!brief.missing.length) lines.push('  nothing, ready to build')
  lines.push('')

  lines.push('WHERE TO LOOK, in order of how often they pay off for this trade')
  brief.directories.forEach((domain) => lines.push(`  ${domain}`))
  lines.push('')

  lines.push('SERVICE VOCABULARY (use these keys, do not invent new ones)')
  brief.serviceTaxonomy.forEach((entry) => lines.push(`  ${entry.key}: ${entry.label}`))
  lines.push('')

  if (brief.guidance.audience) {
    lines.push('WHO THE PAGE IS TALKING TO')
    lines.push(`  ${brief.guidance.audience}`)
    lines.push('')
  }
  if (brief.guidance.proofPoints?.length) {
    lines.push('WHAT SELLS IN THIS TRADE')
    brief.guidance.proofPoints.forEach((point) => lines.push(`  ${point}`))
    lines.push('')
  }
  if (brief.guidance.anglesToAvoid?.length) {
    lines.push('DO NOT CLAIM')
    brief.guidance.anglesToAvoid.forEach((point) => lines.push(`  ${point}`))
    lines.push('')
  }

  lines.push('PALETTE (pick one id, prefer an unused one)')
  brief.palettes.available.forEach((p) => lines.push(`  ${p.id}: ${p.label} (${p.family})`))
  lines.push('')

  lines.push('RULES')
  lines.push('  Every fact carries a source URL. A fact you cannot source is null, never a guess.')
  lines.push('  Review quotes are verbatim with an author and a URL, or the array stays empty.')
  lines.push('  Conflicts go in `unresolved`, they do not get silently picked.')
  lines.push('  No dashes of any kind in copy. Phone numbers are the only exemption.')
  lines.push(`  Banned words: ${BANNED_WORDS.join(', ')}`)
  lines.push('')
  lines.push('FULL PROCEDURE: docs/ENRICHMENT.md')
  lines.push('FIELD REFERENCE: docs/PROSPECT-SCHEMA.md')
  lines.push('')
  lines.push(`WRITE TO: ${brief.outputPath}`)
  lines.push('THEN RUN: htpfinder validate ' + brief.slug)

  return lines.join('\n') + rule
}
