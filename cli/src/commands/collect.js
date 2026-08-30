import * as log from '../lib/log.js'
import { collect, CollectError } from '../lib/collector.js'
import { MissingApiKeyError } from '../lib/places.js'

export const help = `
htpfinder collect <industry> --near "<place>" [options]

  Sweeps Google Places for businesses in an industry, keeps the ones without a
  real website, and writes a collected prospect file for each.

Options
  --near <place>     Required. Any place string Google understands.
  --limit <n>        Max places to consider. Default 60.
  --fixture <file>   Read recorded Places results instead of calling the API.
                     Useful offline, and for testing without spending quota.
  --keep-live        Also record businesses that already have a working site.
  --no-check         Skip the fetch that detects parked and broken domains.
  --dry-run          Print what would be written without writing anything.
`

export async function run(args) {
  let result
  try {
    result = await collect({
      industry: args._[0],
      near: args.near,
      limit: Number(args.limit) || 60,
      fixture: args.fixture,
      keepLive: Boolean(args['keep-live']),
      check: !args['no-check'],
      dryRun: Boolean(args['dry-run']),
      onProgress: ({ message }) => log.step(message),
    })
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      log.fail(err.message)
      return 1
    }
    if (err instanceof CollectError) {
      log.fail(err.message)
      if (err.code === 'no_industry') log.info(log.dim('Try: htpfinder industries'))
      if (err.code === 'no_near') log.info(log.dim('For example --near "Portland, OR"'))
      return 1
    }
    throw err
  }

  if (result.closed) log.info(log.dim(`    skipped ${result.closed} closed or moved`))

  log.info('')
  log.table(result.kept, [
    { label: 'SCORE', get: (r) => r.score?.total ?? '' },
    { label: 'SLUG', get: (r) => r.slug },
    { label: 'REVIEWS', get: (r) => r.place.reviewCount },
    { label: 'RATING', get: (r) => r.place.rating ?? '' },
    { label: 'PHONE', get: (r) => (r.place.phone ? 'yes' : 'no') },
    { label: 'WHY', get: (r) => r.website.reason },
  ])

  log.info('')
  const uncertain = result.kept.filter((r) => r.website.uncertain)
  if (uncertain.length) {
    log.warn(
      `${uncertain.length} site check(s) were inconclusive, so those may still have a live site. ` +
        'Confirm before outreach.'
    )
  }
  log.ok(
    `${result.kept.length} prospect${result.kept.length === 1 ? '' : 's'} ` +
      `${result.dryRun ? 'would be written' : 'written'}, ` +
      `${result.skipped.length} skipped for having a working site.`
  )
  if (!result.dryRun && result.kept.length) {
    log.info(log.dim('Next: htpfinder packet <slug> to prepare the enrichment step.'))
  }
  return 0
}
