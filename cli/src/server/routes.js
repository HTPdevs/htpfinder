/**
 * The API behind the local UI.
 *
 * Every handler calls the same libs the commands call. Nothing here reimplements
 * a rule: the validator, the scorer, the qualifier and the store are shared, so
 * the UI and the CLI can never disagree about whether a prospect is ready.
 */

import fs from 'node:fs'

import { buildProspect } from '../lib/builder.js'
import { collect, listFixtures } from '../lib/collector.js'
import { listProspectSlugs, prospectFile, readJson, writeJson } from '../lib/paths.js'
import { PALETTES } from '../lib/palettes.js'
import { auditProfile, loadAllProfiles, loadProfile } from '../lib/profiles.js'
import { STATUSES } from '../lib/schema.js'
import { syncPull, syncPush, syncStatus } from '../lib/sync.js'
import { isConfigured, missingConfig } from '../lib/supabase.js'
import { summarize, validateProspect } from '../lib/validate.js'
import { buildBrief as buildPacket, renderBrief as renderPacket } from '../commands/packet.js'
import { buildBrief as buildProfileBrief, renderBrief as renderProfileBrief } from '../commands/profile.js'

class HttpError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

function readProspect(slug) {
  try {
    return readJson(prospectFile(slug, 'prospect.json'))
  } catch {
    throw new HttpError(404, `No prospect found for "${slug}".`, 'not_found')
  }
}

function allProspects() {
  return listProspectSlugs()
    .map((slug) => {
      try {
        return readJson(prospectFile(slug, 'prospect.json'))
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/** The row the list screen needs. Deliberately not the whole document. */
function summary(prospect) {
  return {
    slug: prospect.slug,
    industry: prospect.industry,
    status: prospect.status,
    provenance: prospect.provenance ?? null,
    score: prospect.score?.total ?? null,
    name: prospect.facts?.name?.value ?? null,
    hasPhone: Boolean(prospect.facts?.phone),
    quotes: prospect.facts?.reviewQuotes?.length ?? 0,
    services: prospect.facts?.services?.length ?? 0,
    unresolved: prospect.unresolved?.length ?? 0,
    built: Boolean(prospect.design?.paletteId),
  }
}

function usedPalettes() {
  return allProspects()
    .map((prospect) => prospect.design?.paletteId)
    .filter(Boolean)
}

export function routes() {
  return [
    {
      method: 'GET',
      path: '/api/state',
      handler: async () => {
        const profiles = await loadAllProfiles()
        const prospects = allProspects()

        return {
          prospects: prospects.map(summary),
          industries: profiles.map((profile) => ({ id: profile.id, label: profile.label })),
          statuses: STATUSES,
          fixtures: listFixtures(),
          supabase: { configured: isConfigured(), missing: missingConfig() },
          placesKey: Boolean(process.env.GOOGLE_PLACES_API_KEY),
        }
      },
    },

    {
      method: 'GET',
      path: '/api/prospects/:slug',
      handler: async ({ params }) => {
        const prospect = readProspect(params.slug)
        const profile = await loadProfile(prospect.industry)

        // Both stages, because a collected prospect failing the build stage is
        // expected and should not read as broken.
        const build = summarize(validateProspect(prospect, profile, { stage: 'build' }))
        const collectStage = summarize(validateProspect(prospect, profile, { stage: 'collect' }))

        return {
          prospect,
          profile: { id: profile.id, label: profile.label },
          validation: { build, collect: collectStage },
          hasRaw: fs.existsSync(prospectFile(params.slug, 'raw.json')),
        }
      },
    },

    {
      method: 'GET',
      path: '/api/prospects/:slug/packet',
      handler: async ({ params }) => {
        const prospect = readProspect(params.slug)
        const profile = await loadProfile(prospect.industry)
        const brief = buildPacket(prospect, profile, usedPalettes())
        return { brief, text: renderPacket(brief) }
      },
    },

    {
      method: 'POST',
      path: '/api/prospects/:slug/build',
      handler: async ({ params, body }) => {
        const result = await buildProspect(params.slug, {
          palette: body.palette,
          force: Boolean(body.force),
          vite: Boolean(body.vite),
        })
        return { ...result, prospect: readProspect(params.slug) }
      },
    },

    {
      method: 'POST',
      path: '/api/prospects/:slug/status',
      handler: async ({ params, body }) => {
        if (!STATUSES.includes(body.status)) {
          throw new HttpError(400, `Unknown status "${body.status}".`, 'bad_status')
        }
        const prospect = readProspect(params.slug)
        prospect.status = body.status
        writeJson(prospectFile(params.slug, 'prospect.json'), prospect)
        return { prospect }
      },
    },

    {
      method: 'GET',
      path: '/api/industries',
      handler: async () => {
        const profiles = await loadAllProfiles()
        return {
          industries: await Promise.all(
            profiles.map(async (profile) => ({
              id: profile.id,
              label: profile.label,
              directories: profile.directories || [],
              services: profile.serviceTaxonomy?.length ?? 0,
              minReviews: profile.qualify?.minReviews ?? null,
              idealReviews: profile.qualify?.idealReviews ?? null,
              motif: profile.design?.motif ?? null,
              mark: profile.design?.mark ?? null,
              paletteFamilies: profile.design?.paletteFamilies || [],
              researched: profile.research?.businesses?.filter((b) => b?.name).length ?? 0,
              warnings: await auditProfile(profile),
            }))
          ),
        }
      },
    },

    {
      method: 'GET',
      path: '/api/industries/:id/brief',
      handler: async ({ params }) => {
        const shipped = await loadAllProfiles()
        const label = params.id
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
        const brief = await buildProfileBrief({ id: params.id, label, shipped })
        return { brief, text: renderProfileBrief(brief) }
      },
    },

    {
      method: 'GET',
      path: '/api/palettes',
      handler: async () => ({
        palettes: PALETTES.map((p) => ({
          id: p.id,
          label: p.label,
          family: p.family,
          tokens: p.tokens,
        })),
        taken: usedPalettes(),
      }),
    },

    {
      // Preview and commit are the same call with one flag, so what the preview
      // showed is exactly what the commit does rather than a second decision.
      method: 'POST',
      path: '/api/collect',
      handler: async ({ body }) =>
        collect({
          industry: body.industry,
          near: body.near,
          limit: Number(body.limit) || 60,
          fixture: body.fixture || null,
          keepLive: Boolean(body.keepLive),
          check: body.check !== false,
          dryRun: body.dryRun !== false,
        }),
    },

    { method: 'GET', path: '/api/sync/status', handler: async () => ({ rows: await syncStatus() }) },

    {
      method: 'POST',
      path: '/api/sync/push',
      handler: async ({ body }) =>
        syncPush({ slug: body.slug, force: Boolean(body.force), dryRun: Boolean(body.dryRun) }),
    },

    {
      method: 'POST',
      path: '/api/sync/pull',
      handler: async ({ body }) =>
        syncPull({ slug: body.slug, force: Boolean(body.force), dryRun: Boolean(body.dryRun) }),
    },
  ]
}
