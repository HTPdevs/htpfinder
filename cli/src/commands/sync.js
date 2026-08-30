/**
 * Moves prospects between the working files and Supabase.
 *
 * Files stay the surface an agent edits, because the enrichment step is a human
 * or an agent reading a brief and filling in a file, and that does not want a
 * database in the middle. Supabase is where the result lives afterwards: it can
 * scope rows to their owner and it can actually delete, which a git history
 * cannot. `sync` is the seam between the two.
 *
 * `raw.json` is never pushed. It is the verbatim Places response and Google's
 * terms restrict storing it, so the place id travels and the rest does not.
 */

import fs from 'node:fs'

import * as log from '../lib/log.js'
import { listProspectSlugs, prospectFile, readJson, writeJson } from '../lib/paths.js'
import { createClient, NotConfiguredError, SupabaseError } from '../lib/supabase.js'
import { ACTIVE_VIEW, CONFLICT_TARGET, fromRow, sameContent, TABLE, toRow } from '../lib/store.js'

export const help = `
htpfinder sync <push|pull|status|login> [slug]

  Moves prospects between data/prospects/ and Supabase. Files stay the working
  surface; Supabase is the store of record.

  With no slug, acts on every prospect.

Commands
  status              Compare local files against stored rows, change nothing
  push [slug]         Send local prospects up, creating or updating rows
  pull [slug]         Write stored prospects down into files
  login               Check the credentials in .env, and create the account
                      with --signup if it does not exist yet

Options
  --dry-run           Say what would happen without writing anything
  --force             On pull, overwrite a local file that has its own changes.
                      On push, put back a prospect that was deleted from the store
  --signup            login only. Registers the account named in .env
`

export async function run(args) {
  const action = args._[0]
  const slug = args._[1]

  const actions = { status, push, pull, login }
  if (!action || !actions[action]) {
    log.fail(`Expected one of: status, push, pull, login. Got ${action ? `"${action}"` : 'nothing'}.`)
    return 1
  }

  try {
    return await actions[action]({ args, slug })
  } catch (err) {
    if (err instanceof NotConfiguredError) {
      log.fail(err.message)
      return 1
    }
    if (err instanceof SupabaseError && /invalid login credentials/i.test(err.message)) {
      log.fail(err.message)
      log.info(
        log.dim('The account in .env does not exist yet. Create it: htpfinder sync login --signup')
      )
      return 1
    }
    throw err
  }
}

/**
 * Local prospects, by slug. A directory with no prospect.json is not one yet.
 *
 * `mustExist` is what separates the two callers. Naming a slug that has no file
 * is a mistake when pushing and the whole point when pulling.
 */
function readLocal(only, { mustExist = false } = {}) {
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
function compare(local, remote) {
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

async function status({ slug }) {
  const client = createClient()
  const local = readLocal(slug)
  const remote = await readRemote(client, slug)
  const rows = compare(local, remote)

  if (!rows.length) {
    log.warn('Nothing here and nothing stored. Run htpfinder collect to find some.')
    return 0
  }

  log.table(rows, [
    { label: 'STATE', get: (r) => r.state },
    { label: 'SLUG', get: (r) => r.slug },
    { label: 'STATUS', get: (r) => (r.here || r.there).status },
    { label: 'SCORE', get: (r) => (r.here?.score?.total ?? r.there?.score_total ?? '') },
    { label: 'STORED', get: (r) => (r.there ? String(r.there.updated_at).slice(0, 10) : '') },
  ])

  const counts = rows.reduce((acc, row) => ({ ...acc, [row.state]: (acc[row.state] || 0) + 1 }), {})
  log.info('')
  log.info(
    log.dim(
      Object.entries(counts)
        .map(([state, n]) => `${n} ${state}`)
        .join(', ')
    )
  )

  if (counts['local only']) log.info(log.dim('Next: htpfinder sync push'))
  if (counts['remote only']) log.info(log.dim('Next: htpfinder sync pull'))
  return 0
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

async function push({ args, slug }) {
  const client = createClient()
  const local = readLocal(slug, { mustExist: true })

  if (!local.size) {
    log.warn('No local prospects to push.')
    return 0
  }

  const remote = await readRemote(client, slug)
  const rows = compare(local, remote).filter((row) => row.here)
  let outgoing = rows.filter((row) => row.state !== 'in sync')

  const deleted = await deletedSlugs(client, outgoing.map((row) => row.slug))
  if (deleted.size && !args.force) {
    ;[...deleted].forEach((name) => log.warn(`${name} was deleted from the store, so it is skipped`))
    log.info(log.dim('Pass --force to put a deleted prospect back.'))
    outgoing = outgoing.filter((row) => !deleted.has(row.slug))
  }

  if (!outgoing.length) {
    log.ok(`${rows.length} prospect(s) already match what is stored.`)
    return 0
  }

  for (const row of outgoing) {
    const verb = deleted.has(row.slug) ? 'restore' : row.state === 'local only' ? 'create' : 'update'
    log.step(`${verb}  ${row.slug}`)
  }

  if (args['dry-run']) {
    log.info('')
    log.ok(`${outgoing.length} prospect(s) would be pushed. Nothing was written.`)
    return 0
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
      // Only reached with --force, since a deleted prospect is skipped above.
      ...(deleted.has(prospect.slug) ? { deleted_at: null } : {}),
    }))

  const written = await client.upsert(TABLE, payload, CONFLICT_TARGET)

  log.info('')
  log.ok(`${written?.length ?? payload.length} prospect(s) pushed.`)
  return 0
}

async function pull({ args, slug }) {
  const client = createClient()
  const remote = await readRemote(client, slug)

  if (!remote.size) {
    log.warn(slug ? `No stored prospect named "${slug}".` : 'Nothing stored yet.')
    return 0
  }

  const local = readLocal(slug)
  const rows = compare(local, remote).filter((row) => row.there)

  const conflicts = rows.filter((row) => row.state === 'differs')
  if (conflicts.length && !args.force) {
    conflicts.forEach((row) => log.warn(`${row.slug} differs from the stored copy`))
    log.info('')
    log.fail(
      `${conflicts.length} local file(s) would be overwritten. ` +
        'Check them with htpfinder show, then pass --force to take the stored copy.'
    )
    return 1
  }

  const incoming = rows.filter((row) => row.state !== 'in sync')
  if (!incoming.length) {
    log.ok(`${rows.length} prospect(s) already match what is stored.`)
    return 0
  }

  for (const row of incoming) {
    log.step(`${row.state === 'remote only' ? 'create' : 'overwrite'}  ${row.slug}`)
    if (args['dry-run']) continue
    writeJson(prospectFile(row.slug, 'prospect.json'), fromRow(row.there))
  }

  log.info('')
  if (args['dry-run']) {
    log.ok(`${incoming.length} prospect(s) would be pulled. Nothing was written.`)
    return 0
  }

  log.ok(`${incoming.length} prospect(s) pulled into data/prospects/.`)
  log.info(log.dim('raw.json is not stored, so a pulled prospect has no local Places response.'))
  return 0
}

async function login({ args }) {
  const client = createClient()

  if (args.signup) {
    const { userId, confirmed } = await client.signUp()
    log.ok(`Account created${userId ? ` (${userId})` : ''}.`)
    if (!confirmed) {
      log.warn('Email confirmation is on for this project. Confirm the address, then run login again.')
      return 0
    }
  }

  const { userId } = await client.signIn()
  log.ok(`Signed in as ${process.env.SUPABASE_EMAIL} (${userId}).`)

  const rows = await client.select(ACTIVE_VIEW, 'select=slug')
  log.info(log.dim(`${rows?.length ?? 0} prospect(s) visible to this account.`))
  return 0
}
