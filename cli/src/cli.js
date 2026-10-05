import * as log from './lib/log.js'

import * as build from './commands/build.js'
import * as collect from './commands/collect.js'
import * as enrich from './commands/enrich.js'
import * as inbox from './commands/inbox.js'
import * as industries from './commands/industries.js'
import * as list from './commands/list.js'
import * as packet from './commands/packet.js'
import * as profile from './commands/profile.js'
import * as show from './commands/show.js'
import * as sync from './commands/sync.js'
import * as ui from './commands/ui.js'
import * as validate from './commands/validate.js'

const COMMANDS = {
  ui,
  industries,
  profile,
  collect,
  inbox,
  list,
  show,
  packet,
  enrich,
  validate,
  build,
  sync,
}

const USAGE = `
htpfinder

  Finds local businesses without a website, turns public data into a validated
  prospect file, and builds a demo site from it.

Commands
  ui                      Open the local control panel in a browser
  industries              List the industry profiles available
  profile <industry>      Print the research brief for a trade we do not cover
  collect <industry>      Sweep Places for prospects without a website
  inbox <vertical>        Rank businesses whose messages are spread across channels
  list                    Show collected prospects
  show <slug>             Show one prospect and its sources
  packet <slug>           Print the enrichment brief for the research step
  enrich <slug>           Write copy from the facts already collected
  validate [slug]         Check prospects against the schema and copy rules
  build <slug>            Generate the demo site files from a prospect
  sync <push|pull>        Move prospects between files and Supabase

Run a command with --help for its options.
`

/** Minimal flag parser. No dependency earns its place for this. */
export function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      args._.push(token)
      continue
    }
    const key = token.slice(2)
    if (key.includes('=')) {
      const [name, ...rest] = key.split('=')
      args[name] = rest.join('=')
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i += 1
    }
  }
  return args
}

export async function main(argv) {
  const [name, ...rest] = argv
  if (!name || name === 'help' || name === '--help' || name === '-h') {
    console.log(USAGE)
    return 0
  }

  const command = COMMANDS[name]
  if (!command) {
    log.fail(`Unknown command "${name}".`)
    console.log(USAGE)
    return 1
  }

  const args = parseArgs(rest)
  if (args.help) {
    console.log(command.help.trim())
    return 0
  }

  try {
    return (await command.run(args)) ?? 0
  } catch (err) {
    log.fail(err.message)
    if (process.env.HTPFINDER_DEBUG) console.error(err)
    return 1
  }
}
