import * as log from '../lib/log.js'
import { prospectFile, readJson } from '../lib/paths.js'

export const help = `
htpfinder show <slug>

  Prints one prospect: what is known, where each claim came from, what is
  still unresolved, and how it scored.

Options
  --json    Print the raw prospect file instead.
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

  if (args.json) {
    console.log(JSON.stringify(prospect, null, 2))
    return 0
  }

  const facts = prospect.facts || {}
  console.log(`${log.bold(facts.name?.value || slug)}  ${log.dim(`(${slug})`)}`)
  console.log(
    log.dim(
      `${prospect.industry} | ${prospect.status} | score ${prospect.score?.total ?? 'not scored'}`
    )
  )
  console.log('')

  if (prospect.website) {
    console.log(`${log.bold('Website')}  ${prospect.website.status}: ${prospect.website.reason}`)
    if (prospect.website.uncertain) {
      console.log(log.yellow('  this check was inconclusive, confirm before outreach'))
    }
    console.log('')
  }

  console.log(log.bold('Facts'))
  showFact('Phone', facts.phone)
  showFact('Address', facts.address)
  showFact('Hours', facts.hours)
  showFact('Years in business', facts.yearsInBusiness)
  showFact('Crew size', facts.crewSize)
  showFact('Owner', facts.ownerName)
  showFact('Payment methods', facts.paymentMethods)
  showFact('Free estimates', facts.freeEstimates)
  showFact('Languages', facts.languages)
  showFact('Certifications', facts.certifications)
  showFact('Service area', facts.serviceArea)

  if (facts.ratings?.length) {
    facts.ratings.forEach((r) =>
      console.log(`  ${'Rating'.padEnd(20)} ${r.score} from ${r.count} on ${r.source}`)
    )
  }
  if (facts.services?.length) {
    console.log(`  ${'Services'.padEnd(20)} ${facts.services.map((s) => s.key).join(', ')}`)
  }
  console.log(`  ${'Review quotes'.padEnd(20)} ${facts.reviewQuotes?.length || 0} verbatim`)
  console.log('')

  if (prospect.unresolved?.length) {
    console.log(log.bold('Unresolved, raise these on the call'))
    prospect.unresolved.forEach((item) => console.log(`  ${item}`))
    console.log('')
  }

  if (prospect.score?.reasons?.length) {
    console.log(log.bold('Score'))
    prospect.score.reasons.forEach((reason) => console.log(`  ${reason}`))
    console.log('')
  }

  console.log(log.dim(prospect.copy ? 'Copy written.' : 'No copy yet. Run htpfinder packet ' + slug))
  return 0
}

function showFact(label, value) {
  if (!value) {
    console.log(`  ${label.padEnd(20)} ${log.dim('not found')}`)
    return
  }
  const printed = Array.isArray(value.value) ? value.value.join(', ') : String(value.value)
  console.log(`  ${label.padEnd(20)} ${printed}`)
  if (value.source) console.log(`  ${''.padEnd(20)} ${log.dim(value.source)}`)
}
