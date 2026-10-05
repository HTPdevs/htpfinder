import path from 'node:path'
import fs from 'node:fs'

import * as log from '../lib/log.js'
import { DATA_ROOT, ensureDir, writeJson } from '../lib/paths.js'
import { InboxError, estimateSearchCost, findLeads, SEARCH_ENDPOINT } from '../lib/inbox.js'
import { TregError, TregNotInstalledError, tregBalance } from '../lib/treg.js'
import { listVerticalIds, loadVertical } from '../lib/verticals.js'
import { slugify } from '../lib/slug.js'

export const help = `
htpfinder inbox <vertical> --near "<place>" [options]

  Finds businesses whose customer messages are spread across more channels than
  they can answer from one place, and ranks them for the one inbox offer.

  Every search costs money from the treg team balance. The sweep prints what it
  spent and refuses to start a run that would cost more than --max-spend.

Verticals
  ${listVerticalIds().join(', ')}

Options
  --near <place>       Where to look. The provider ignores location, so results
                       are filtered locally and the drop count is reported.
  --limit <n>          Businesses to consider. Default 30.
  --min-score <n>      Drop leads scoring below this. Default 0.
  --max-spend <usd>    Refuse to start above this projected cost. Default 0.35.
  --no-inspect         Skip the homepage fetch. Faster, and much less useful,
                       since the vendor tier is most of the score.
  --csv <file>         Also write a spreadsheet of the ranked leads.
  --estimate           Print the projected cost and exit without calling.
`

function toCsv(leads) {
  const columns = [
    ['score', (lead) => lead.score.total],
    ['pitch', (lead) => lead.pitch],
    ['name', (lead) => lead.business.name],
    ['website', (lead) => lead.business.website],
    ['city', (lead) => lead.business.city],
    ['state', (lead) => lead.business.state],
    ['phone', (lead) => lead.business.phone],
    ['email', (lead) => lead.business.email],
    ['reviews', (lead) => lead.business.reviewCount],
    ['rating', (lead) => lead.business.rating],
    ['staff_named', (lead) => lead.business.staffNamed],
    ['vendors', (lead) => lead.site.vendors.map((v) => v.label).join(' | ')],
    ['channels', (lead) => lead.score.channels.join(' | ')],
    ['instagram', (lead) => lead.business.socials.instagram || ''],
    ['facebook', (lead) => lead.business.socials.facebook || ''],
    ['why', (lead) => lead.score.reasons.join(' | ')],
  ]

  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const lines = [columns.map(([label]) => label).join(',')]
  leads.forEach((lead) => lines.push(columns.map(([, get]) => escape(get(lead))).join(',')))
  return `${lines.join('\n')}\n`
}

export async function run(args) {
  const vertical = args._[0]
  const near = typeof args.near === 'string' ? args.near : null
  const limit = Number(args.limit) || 30
  const minScore = Number(args['min-score']) || 0
  const maxSpend = args['max-spend'] === undefined ? 0.35 : Number(args['max-spend'])

  if (!vertical) {
    log.fail('Pick a vertical.')
    log.info(log.dim(`Available: ${listVerticalIds().join(', ')}`))
    return 1
  }

  // The sweep runs one search per keyword, and the provider rounds each one up
  // to a whole credit, so the projection is per query rather than per row.
  let keywords
  try {
    keywords = loadVertical(vertical).search.length
  } catch (err) {
    log.fail(err.message)
    return 1
  }
  const perQuery = Math.max(1, Math.ceil(limit / keywords))
  const projected = keywords * estimateSearchCost(perQuery)
  log.info(
    log.dim(
      `${SEARCH_ENDPOINT} rounds up per call, so ${keywords} keyword(s) at ${perQuery} rows each ` +
        `projects to $${projected.toFixed(3)}.`
    )
  )

  if (args.estimate) return 0

  if (projected > maxSpend) {
    log.fail(
      `That run projects to $${projected.toFixed(3)}, above the $${maxSpend.toFixed(2)} ceiling.\n` +
        'Lower --limit, or raise --max-spend if the spend is intended.'
    )
    return 1
  }

  const balance = await tregBalance()
  if (balance !== null && balance < projected) {
    log.fail(
      `The treg balance is $${balance.toFixed(4)} and this run needs about $${projected.toFixed(3)}.\n` +
        'Top it up with:  treg topup'
    )
    return 1
  }

  let result
  try {
    result = await findLeads({
      vertical,
      near,
      limit,
      minScore,
      inspect: !args['no-inspect'],
      onProgress: ({ message }) => log.step(message),
    })
  } catch (err) {
    if (err instanceof TregNotInstalledError || err instanceof TregError) {
      log.fail(err.message)
      return 1
    }
    if (err instanceof InboxError || /Unknown vertical/.test(err.message)) {
      log.fail(err.message)
      return 1
    }
    throw err
  }

  log.info('')
  log.table(result.leads, [
    { label: 'SCORE', get: (lead) => lead.score.total },
    { label: 'PITCH', get: (lead) => lead.pitch },
    { label: 'NAME', get: (lead) => (lead.business.name || '').slice(0, 30) },
    { label: 'WHERE', get: (lead) => [lead.business.city, lead.business.state].filter(Boolean).join(', ') },
    { label: 'REVIEWS', get: (lead) => lead.business.reviewCount },
    { label: 'CHANNELS', get: (lead) => lead.score.channels.length },
    { label: 'RUNNING', get: (lead) => lead.site.vendors.map((v) => v.label).join(', ') || 'nothing found' },
  ])
  log.info('')

  const stamp = new Date().toISOString().slice(0, 10)
  const name = [vertical, near ? slugify(near) : 'anywhere', stamp].filter(Boolean).join('-')
  const outDir = ensureDir(path.join(DATA_ROOT, 'inbox'))
  const jsonFile = writeJson(path.join(outDir, `${name}.json`), {
    vertical: result.vertical.id,
    near: result.near,
    ranAt: new Date().toISOString(),
    cost: result.cost,
    leads: result.leads,
    skipped: result.skipped,
  })
  log.ok(`${result.leads.length} lead(s) written to ${path.relative(process.cwd(), jsonFile)}`)

  if (args.csv) {
    const csvFile = path.resolve(String(args.csv))
    ensureDir(path.dirname(csvFile))
    fs.writeFileSync(csvFile, toCsv(result.leads))
    log.ok(`Spreadsheet written to ${path.relative(process.cwd(), csvFile)}`)
  }

  const unsure = result.leads.filter((lead) => lead.site.uncertain)
  if (unsure.length) {
    log.warn(
      `${unsure.length} site check(s) found no vendor in the homepage HTML. A widget injected by ` +
        'a tag manager would not show up there, so confirm before treating those as greenfield.'
    )
  }
  if (result.skipped.length) {
    log.info(log.dim(`    ${result.skipped.length} skipped, see the json for why`))
  }
  log.info(log.dim(`    spent $${result.cost.toFixed(4)} on this run`))
  log.info('')
  log.info(
    log.dim(
      'Headcount comes from names on the business website, which is a floor and not a headcount.\n' +
        'Confirm the band on a shortlist with:  treg call treg.companies.enrich --method POST --data \'{"domain":"example.com"}\''
    )
  )
  return 0
}
