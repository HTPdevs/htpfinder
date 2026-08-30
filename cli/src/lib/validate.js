import { findBannedWords, findDashes, walkStrings } from './copy-rules.js'
import { getPalette, palettesInFamilies } from './palettes.js'
import { COPY_SECTIONS, SCHEMA_VERSION, STATUSES } from './schema.js'
import { serviceKeys } from './profiles.js'

const URL_PATTERN = /^https?:\/\/\S+$/i

const problem = (severity, path, message) => ({ severity, path, message })
const error = (path, message) => problem('error', path, message)
const warning = (path, message) => problem('warning', path, message)

/**
 * Validates one prospect against its industry profile.
 *
 * Returns every problem rather than throwing on the first, because the usual
 * fix loop is "show me everything wrong, I will do one pass".
 *
 * `stage` controls how strict to be. A freshly collected prospect legitimately
 * has no copy yet; one about to be built must have all of it.
 */
export function validateProspect(prospect, profile, { stage = 'build' } = {}) {
  const problems = []
  const requireCopy = stage === 'build'

  if (prospect?.schemaVersion !== SCHEMA_VERSION) {
    problems.push(
      error('schemaVersion', `expected ${SCHEMA_VERSION}, found ${prospect?.schemaVersion}`)
    )
  }
  if (!prospect?.slug) problems.push(error('slug', 'missing'))
  if (prospect?.industry !== profile.id) {
    problems.push(error('industry', `"${prospect?.industry}" does not match profile "${profile.id}"`))
  }
  if (prospect?.status && !STATUSES.includes(prospect.status)) {
    problems.push(error('status', `unknown status "${prospect.status}"`))
  }

  if (prospect?.provenance === 'fixture' && requireCopy) {
    problems.push(
      error(
        'provenance',
        'collected from a fixture, so the Places facts are placeholders. Re collect against the live API before building.'
      )
    )
  }

  problems.push(...validateFacts(prospect?.facts, profile))
  problems.push(...validateDesign(prospect?.design, profile, requireCopy))

  if (requireCopy || prospect?.copy) {
    problems.push(...validateCopy(prospect?.copy, requireCopy))
    problems.push(...validateCopyRules(prospect?.copy))
  }

  if (requireCopy) {
    problems.push(...validateCopyGrounding(prospect))
  }

  return problems
}

function isSourced(value) {
  return value && typeof value === 'object' && URL_PATTERN.test(String(value.source || ''))
}

function validateFacts(facts, profile) {
  const problems = []
  if (!facts || typeof facts !== 'object') return [error('facts', 'missing')]

  if (!isSourced(facts.name) || !facts.name.value) {
    problems.push(error('facts.name', 'a sourced business name is required'))
  }

  // Every optional scalar fact is either null or a sourced claim. Nothing in
  // between, so "we looked and did not find it" stays distinguishable from
  // "somebody typed a value with no source".
  const sourcedScalars = [
    'phone',
    'address',
    'hours',
    'yearsInBusiness',
    'crewSize',
    'ownerName',
    'paymentMethods',
    'freeEstimates',
    'languages',
    'certifications',
    'serviceArea',
  ]
  sourcedScalars.forEach((key) => {
    const value = facts[key]
    if (value === null || value === undefined) return
    if (!isSourced(value)) {
      problems.push(error(`facts.${key}`, 'present but has no valid source URL'))
    }
    if (value?.value === undefined || value?.value === null || value?.value === '') {
      problems.push(error(`facts.${key}`, 'has a source but no value, use null instead'))
    }
  })

  if (!Array.isArray(facts.ratings)) {
    problems.push(error('facts.ratings', 'must be an array, use [] when none were found'))
  } else {
    facts.ratings.forEach((rating, i) => {
      const at = `facts.ratings.${i}`
      if (!rating.source) problems.push(error(at, 'missing source name'))
      if (!URL_PATTERN.test(String(rating.url || ''))) {
        problems.push(error(at, 'missing a valid url'))
      }
      const score = Number(rating.score)
      if (!Number.isFinite(score) || score < 0 || score > 5) {
        problems.push(error(at, `score ${rating.score} is not between 0 and 5`))
      }
      if (!Number.isInteger(rating.count) || rating.count < 0) {
        problems.push(error(at, `count ${rating.count} is not a non negative integer`))
      }
    })
  }

  // Review quotes are the highest risk field in the whole file. A fabricated
  // testimonial on a page carrying a real business name is the one failure
  // mode that is genuinely damaging, so the bar here is verbatim or absent.
  if (!Array.isArray(facts.reviewQuotes)) {
    problems.push(error('facts.reviewQuotes', 'must be an array, use [] when none were found'))
  } else {
    facts.reviewQuotes.forEach((quote, i) => {
      const at = `facts.reviewQuotes.${i}`
      if (!quote.text?.trim()) problems.push(error(at, 'empty quote text'))
      if (!quote.source) problems.push(error(at, 'missing source platform'))
      if (!URL_PATTERN.test(String(quote.url || ''))) {
        problems.push(error(at, 'missing a url, so the quote cannot be verified'))
      }
      if (!quote.author?.trim()) {
        problems.push(warning(at, 'no author recorded, confirm the quote is attributable'))
      }
    })
  }

  const allowed = serviceKeys(profile)
  if (!Array.isArray(facts.services)) {
    problems.push(error('facts.services', 'must be an array'))
  } else {
    facts.services.forEach((service, i) => {
      const at = `facts.services.${i}`
      if (!allowed.includes(service.key)) {
        problems.push(
          error(at, `"${service.key}" is not in the ${profile.id} service taxonomy`)
        )
      }
      if (!URL_PATTERN.test(String(service.source || ''))) {
        problems.push(error(at, 'missing a source URL'))
      }
    })
    if (!facts.services.length) {
      problems.push(warning('facts.services', 'no services found, the page will be thin'))
    }
  }

  if (prospectHasNoContact(facts)) {
    problems.push(
      warning('facts.phone', 'no phone on file, the demo will lead with the form instead')
    )
  }

  return problems
}

function prospectHasNoContact(facts) {
  return !facts.phone
}

function validateDesign(design, profile, required) {
  if (!design) {
    return required ? [error('design', 'missing, run build to assign a palette')] : []
  }
  const problems = []
  const palette = getPalette(design.paletteId)
  if (!palette) {
    problems.push(error('design.paletteId', `unknown palette "${design.paletteId}"`))
    return problems
  }
  const allowed = palettesInFamilies(profile.design?.paletteFamilies).map((p) => p.id)
  if (!allowed.includes(palette.id)) {
    problems.push(
      error(
        'design.paletteId',
        `palette "${palette.id}" is family "${palette.family}", which ${profile.id} does not allow`
      )
    )
  }
  return problems
}

function validateCopy(copy, required) {
  if (!copy) return required ? [error('copy', 'missing')] : []
  const problems = []
  COPY_SECTIONS.forEach((section) => {
    if (required && !copy[section]) problems.push(error(`copy.${section}`, 'missing'))
  })
  if (copy.hero && !copy.hero.headline) problems.push(error('copy.hero.headline', 'missing'))
  if (copy.seo && !copy.seo.title) problems.push(error('copy.seo.title', 'missing'))
  return problems
}

function validateCopyRules(copy) {
  if (!copy) return []
  const problems = []
  for (const { path, text } of walkStrings(copy, ['copy'])) {
    if (findDashes(text)) {
      problems.push(error(path, `contains a dash: "${truncate(text)}"`))
    }
    const banned = findBannedWords(text)
    if (banned.length) {
      problems.push(error(path, `uses banned word(s): ${banned.join(', ')}`))
    }
  }
  return problems
}

/**
 * Catches the specific failure this whole pipeline exists to prevent: copy
 * that asserts something no fact supports. Not a proof, but it flags the
 * numbers and named claims that are easiest to invent.
 */
function validateCopyGrounding(prospect) {
  const problems = []
  const facts = prospect?.facts || {}
  const copyText = [...walkStrings(prospect?.copy || {})].map((entry) => entry.text).join(' ')

  if (!facts.reviewQuotes?.length) {
    // A quoted sentence in copy with no sourced quote behind it is a red flag.
    const quoted = copyText.match(/["“][^"”]{25,}["”]/g) || []
    quoted.forEach((match) => {
      problems.push(
        warning('copy', `quoted text present but no sourced review quote exists: ${truncate(match)}`)
      )
    })
  }

  if (!facts.yearsInBusiness && /\byears? in business\b/i.test(copyText)) {
    problems.push(warning('copy', 'mentions years in business but no sourced value exists'))
  }
  if (!facts.certifications && /\b(certified|ase|licensed|bonded|insured)\b/i.test(copyText)) {
    problems.push(
      warning('copy', 'mentions certification or licensing but no sourced value exists')
    )
  }
  if (!facts.ownerName && /\bowner[\s']*(operated|run)\b/i.test(copyText)) {
    problems.push(warning('copy', 'claims owner operated but no owner name was sourced'))
  }

  return problems
}

function truncate(text, max = 60) {
  const clean = String(text).replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}...` : clean
}

export function summarize(problems) {
  return {
    errors: problems.filter((p) => p.severity === 'error'),
    warnings: problems.filter((p) => p.severity === 'warning'),
  }
}
