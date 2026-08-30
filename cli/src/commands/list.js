import * as log from '../lib/log.js'
import { listProspectSlugs, prospectFile, readJson } from '../lib/paths.js'

export const help = `
htpfinder list

  Shows every prospect with its status, score and industry.

Options
  --status <status>     Only show prospects in this status.
  --industry <id>       Only show prospects in this industry.
  --min-score <n>       Only show prospects at or above this score.
`

export async function run(args) {
  const rows = listProspectSlugs()
    .map((slug) => {
      try {
        return readJson(prospectFile(slug, 'prospect.json'))
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .filter((p) => !args.status || p.status === args.status)
    .filter((p) => !args.industry || p.industry === args.industry)
    .filter((p) => !args['min-score'] || (p.score?.total ?? 0) >= Number(args['min-score']))
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))

  if (!rows.length) {
    log.warn('No prospects match. Run htpfinder collect to find some.')
    return 0
  }

  log.table(rows, [
    { label: 'SCORE', get: (p) => p.score?.total ?? '' },
    { label: 'SLUG', get: (p) => p.slug },
    { label: 'INDUSTRY', get: (p) => p.industry },
    { label: 'STATUS', get: (p) => p.status },
    { label: 'PHONE', get: (p) => (p.facts?.phone ? 'yes' : 'no') },
    { label: 'QUOTES', get: (p) => p.facts?.reviewQuotes?.length ?? 0 },
    { label: 'NAME', get: (p) => p.facts?.name?.value ?? '' },
  ])
  console.log('')
  log.info(log.dim(`${rows.length} prospect(s).`))
  return 0
}
