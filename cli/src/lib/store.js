/**
 * Translation between `prospect.json` and a row in `public.prospects`.
 *
 * The database promotes the fields worth querying to columns and leaves the
 * rest as jsonb, so this is where that split gets undone in both directions.
 * `toRow` and `fromRow` are inverses, and a test asserts it, because a lossy
 * round trip here would quietly corrupt research on the next pull.
 */

import { SCHEMA_VERSION } from './schema.js'

export const TABLE = 'prospects'
export const ACTIVE_VIEW = 'prospects_active'
export const CONFLICT_TARGET = 'owner_id,slug'

/** Postgres and JavaScript disagree on ISO formatting. Compare on one of them. */
function isoOrNull(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * The jsonb documents are copied rather than referenced.
 *
 * Without this a row shares `facts` and `copy` with the prospect it came from,
 * so editing one edits the other. That turns a comparison between a local file
 * and a stored row into a comparison of an object with itself, which reports
 * everything as in sync and pushes nothing.
 */
const copyOf = (value) => (value == null ? value : structuredClone(value))

export function toRow(prospect, { ownerId } = {}) {
  if (!prospect?.slug) throw new Error('Prospect has no slug, so it cannot be stored.')
  if (!prospect.provenance) {
    throw new Error(
      `${prospect.slug}: provenance is missing. It records where the facts came from, ` +
        'and the store will not accept a row without it.'
    )
  }

  return {
    ...(ownerId ? { owner_id: ownerId } : {}),
    slug: prospect.slug,
    industry: prospect.industry,
    schema_version: prospect.schemaVersion ?? SCHEMA_VERSION,
    status: prospect.status || 'collected',
    provenance: prospect.provenance,
    google_place_id: prospect.placeId || null,
    score_total: prospect.score?.total ?? null,
    score_reasons: copyOf(prospect.score?.reasons) ?? [],
    website: copyOf(prospect.website) ?? null,
    facts: copyOf(prospect.facts) ?? {},
    unresolved: copyOf(prospect.unresolved) ?? [],
    copy: copyOf(prospect.copy) ?? null,
    design: copyOf(prospect.design) ?? null,
    collected_at: isoOrNull(prospect.collectedAt) || new Date().toISOString(),
    enriched_at: isoOrNull(prospect.enrichedAt),
  }
}

export function fromRow(row) {
  return {
    schemaVersion: row.schema_version ?? SCHEMA_VERSION,
    slug: row.slug,
    industry: row.industry,
    status: row.status,
    provenance: row.provenance,
    placeId: row.google_place_id ?? null,
    collectedAt: isoOrNull(row.collected_at),
    enrichedAt: isoOrNull(row.enriched_at),
    // A row with no score is a prospect with no score, not one scored zero.
    score:
      row.score_total == null
        ? null
        : { total: row.score_total, reasons: copyOf(row.score_reasons) ?? [] },
    website: copyOf(row.website) ?? null,
    facts: copyOf(row.facts) ?? {},
    unresolved: copyOf(row.unresolved) ?? [],
    copy: copyOf(row.copy) ?? null,
    design: copyOf(row.design) ?? null,
  }
}

/**
 * True when a local prospect and a stored row hold the same research.
 *
 * Compares the parts either side is authoritative for and ignores the
 * bookkeeping the database maintains on its own, so a push that changed nothing
 * does not read as a difference on the next status.
 */
export function sameContent(prospect, row) {
  const a = toRow(prospect)
  const b = toRow(fromRow(row))
  return JSON.stringify(a) === JSON.stringify(b)
}
