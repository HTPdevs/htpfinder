import * as log from '../lib/log.js'
import { buildProspect, BuildError } from '../lib/builder.js'

export const help = `
htpfinder build <slug>

  Turns a validated prospect.json into the renderer's site.js and theme.css,
  then optionally runs the Vite build.

Options
  --run          Also run the production build for this demo.
  --force        Write the demo files despite validation errors. Does not
                 bypass the fixture provenance guard.
  --palette <id> Override the palette instead of taking the suggested one.
`

export async function run(args) {
  const slug = args._[0]
  if (!slug) {
    log.fail('A slug is required. Try: htpfinder list')
    return 1
  }

  let result
  try {
    result = await buildProspect(slug, {
      palette: args.palette,
      force: Boolean(args.force),
      vite: Boolean(args.run),
      onProgress: ({ message }) => log.step(message),
    })
  } catch (err) {
    if (!(err instanceof BuildError)) throw err

    log.fail(err.message)
    err.problems.forEach((p) => console.log(`       ${p.path}: ${p.message}`))
    if (err.code === 'invalid') {
      log.info(log.dim('Fix the file, or pass --force to build anyway.'))
    }
    return 1
  }

  if (result.assignedPalette) {
    log.info(log.dim(`    palette: ${result.assignedPalette.id} (${result.assignedPalette.label})`))
  }
  result.warnings.forEach((p) => log.warn(`${p.path}: ${p.message}`))

  log.ok(`wrote demos/src/data/${slug}/site.js and theme.css`)

  if (!result.viteBuilt) {
    log.info(log.dim(`Next: cd demos && VITE_DEMO=${slug} npm run dev`))
  }

  return 0
}
