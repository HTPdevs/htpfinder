import * as log from '../lib/log.js'
import { enrichProspect, EnrichError } from '../lib/enrich.js'
import { listProspectSlugs, prospectFile, readJson } from '../lib/paths.js'

export const help = `
htpfinder enrich <slug>

  Writes a prospect's copy from the facts it already carries: no agent, no
  research pass, nothing invented. Every sentence comes from a sourced fact,
  and a fact that is missing means the sentence is not written at all.

  This is the floor, not the ceiling. A researched prospect with services,
  years in business and an owner name makes a much better page. Run this to
  get a whole sweep buildable, then redo the ones worth a call properly.

Options
  --all          Enrich every prospect that has no copy yet.
  --force        Replace copy that already exists. Destroys hand written copy.
  --palette <id> Assign this palette instead of the suggested one.
`

export async function run(args) {
  const slugs = args.all ? withoutCopy() : [args._[0]].filter(Boolean)

  if (!slugs.length) {
    if (args.all) {
      log.ok('Every prospect already has copy.')
      return 0
    }
    log.fail('A slug is required. Try: htpfinder list')
    return 1
  }

  let failed = 0

  for (const slug of slugs) {
    let result
    try {
      result = await enrichProspect(slug, {
        force: Boolean(args.force),
        palette: args.palette,
      })
    } catch (err) {
      if (!(err instanceof EnrichError)) throw err
      failed += 1
      log.fail(`${slug}: ${err.message}`)
      if (err.code === 'has_copy') {
        log.info(log.dim('    Use --force to replace it, or leave the research alone.'))
      }
      if (err.code === 'fixture') {
        log.info(log.dim('    Use --force to write copy anyway, for development.'))
      }
      continue
    }

    log.ok(
      `${slug}: ${result.replaced ? 'replaced' : 'wrote'} copy, palette ${result.palette.id}`
    )
    result.warnings.forEach((problem) => log.warn(`    ${problem.path}: ${problem.message}`))
    result.errors.forEach((problem) => log.fail(`    ${problem.path}: ${problem.message}`))
    if (result.errors.length) failed += 1
  }

  log.info('')
  if (failed) {
    log.warn(`${failed} of ${slugs.length} still need work before they can be built.`)
    return 1
  }
  log.info(log.dim(`Next: htpfinder build ${slugs[0]}`))
  return 0
}

/**
 * Prospects nobody has written copy for, which is what --all is for.
 *
 * Recorded sweeps are left out. They cannot be built, so enriching one only
 * spends a palette a real prospect would have had.
 */
function withoutCopy() {
  return listProspectSlugs().filter((slug) => {
    try {
      const prospect = readJson(prospectFile(slug, 'prospect.json'))
      return !prospect.copy && prospect.provenance !== 'fixture'
    } catch {
      return false
    }
  })
}
