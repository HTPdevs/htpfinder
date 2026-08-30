import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import * as log from '../lib/log.js'
import { loadProfile, serviceByKey } from '../lib/profiles.js'
import { getPalette, suggestPalette } from '../lib/palettes.js'
import { summarize, validateProspect } from '../lib/validate.js'
import {
  DEMOS_ROOT,
  demoDataDir,
  ensureDir,
  listProspectSlugs,
  prospectFile,
  readJson,
  writeJson,
} from '../lib/paths.js'

export const help = `
htpfinder build <slug>

  Turns a validated prospect.json into the renderer's site.js and theme.css,
  then optionally runs the Vite build.

Options
  --run          Also run the production build for this demo.
  --force        Write the demo files despite validation errors. Does not
                 bypass the fixture provenance guard.
  --palette <id> Override the palette instead of taking the suggested one.
`

export async function run(args) {
  const slug = args._[0]
  if (!slug) {
    log.fail('A slug is required. Try: htpfinder list')
    return 1
  }

  let prospect
  try {
    prospect = readJson(prospectFile(slug, 'prospect.json'))
  } catch {
    log.fail(`No prospect found for "${slug}".`)
    return 1
  }

  const profile = await loadProfile(prospect.industry)

  // Assign a palette before validating, so a prospect that has never been
  // built does not fail purely for lacking one.
  if (args.palette || !prospect.design?.paletteId) {
    const chosen = args.palette
      ? getPalette(args.palette)
      : suggestPalette(profile.design?.paletteFamilies, usedPalettes(slug))
    if (!chosen) {
      log.fail(`Unknown palette "${args.palette}".`)
      return 1
    }
    prospect.design = {
      ...(prospect.design || {}),
      paletteId: chosen.id,
      motif: profile.design?.motif || 'plain',
      mark: profile.design?.mark || 'leaf',
    }
    writeJson(prospectFile(slug, 'prospect.json'), prospect)
    log.info(log.dim(`    palette: ${chosen.id} (${chosen.label})`))
  }

  const problems = validateProspect(prospect, profile, { stage: 'build' })
  const { errors, warnings } = summarize(problems)

  // --force is an escape hatch for judgment calls, not for provenance.
  // Letting placeholder data onto a page carrying a real business name is the
  // one failure this system exists to prevent, so that check ignores --force.
  const blocking = errors.filter((p) => p.path === 'provenance')
  if (blocking.length) {
    log.fail(`${slug} cannot be built:`)
    blocking.forEach((p) => console.log(`       ${p.path}: ${p.message}`))
    return 1
  }

  if (errors.length && !args.force) {
    log.fail(`${slug} is not ready to build:`)
    errors.forEach((p) => console.log(`       ${p.path}: ${p.message}`))
    log.info(log.dim('Fix the file, or pass --force to build anyway.'))
    return 1
  }
  warnings.forEach((p) => log.warn(`${p.path}: ${p.message}`))

  const palette = getPalette(prospect.design.paletteId)
  const dir = ensureDir(demoDataDir(slug))

  fs.writeFileSync(path.join(dir, 'site.js'), renderSiteModule(prospect, profile))
  fs.writeFileSync(path.join(dir, 'theme.css'), renderThemeCss(prospect, palette))

  log.ok(`wrote demos/src/data/${slug}/site.js and theme.css`)

  if (args.run) {
    log.step(`building ${slug}`)
    execFileSync('npx', ['vite', 'build'], {
      cwd: DEMOS_ROOT,
      stdio: 'inherit',
      env: { ...process.env, VITE_DEMO: slug },
    })
  } else {
    log.info(log.dim(`Next: cd demos && VITE_DEMO=${slug} npm run dev`))
  }

  if (prospect.status === 'collected' || prospect.status === 'enriched') {
    prospect.status = 'built'
    writeJson(prospectFile(slug, 'prospect.json'), prospect)
  }

  return 0
}

function usedPalettes(excludeSlug) {
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

const js = (value) => JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')

function renderSiteModule(prospect, profile) {
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

function renderThemeCss(prospect, palette) {
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
