import * as log from '../lib/log.js'
import { syncPull, syncPush, syncStatus, SyncConflictError } from '../lib/sync.js'
import { createClient, NotConfiguredError, SupabaseError } from '../lib/supabase.js'
import { ACTIVE_VIEW } from '../lib/store.js'

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
    if (err instanceof SyncConflictError) {
      err.slugs.forEach((name) => log.warn(`${name} differs from the stored copy`))
      log.info('')
      log.fail(
        `${err.slugs.length} local file(s) would be overwritten. ` +
          'Check them with htpfinder show, then pass --force to take the stored copy.'
      )
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

async function status({ slug }) {
  const rows = await syncStatus(slug)

  if (!rows.length) {
    log.warn('Nothing here and nothing stored. Run htpfinder collect to find some.')
    return 0
  }

  log.table(rows, [
    { label: 'STATE', get: (r) => r.state },
    { label: 'SLUG', get: (r) => r.slug },
    { label: 'STATUS', get: (r) => r.status },
    { label: 'SCORE', get: (r) => r.score ?? '' },
    { label: 'STORED', get: (r) => (r.storedAt ? String(r.storedAt).slice(0, 10) : '') },
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

async function push({ args, slug }) {
  const result = await syncPush({
    slug,
    force: Boolean(args.force),
    dryRun: Boolean(args['dry-run']),
  })

  result.skipped.forEach((name) =>
    log.warn(`${name} was deleted from the store, so it is skipped`)
  )
  if (result.skipped.length) log.info(log.dim('Pass --force to put a deleted prospect back.'))

  if (!result.pushed.length) {
    log.ok(`${result.alreadyInSync} prospect(s) already match what is stored.`)
    return 0
  }

  result.pushed.forEach((row) => log.step(`${row.action}  ${row.slug}`))
  log.info('')
  log.ok(
    `${result.pushed.length} prospect(s) ${result.dryRun ? 'would be pushed. Nothing was written.' : 'pushed.'}`
  )
  return 0
}

async function pull({ args, slug }) {
  const result = await syncPull({
    slug,
    force: Boolean(args.force),
    dryRun: Boolean(args['dry-run']),
  })

  if (!result.pulled.length) {
    log.ok(`${result.alreadyInSync} prospect(s) already match what is stored.`)
    return 0
  }

  result.pulled.forEach((row) => log.step(`${row.action}  ${row.slug}`))
  log.info('')
  log.ok(
    `${result.pulled.length} prospect(s) ${result.dryRun ? 'would be pulled. Nothing was written.' : 'pulled into data/prospects/.'}`
  )
  if (!result.dryRun) {
    log.info(log.dim('raw.json is not stored, so a pulled prospect has no local Places response.'))
  }
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
