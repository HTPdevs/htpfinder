/**
 * Moving prospects between the working files and Supabase.
 *
 * Files stay the surface an agent edits, because the enrichment step is someone
 * reading a brief and filling one in, and that does not want a database in the
 * middle. Supabase is where the result lives afterwards. This is the seam, and
 * it returns data so the command and the local UI can present it differently.
 *
 * `raw.json` is never pushed. It is the verbatim Places response and Google's
 * terms restrict storing it, so the place id travels and the rest does not.
 */

import fs from 'node:fs'

import { listProspectSlugs, prospectFile, readJson, writeJson } from './paths.js'
import { createClient } from './supabase.js'
import { ACTIVE_VIEW, CONFLICT_TARGET, fromRow, sameContent, TABLE, toRow } from './store.js'

export class SyncConflictError extends Error {
  constructor(slugs) {
    super(
      `${slugs.length} local file(s) would be overwritten. ` +
        'Check them, then force to take the stored copy.'
    )
    this.name = 'SyncConflictError'
    this.slugs = slugs
  }
}

/**
 * Local prospects, by slug. A directory with no prospect.json is not one yet.
 *
 * `mustExist` is what separates the two callers. Naming a slug that has no file
 * is a mistake when pushing and the whole point when pulling.
 */
export function readLocal(only, { mustExist = false } = {}) {
  const slugs = only ? [only] : listProspectSlugs()
  const found = new Map()

  for (const slug of slugs) {
    const file = prospectFile(slug, 'prospect.json')
    if (!fs.existsSync(file)) {
      if (only && mustExist) {
        throw new Error(`No prospect file for "${slug}". Run htpfinder collect first.`)
      }
      continue
    }
    found.set(slug, readJson(file))
  }

  return found
}

/**
 * Stored prospects, by slug. Always the whole row, because every caller ends up
 * comparing content and a summary cannot answer that.
 */
async function readRemote(client, only) {
  const filter = only ? `&slug=eq.${encodeURIComponent(only)}` : ''
  const rows = await client.select(ACTIVE_VIEW, `select=*${filter}&order=slug`)
  return new Map((rows || []).map((row) => [row.slug, row]))
}

/**
 * What differs, and which way.
 *
 * Deliberately not a merge. When both sides changed, this says so and stops,
 * because guessing which edit to keep is how research gets silently lost.
 */
export function compare(local, remote) {
  const slugs = [...new Set([...local.keys(), ...remote.keys()])].sort()

  return slugs.map((slug) => {
    const here = local.get(slug)
    const there = remote.get(slug)

    if (here && !there) return { slug, state: 'local only', here, there }
    if (!here && there) return { slug, state: 'remote only', here, there }
    if (sameContent(here, there)) return { slug, state: 'in sync', here, there }
    return { slug, state: 'differs', here, there }
  })
}

/**
 * Slugs whose stored row is soft deleted.
 *
 * These are invisible to the active view, so without this check they look like
 * brand new prospects and an upsert quietly reinstates them. Something was
 * deleted for a reason, sometimes a removal request, so bringing it back is a
 * decision to make out loud.
 */
async function deletedSlugs(client, slugs) {
  if (!slugs.length) return new Set()
  const list = slugs.map((s) => `"${s}"`).join(',')
  const rows = await client.select(
    TABLE,
    `select=slug&deleted_at=not.is.null&slug=in.(${encodeURIComponent(list)})`
  )
  return new Set((rows || []).map((row) => row.slug))
}

export async function syncStatus(slug) {
  const client = createClient()
  const rows = compare(readLocal(slug), await readRemote(client, slug))

  return rows.map((row) => ({
    slug: row.slug,
    state: row.state,
    status: (row.here || row.there).status,
    score: row.here?.score?.total ?? row.there?.score_total ?? null,
    storedAt: row.there?.updated_at ?? null,
  }))
}

export async function syncPush({ slug, force = false, dryRun = false } = {}) {
  const client = createClient()
  const local = readLocal(slug, { mustExist: true })
  if (!local.size) return { pushed: [], skipped: [], alreadyInSync: 0, dryRun }

  const rows = compare(local, await readRemote(client, slug)).filter((row) => row.here)
  let outgoing = rows.filter((row) => row.state !== 'in sync')

  const deleted = await deletedSlugs(
    client,
    outgoing.map((row) => row.slug)
  )
  const skipped = []
  if (deleted.size && !force) {
    skipped.push(...outgoing.filter((row) => deleted.has(row.slug)).map((row) => row.slug))
    outgoing = outgoing.filter((row) => !deleted.has(row.slug))
  }

  const planned = outgoing.map((row) => ({
    slug: row.slug,
    action: deleted.has(row.slug) ? 'restore' : row.state === 'local only' ? 'create' : 'update',
  }))

  if (dryRun || !outgoing.length) {
    return { pushed: planned, skipped, alreadyInSync: rows.length - outgoing.length, dryRun }
  }

  // owner_id is sent explicitly rather than left to its default, so the
  // conflict target on (owner_id, slug) is unambiguous. Row level security
  // still checks it against the signed in user, so this cannot claim a row for
  // anyone else.
  await client.signIn()
  const payload = [...local.values()]
    .filter((prospect) => outgoing.some((row) => row.slug === prospect.slug))
    .map((prospect) => ({
      ...toRow(prospect, { ownerId: client.userId }),
      // Only reached with force, since a deleted prospect is skipped above.
      ...(deleted.has(prospect.slug) ? { deleted_at: null } : {}),
    }))

  await client.upsert(TABLE, payload, CONFLICT_TARGET)

  return { pushed: planned, skipped, alreadyInSync: rows.length - outgoing.length, dryRun: false }
}

export async function syncPull({ slug, force = false, dryRun = false } = {}) {
  const client = createClient()
  const remote = await readRemote(client, slug)
  if (!remote.size) return { pulled: [], alreadyInSync: 0, dryRun }

  const rows = compare(readLocal(slug), remote).filter((row) => row.there)

  const conflicts = rows.filter((row) => row.state === 'differs').map((row) => row.slug)
  if (conflicts.length && !force) throw new SyncConflictError(conflicts)

  const incoming = rows.filter((row) => row.state !== 'in sync')
  const planned = incoming.map((row) => ({
    slug: row.slug,
    action: row.state === 'remote only' ? 'create' : 'overwrite',
  }))

  if (!dryRun) {
    incoming.forEach((row) => writeJson(prospectFile(row.slug, 'prospect.json'), fromRow(row.there)))
  }

  return { pulled: planned, alreadyInSync: rows.length - incoming.length, dryRun }
}
