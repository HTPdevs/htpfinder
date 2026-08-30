/**
 * Writing a prospect's copy from the facts it already carries.
 *
 * The research step, where an agent reads directory listings and fills in years
 * in business, crew size and services, is still the thing that makes a demo
 * page good. This is the floor underneath it: a collected prospect can become a
 * buildable one with no agent involved at all, so a sweep of forty businesses
 * is forty demo sites the same afternoon rather than forty research jobs.
 *
 * The rule that makes that safe is that this file invents nothing. Every
 * sentence is assembled from a fact that is present and sourced, and any
 * sentence whose fact is missing is not written at all. There is no template
 * with a blank in it, because a blank is where a plausible guess ends up.
 *
 * Copy written here is replaced wholesale by a later enrichment pass, and this
 * refuses to overwrite copy that already exists unless asked, so running it
 * over a researched prospect cannot destroy the research.
 */

import { getPalette, suggestPalette } from './palettes.js'
import { loadProfile, serviceByKey } from './profiles.js'
import { prospectFile, readJson, writeJson } from './paths.js'
import { orderProspect } from './schema.js'
import { usedPalettes } from './builder.js'
import { summarize, validateProspect } from './validate.js'

export class EnrichError extends Error {
  constructor(message, { code = 'enrich_failed' } = {}) {
    super(message)
    this.name = 'EnrichError'
    this.code = code
  }
}

const SOURCE_NOTE =
  'This is an unaffiliated concept preview built from public listings. Nothing on this page ' +
  'has been invented. Every claim traces back to a source.'

const REVIEW_PLACEHOLDER =
  'More reviews would appear here on a live site. Every rating and quote on this page traces ' +
  'back to a real listing.'

/**
 * Generates copy for one prospect and writes it back.
 *
 * Returns what it wrote plus the validation result, so a caller can report
 * "enriched, and here is what still stands between this and a build" in one
 * pass instead of asking the user to run the validator themselves.
 */
export async function enrichProspect(slug, { force = false, palette: paletteId } = {}) {
  let prospect
  try {
    prospect = readJson(prospectFile(slug, 'prospect.json'))
  } catch {
    throw new EnrichError(`No prospect found for "${slug}".`, { code: 'not_found' })
  }

  // A fixture prospect can never be built, so writing copy for one spends a
  // palette that a real prospect would otherwise get. Development data should
  // not push live businesses onto their fourth choice of colour.
  if (prospect.provenance === 'fixture' && !force) {
    throw new EnrichError(
      `${slug} came from a recorded sweep, so it can never be built. Collect it against the live API first.`,
      { code: 'fixture' }
    )
  }

  if (prospect.copy && !force) {
    throw new EnrichError(
      `${slug} already has copy. Pass force to replace it with generated copy.`,
      { code: 'has_copy' }
    )
  }

  const profile = await loadProfile(prospect.industry)

  // The palette is settled here rather than at build time, because the theme
  // color belongs in `copy.seo` and a color picked later would disagree with it.
  const palette = paletteId
    ? getPalette(paletteId)
    : getPalette(prospect.design?.paletteId) ||
      suggestPalette(profile.design?.paletteFamilies, usedPalettes(slug))
  if (!palette) throw new EnrichError(`Unknown palette "${paletteId}".`, { code: 'bad_palette' })

  prospect.design = {
    ...(prospect.design || {}),
    paletteId: palette.id,
    motif: profile.design?.motif || 'plain',
    mark: profile.design?.mark || 'leaf',
  }

  const replaced = Boolean(prospect.copy)
  prospect.copy = writeCopy(prospect, profile, palette)
  prospect.enrichedAt = new Date().toISOString()
  if (prospect.status === 'collected') prospect.status = 'enriched'

  writeJson(prospectFile(slug, 'prospect.json'), orderProspect(prospect))

  const { errors, warnings } = summarize(validateProspect(prospect, profile, { stage: 'build' }))
  return { slug, prospect, palette, replaced, errors, warnings }
}

/* Reading the facts */

/**
 * The city and state out of a Places formatted address.
 *
 * Places writes "1234 SE Foo St, Portland, OR 97202, USA", so the part before
 * the one that opens with a state code is the city. Anything that does not
 * match that shape returns null and every sentence that wanted a city is
 * dropped, which is the correct outcome: a page that says nothing about where
 * a business works beats one that says the wrong place.
 */
export function placeOf(address) {
  if (!address) return null
  const parts = String(address)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  // The state code, alone or followed by a zip, and nothing else. Loose
  // matching here picks up a street like "SE Powell Blvd" and puts a house
  // number where a city name belongs.
  for (let i = 1; i < parts.length; i += 1) {
    const match = parts[i].match(/^([A-Z]{2})(\s+\d{5}(\d{4})?)?$/)
    if (match && parts[i - 1]) {
      return { city: parts[i - 1], region: match[1], full: `${parts[i - 1]}, ${match[1]}` }
    }
  }

  // Places sometimes gives a short address with no state at all. The last part
  // that is not a country and carries no digits is the city.
  const countries = new Set(['usa', 'us', 'united states', 'canada'])
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const part = parts[i]
    if (/\d/.test(part) || countries.has(part.toLowerCase())) continue
    return { city: part, region: null, full: part }
  }

  return null
}

/** The rating a page leads with, formatted the way the renderer shows it. */
function ratingOf(facts) {
  const rating = (facts.ratings || [])[0]
  if (!rating || !Number.isFinite(Number(rating.score))) return null
  return {
    score: Number(rating.score).toFixed(1),
    count: Number(rating.count) || 0,
    source: rating.source,
  }
}

/** Drops a legal suffix, so a header does not read "Foo Yard Care LLC". */
function shortNameOf(name) {
  return String(name)
    .replace(/[,]?\s+(llc|l\.l\.c\.?|inc\.?|incorporated|co\.?|corp\.?|ltd\.?)$/i, '')
    .trim()
}

/** "mowing, trimming and mulching" */
function listOf(items) {
  const clean = items.filter(Boolean)
  if (clean.length <= 1) return clean[0] || ''
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`
}

const upperFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/* Writing the copy */

export function writeCopy(prospect, profile, palette) {
  const facts = prospect.facts || {}
  const name = facts.name?.value || prospect.slug
  const shortName = shortNameOf(name)
  const where = placeOf(facts.address?.value)
  const rating = ratingOf(facts)
  const phone = facts.phone?.value || null
  const quotes = facts.reviewQuotes || []
  const freeEstimates = facts.freeEstimates?.value === true

  // A short trade word for prose. The label is a heading, so "Lawn and Yard
  // Maintenance from Foo" reads like a directory entry rather than a sentence.
  const trade = profile.copy?.trade || String(profile.label).toLowerCase()

  const services = (facts.services || [])
    .map((service) => serviceByKey(profile, service.key)?.label || service.label || null)
    .filter(Boolean)
    .map((label) => label.toLowerCase())

  const area = facts.serviceArea?.value
  const areaList = Array.isArray(area) ? area : area ? [area] : []

  /**
   * Three short lists, none of them the same list.
   *
   * The hero already shows the rating as its own badge and the about section
   * already shows it as a stat, so neither list repeats it. A page that says
   * the same three things in three places reads as generated, which is the one
   * impression a demo cannot afford.
   */
  const chips = [
    where && `Working in ${where.city}`,
    freeEstimates ? 'Free estimates' : null,
    services.length ? `${plural(services.length, 'service')} listed` : null,
  ].filter(Boolean)

  // Two lines each: what is true, and where that came from. The renderer draws
  // the second line smaller under the first.
  const points = [
    facts.yearsInBusiness?.value && {
      title: `${facts.yearsInBusiness.value} years in business`,
      detail: '',
    },
    facts.crewSize?.value && { title: `A crew of ${facts.crewSize.value}`, detail: '' },
    freeEstimates && { title: 'Free estimates', detail: '' },
    services.length && { title: 'What they take on', detail: upperFirst(listOf(services)) },
    areaList.length && { title: 'Where they work', detail: listOf(areaList) },
    where && { title: `Based in ${where.full}`, detail: facts.address?.value || '' },
  ]
    .filter(Boolean)
    .slice(0, 4)

  const ctaPoints = [
    phone ? `Call ${phone}` : 'Reachable through the form',
    rating && `${rating.score} on ${rating.source}`,
    freeEstimates ? 'Free estimates' : null,
  ].filter(Boolean)

  const ratingSentence = rating
    ? `${plural(rating.count, 'customer')} ${rating.count === 1 ? 'has' : 'have'} rated it ` +
      `${rating.score} on ${rating.source}.`
    : null
  const serviceSentence = services.length ? `The work covers ${listOf(services)}.` : null
  const areaSentence = areaList.length
    ? `${shortName} takes on work in ${listOf(areaList)}.`
    : where
      ? `${shortName} is listed in ${where.full}. Ask which areas are covered.`
      : null
  const callSentence = phone
    ? `Call ${phone} to talk about the work.`
    : `Send a message and ${shortName} can pick it up from there.`

  const headline = where
    ? `${where.city} ${trade} from ${shortName}`
    : upperFirst(`${trade} from ${shortName}`)

  return {
    seo: {
      title: where ? `${shortName} | ${where.full} ${profile.label}` : `${shortName} | ${profile.label}`,
      description: [
        where ? `${upperFirst(trade)} in ${where.full} from ${name}.` : `${upperFirst(trade)} from ${name}.`,
        ratingSentence,
        serviceSentence,
      ]
        .filter(Boolean)
        .join(' '),
      themeColor: hexOf(palette.tokens.brand),
    },

    nav: [
      { id: 'about', label: 'About' },
      { id: 'reviews', label: 'Reviews' },
      { id: 'contact', label: 'Contact' },
    ],

    hero: {
      eyebrow: where ? `${where.full} ${trade}` : upperFirst(trade),
      headline,
      subhead: [ratingSentence, serviceSentence].filter(Boolean).join(' ') || areaSentence || '',
      footnote: phone ? `Call ${phone} to get on the schedule.` : 'Send a message to get started.',
      chips,
    },

    cta: {
      primary: phone ? `Call ${phone}` : 'Send a message',
      secondary: 'Ask for a quote',
      eyebrow: 'Ready when you are',
      headline: `Get in touch with ${shortName}`,
      body: phone
        ? 'One call reaches the people who would do the work.'
        : `Send a note and ${shortName} can pick it up from there.`,
      points: ctaPoints,
    },

    about: {
      eyebrow: `About ${shortName}`,
      headline: rating
        ? `Rated ${rating.score} by ${plural(rating.count, 'customer')}`
        : where
          ? `${upperFirst(trade)} in ${where.city}`
          : upperFirst(trade),
      body: [
        where ? `${name} does ${trade} in ${where.full}.` : `${name} does ${trade}.`,
        ratingSentence,
        serviceSentence,
        // Hours are a fact the renderer already shows in full, so the prose
        // says they exist rather than repeating seven lines of them.
        facts.hours?.value ? 'Opening hours are listed below.' : null,
      ]
        .filter(Boolean)
        .join(' '),
      points,
      stats: [
        rating && { label: 'Rating', value: rating.score },
        rating?.count ? { label: 'Reviews', value: String(rating.count) } : null,
        facts.yearsInBusiness?.value
          ? { label: 'Years in business', value: String(facts.yearsInBusiness.value) }
          : null,
        facts.crewSize?.value ? { label: 'Crew size', value: String(facts.crewSize.value) } : null,
      ]
        .filter(Boolean)
        .slice(0, 3),
      servicesHeadline: services.length ? `What ${shortName} handles` : '',
      areaHeadline: `Where ${shortName} works`,
      areaBody: areaSentence || '',
    },

    reviews: {
      eyebrow: 'Reviews',
      headline: quotes.length ? 'What customers wrote' : 'What the ratings say',
      body: quotes.length
        ? `Verbatim from ${listOf([...new Set(quotes.map((quote) => quote.source))])}, shown exactly as posted.`
        : 'No public review text was found, so only the ratings are shown here.',
      placeholder: REVIEW_PLACEHOLDER,
    },

    contact: {
      eyebrow: 'Get in touch',
      headline: phone ? `Call ${shortName}` : `Message ${shortName}`,
      body: [callSentence, areaSentence].filter(Boolean).join(' '),
      noPhoneNote: phone ? '' : 'No phone number was found on any public listing.',
      formPlaceholder: 'Say what you need and when you need it.',
      formButton: 'Ask for a quote',
    },

    footer: {
      shortName,
      tagline: where ? `${where.city} ${trade}` : upperFirst(trade),
      legalNote: where ? `${name}, ${where.full}` : name,
      sourceNote: SOURCE_NOTE,
    },
  }
}

/**
 * A palette token as hex.
 *
 * `seo.themeColor` ends up in a meta tag, and a browser will not read the HSL
 * triple the CSS variables are stored as.
 */
export function hexOf(token) {
  const [h, s, l] = String(token)
    .replace(/%/g, '')
    .split(/\s+/)
    .map(Number)

  const saturation = s / 100
  const lightness = l / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const second = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const match = lightness - chroma / 2

  const [r, g, b] = (() => {
    if (h < 60) return [chroma, second, 0]
    if (h < 120) return [second, chroma, 0]
    if (h < 180) return [0, chroma, second]
    if (h < 240) return [0, second, chroma]
    if (h < 300) return [second, 0, chroma]
    return [chroma, 0, second]
  })()

  const channel = (value) =>
    Math.round((value + match) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${channel(r)}${channel(g)}${channel(b)}`
}
