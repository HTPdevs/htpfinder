import * as log from '../lib/log.js'
import { loadProfile } from '../lib/profiles.js'
import { listProspectSlugs, prospectFile, readJson } from '../lib/paths.js'
import { summarize, validateProspect } from '../lib/validate.js'

export const help = `
htpfinder validate [slug]

  Checks prospect files against their industry profile: provenance on every
  claim, verbatim only review quotes, the copy rules, valid service keys and an
  allowed palette. Validates every prospect when no slug is given.

Options
  --stage <collect|build>   How strict to be. "collect" allows missing copy.
                            Default build.
  --quiet                   Only print failures.
`

export async function run(args) {
  const slugs = args._.length ? args._ : listProspectSlugs()
  if (!slugs.length) {
    log.warn('No prospects found. Run htpfinder collect first.')
    return 0
  }

  const stage = args.stage === 'collect' ? 'collect' : 'build'
  let failed = 0
  let warned = 0

  for (const slug of slugs) {
    let prospect
    try {
      prospect = readJson(prospectFile(slug, 'prospect.json'))
    } catch {
      log.fail(`${slug}: no prospect.json`)
      failed += 1
      continue
    }

    let profile
    try {
      profile = await loadProfile(prospect.industry)
    } catch (err) {
      log.fail(`${slug}: ${err.message.split('\n')[0]}`)
      failed += 1
      continue
    }

    const problems = validateProspect(prospect, profile, { stage })
    const { errors, warnings } = summarize(problems)

    if (errors.length) {
      failed += 1
      log.fail(`${slug}`)
      errors.forEach((p) => console.log(`       ${p.path}: ${p.message}`))
      warnings.forEach((p) => console.log(log.dim(`       ${p.path}: ${p.message}`)))
    } else if (warnings.length) {
      warned += 1
      if (!args.quiet) {
        log.warn(`${slug}`)
        warnings.forEach((p) => console.log(log.dim(`       ${p.path}: ${p.message}`)))
      }
    } else if (!args.quiet) {
      log.ok(slug)
    }
  }

  console.log('')
  if (failed) {
    log.fail(`${failed} prospect(s) failed, ${warned} with warnings only.`)
    return 1
  }
  log.ok(`All ${slugs.length} prospect(s) valid${warned ? `, ${warned} with warnings` : ''}.`)
  return 0
}
