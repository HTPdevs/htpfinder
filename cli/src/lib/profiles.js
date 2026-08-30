import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { INDUSTRIES_ROOT } from './paths.js'
import { PALETTE_FAMILIES } from './palettes.js'

const REQUIRED_KEYS = ['id', 'label', 'places', 'qualify', 'directories', 'serviceTaxonomy', 'design']

export function listProfileIds() {
  if (!fs.existsSync(INDUSTRIES_ROOT)) return []
  return fs
    .readdirSync(INDUSTRIES_ROOT)
    .filter((file) => file.endsWith('.js') && !file.startsWith('_'))
    .map((file) => file.replace(/\.js$/, ''))
    .sort()
}

export async function loadProfile(id) {
  const file = path.join(INDUSTRIES_ROOT, `${id}.js`)
  if (!fs.existsSync(file)) {
    const available = listProfileIds()
    throw new Error(
      `Unknown industry "${id}". Available: ${available.join(', ') || 'none'}\n` +
        `Add one by copying industries/_template.js`
    )
  }

  const profile = (await import(pathToFileURL(file).href)).default
  const problems = validateProfile(profile, id)
  if (problems.length) {
    throw new Error(`Industry profile ${id}.js is invalid:\n  ${problems.join('\n  ')}`)
  }
  return profile
}

export async function loadAllProfiles() {
  const { profiles } = await loadProfiles()
  return profiles
}

/**
 * Loads every profile, separating the usable ones from the work in progress.
 *
 * A half written profile is a normal state: somebody copied the template and
 * has not finished the research yet. Letting one of those throw would break
 * `htpfinder industries` for every other trade, so incomplete profiles are
 * reported rather than fatal. Commands that actually need a specific profile
 * still fail hard, via `loadProfile`.
 */
export async function loadProfiles() {
  const profiles = []
  const incomplete = []

  for (const id of listProfileIds()) {
    const file = path.join(INDUSTRIES_ROOT, `${id}.js`)
    try {
      const profile = (await import(pathToFileURL(file).href)).default
      const problems = validateProfile(profile, id)
      if (problems.length) incomplete.push({ id, problems })
      else profiles.push(profile)
    } catch (err) {
      incomplete.push({ id, problems: [`could not be loaded: ${err.message}`] })
    }
  }

  return { profiles, incomplete }
}

export function validateProfile(profile, expectedId) {
  const problems = []
  if (!profile || typeof profile !== 'object') return ['default export is not an object']

  REQUIRED_KEYS.forEach((key) => {
    if (profile[key] === undefined) problems.push(`missing "${key}"`)
  })
  if (expectedId && profile.id !== expectedId) {
    problems.push(`id "${profile.id}" does not match filename "${expectedId}"`)
  }
  if (profile.places && !profile.places.includedTypes?.length && !profile.places.keywords?.length) {
    problems.push('places needs at least one includedType or keyword')
  }
  if (!profile.directories?.length) {
    problems.push('directories is empty, so enrichment has nowhere to look')
  }
  if (!profile.serviceTaxonomy?.length) {
    problems.push('serviceTaxonomy is empty')
  }
  profile.serviceTaxonomy?.forEach((entry) => {
    if (!entry.key || !entry.label || !entry.icon) {
      problems.push(`serviceTaxonomy entry is missing key, label or icon: ${JSON.stringify(entry)}`)
    }
  })
  profile.design?.paletteFamilies?.forEach((family) => {
    if (!PALETTE_FAMILIES.includes(family)) {
      problems.push(`unknown palette family "${family}"`)
    }
  })
  return problems
}

/**
 * Soft checks, reported rather than fatal.
 *
 * These are the mistakes a profile can make while still being structurally
 * valid: a directory list nobody verified, an icon the renderer will silently
 * swap for a leaf, thresholds that no observed business justifies. None of them
 * stop a run, and all of them make the tool quietly worse at a trade, which is
 * exactly the combination that earns a warning rather than an error.
 */
export async function auditProfile(profile) {
  const warnings = []
  const { listMotifs, listMarks, listIcons } = await import('./renderer-vocab.js')

  const researched = profile.research?.businesses?.filter((entry) => entry?.name) || []
  if (researched.length < 3) {
    warnings.push(
      `research.businesses lists ${researched.length}, the procedure asks for 3. ` +
        'Until it does, directories and qualify are unverified.'
    )
  }

  // A directory nothing was actually found on is the signature of a guessed list.
  const foundOn = new Set(researched.flatMap((entry) => entry.foundOn || []))
  if (researched.length) {
    ;(profile.directories || []).forEach((domain) => {
      if (!foundOn.has(domain)) {
        warnings.push(`directory "${domain}" answered nothing during the research pass`)
      }
    })
  }

  const observed = researched.map((entry) => entry.reviews).filter((n) => typeof n === 'number')
  if (observed.length && typeof profile.qualify?.minReviews === 'number') {
    const lowest = Math.min(...observed)
    if (profile.qualify.minReviews > lowest) {
      warnings.push(
        `qualify.minReviews is ${profile.qualify.minReviews}, above the lowest researched ` +
          `business at ${lowest} reviews, which this profile would filter out`
      )
    }
  }

  const icons = await listIcons()
  if (icons.length) {
    profile.serviceTaxonomy?.forEach((entry) => {
      if (entry.icon && !icons.includes(entry.icon)) {
        warnings.push(`icon "${entry.icon}" is not in the renderer, it will fall back to a leaf`)
      }
    })
  }

  const motifs = listMotifs()
  if (motifs.length && profile.design?.motif && !motifs.includes(profile.design.motif)) {
    warnings.push(`motif "${profile.design.motif}" is not implemented, the hero will render plain`)
  }

  const marks = listMarks()
  if (marks.length && profile.design?.mark && !marks.includes(profile.design.mark)) {
    warnings.push(`mark "${profile.design.mark}" is not implemented, the header will show a leaf`)
  }

  return warnings
}

/** Service keys a prospect in this industry is allowed to use. */
export function serviceKeys(profile) {
  return profile.serviceTaxonomy.map((entry) => entry.key)
}

export function serviceByKey(profile, key) {
  return profile.serviceTaxonomy.find((entry) => entry.key === key) || null
}
