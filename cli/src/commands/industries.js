import * as log from '../lib/log.js'
import { auditProfile, loadProfiles } from '../lib/profiles.js'
import { palettesInFamilies } from '../lib/palettes.js'

export const help = `
htpfinder industries

  Lists the industry profiles this install knows about, and any that are
  started but not yet usable.

  Add one by copying industries/_template.js. See docs/ADDING-AN-INDUSTRY.md.
`

export async function run() {
  const { profiles, incomplete } = await loadProfiles()

  if (!profiles.length && !incomplete.length) {
    log.warn('No industry profiles found in industries/.')
    log.info(log.dim('Copy industries/_template.js to get started.'))
    return 0
  }

  let warned = 0

  for (const profile of profiles) {
    const palettes = palettesInFamilies(profile.design?.paletteFamilies)
    console.log(`${log.bold(profile.id)}  ${log.dim(profile.label)}`)
    console.log(`  keywords     ${profile.places.keywords.length} search phrases`)
    console.log(
      `  qualify      rating >= ${profile.qualify.minRating}, reviews >= ${profile.qualify.minReviews}`
    )
    console.log(`  directories  ${profile.directories.length} enrichment sources`)
    console.log(`  services     ${profile.serviceTaxonomy.length} in the taxonomy`)
    console.log(
      `  palettes     ${palettes.length} across ${profile.design.paletteFamilies.length} families`
    )

    // Usable but unverified is the state worth naming. The profile loads, runs,
    // and may still be pointed at directories nobody checked.
    const warnings = await auditProfile(profile)
    warnings.forEach((warning) => console.log(`  ${log.yellow('check')}  ${warning}`))
    warned += warnings.length
    console.log('')
  }

  // A half finished profile is a normal state, not an error. Say what is left
  // to do rather than failing the whole command.
  if (incomplete.length) {
    incomplete.forEach(({ id, problems }) => {
      console.log(`${log.yellow(id)}  ${log.dim('started, not usable yet')}`)
      problems.forEach((problem) => console.log(`  ${problem}`))
      console.log('')
    })
    log.info(log.dim('See docs/ADDING-AN-INDUSTRY.md to finish one.'))
  }

  const ready = `${profiles.length} industry profile(s) ready`
  const counts = [
    incomplete.length ? `${incomplete.length} in progress` : null,
    warned ? `${warned} thing(s) to check` : null,
  ].filter(Boolean)
  log.info(log.dim(counts.length ? `${ready}, ${counts.join(', ')}.` : `${ready}.`))
  return 0
}
