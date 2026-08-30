/**
 * Turning a validated prospect into the renderer's files.
 *
 * Lifted out of the build command so the command and the local UI run the same
 * code rather than two implementations that drift. The command prints; this
 * decides and writes, and reports what it did as data.
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { loadProfile, serviceByKey } from './profiles.js'
import { getPalette, suggestPalette } from './palettes.js'
import { summarize, validateProspect } from './validate.js'
import {
  DEMOS_ROOT,
  demoDataDir,
  ensureDir,
  listProspectSlugs,
  prospectFile,
  readJson,
  writeJson,
} from './paths.js'

const run = promisify(execFile)

export class BuildError extends Error {
  constructor(message, { problems = [], code = 'build_failed' } = {}) {
    super(message)
    this.name = 'BuildError'
    this.problems = problems
    this.code = code
  }
}

export function usedPalettes(excludeSlug) {
  return listProspectSlugs()
    .filter((slug) => slug !== excludeSlug)
    .map((slug) => {
      try {
        return readJson(prospectFile(slug, 'prospect.json'))?.design?.paletteId || null
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/**
 * Assigns a palette, validates, writes site.js and theme.css.
 *
 * `force` is an escape hatch for judgment calls, not for provenance. Letting
 * placeholder data onto a page carrying a real business name is the one failure
 * this system exists to prevent, so that check ignores it.
 */
export async function buildProspect(
  slug,
  { palette: paletteId, force = false, vite = false, onProgress = () => {} } = {}
) {
  let prospect
  try {
    prospect = readJson(prospectFile(slug, 'prospect.json'))
  } catch {
    throw new BuildError(`No prospect found for "${slug}".`, { code: 'not_found' })
  }

  const profile = await loadProfile(prospect.industry)
  const assigned = []

  // Assigned before validating, so a prospect that has never been built does
  // not fail purely for lacking one.
  if (paletteId || !prospect.design?.paletteId) {
    const chosen = paletteId
      ? getPalette(paletteId)
      : suggestPalette(profile.design?.paletteFamilies, usedPalettes(slug))
    if (!chosen) throw new BuildError(`Unknown palette "${paletteId}".`, { code: 'bad_palette' })

    prospect.design = {
      ...(prospect.design || {}),
      paletteId: chosen.id,
      motif: profile.design?.motif || 'plain',
      mark: profile.design?.mark || 'leaf',
    }
    writeJson(prospectFile(slug, 'prospect.json'), prospect)
    assigned.push(chosen)
  }

  const problems = validateProspect(prospect, profile, { stage: 'build' })
  const { errors, warnings } = summarize(problems)

  const blocking = errors.filter((p) => p.path === 'provenance')
  if (blocking.length) {
    throw new BuildError(`${slug} cannot be built.`, { problems: blocking, code: 'provenance' })
  }
  if (errors.length && !force) {
    throw new BuildError(`${slug} is not ready to build.`, { problems: errors, code: 'invalid' })
  }

  const palette = getPalette(prospect.design.paletteId)
  const dir = ensureDir(demoDataDir(slug))

  fs.writeFileSync(path.join(dir, 'site.js'), renderSiteModule(prospect, profile))
  fs.writeFileSync(path.join(dir, 'theme.css'), renderThemeCss(prospect, palette))

  let built = false
  if (vite) {
    onProgress({ stage: 'vite', message: `building ${slug}` })
    await run('npx', ['vite', 'build'], {
      cwd: DEMOS_ROOT,
      env: { ...process.env, VITE_DEMO: slug },
    })
    built = true
  }

  if (prospect.status === 'collected' || prospect.status === 'enriched') {
    prospect.status = 'built'
    writeJson(prospectFile(slug, 'prospect.json'), prospect)
  }

  return {
    slug,
    palette,
    assignedPalette: assigned[0] || null,
    warnings,
    forced: Boolean(errors.length && force),
    errors: force ? errors : [],
    viteBuilt: built,
    files: [`demos/src/data/${slug}/site.js`, `demos/src/data/${slug}/theme.css`],
  }
}

const js = (value) => JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')

export function renderSiteModule(prospect, profile) {
  const facts = prospect.facts
  const copy = prospect.copy

  const services = (facts.services || []).map((service) => {
    const taxonomy = serviceByKey(profile, service.key)
    return {
      title: service.label || taxonomy?.label || service.key,
      blurb: service.blurb || '',
      icon: service.icon || taxonomy?.icon || 'Leaf',
    }
  })

  const site = {
    slug: prospect.slug,
    industry: prospect.industry,
    seo: copy.seo,
    business: {
      name: facts.name?.value || prospect.slug,
      shortName: copy.footer?.shortName || facts.name?.value || prospect.slug,
      phone: facts.phone?.value || null,
      hours: facts.hours?.value || null,
      address: facts.address?.value || null,
      tagline: copy.footer?.tagline || '',
      legalNote: copy.footer?.legalNote || '',
      sourceNote: copy.footer?.sourceNote || '',
    },
    nav: copy.nav || [
      { id: 'about', label: 'About' },
      { id: 'reviews', label: 'Reviews' },
      { id: 'contact', label: 'Contact' },
    ],
    hero: {
      ...copy.hero,
      rating: primaryRating(facts),
      chips: copy.hero?.chips || [],
    },
    cta: copy.cta,
    about: {
      ...copy.about,
      services,
      places: facts.serviceArea?.value || [],
    },
    reviews: {
      ...copy.reviews,
      ratings: (facts.ratings || []).map((rating) => ({
        score: formatScore(rating.score),
        count: rating.count,
        source: rating.source,
      })),
      items: (facts.reviewQuotes || []).map((quote) => ({
        quote: quote.text,
        attribution: [quote.author, quote.source].filter(Boolean).join(', '),
      })),
    },
    contact: copy.contact,
    design: {
      motif: prospect.design.motif,
      mark: prospect.design.mark,
    },
  }

  return `/**
 * ${site.business.name}
 *
 * GENERATED FILE. Do not edit by hand.
 * Source: data/prospects/${prospect.slug}/prospect.json
 * Regenerate: htpfinder build ${prospect.slug}
 *
 * Every factual claim in here traces to a source URL recorded in the prospect
 * file. Editing this file directly breaks that chain.
 */
export default ${js(site)}
`
}

/** A rating always reads with one decimal, so "5" never looks like a typo. */
function formatScore(score) {
  return Number(score).toFixed(1)
}

function primaryRating(facts) {
  const rating = (facts.ratings || [])[0]
  if (!rating) return null
  return { score: formatScore(rating.score), count: rating.count, source: rating.source }
}

export function renderThemeCss(prospect, palette) {
  const tokens = Object.entries(palette.tokens)
    .map(([name, value]) => `  --${name}: ${value};`)
    .join('\n')

  return `/*
 * ${prospect.facts.name?.value || prospect.slug}
 * Palette: ${palette.label} (${palette.family})
 *
 * GENERATED FILE. Do not edit by hand.
 * Change the palette with: htpfinder build ${prospect.slug} --palette <id>
 */
:root {
${tokens}

  --radius: ${palette.radius};

  --stripe-angle: ${palette.stripeAngle};
  --stripe-width: ${palette.stripeWidth};
}
`
}
