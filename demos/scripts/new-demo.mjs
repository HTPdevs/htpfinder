#!/usr/bin/env node
/**
 * Scaffolds a new prospect demo from an existing one.
 *
 *   npm run new -- <new-slug> [--from <existing-slug>]
 *
 * Copies site.js + theme.css into src/data/<new-slug>/ with the business
 * name and hue rotated, so a new prospect is a fill-in-the-blanks edit
 * rather than a fresh build.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const demosDir = path.join(rootDir, 'src/data')

const args = process.argv.slice(2)
const slug = args.find((a) => !a.startsWith('--'))
const fromIndex = args.indexOf('--from')
const from = fromIndex > -1 ? args[fromIndex + 1] : null

if (!slug) {
  console.error('Usage: npm run new -- <new-slug> [--from <existing-slug>]')
  process.exit(1)
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error(`"${slug}" is not a valid slug  use lowercase words separated by hyphens.`)
  process.exit(1)
}

const existing = fs
  .readdirSync(demosDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

const source = from || existing[0]
if (!existing.includes(source)) {
  console.error(`Unknown source demo "${source}". Available: ${existing.join(', ')}`)
  process.exit(1)
}

const target = path.join(demosDir, slug)
if (fs.existsSync(target)) {
  console.error(`src/data/${slug} already exists. Pick a different slug.`)
  process.exit(1)
}

const titleCase = slug
  .split('-')
  .map((word) => word[0].toUpperCase() + word.slice(1))
  .join(' ')

fs.mkdirSync(target, { recursive: true })

for (const file of ['site.js', 'theme.css']) {
  let contents = fs.readFileSync(path.join(demosDir, source, file), 'utf8')
  if (file === 'site.js') {
    contents = contents.replace(`slug: '${source}'`, `slug: '${slug}'`)
  }
  contents =
    `/* TODO(${slug}): copied from ${source}. Replace every fact below with\n` +
    `   researched, publicly sourced detail for ${titleCase}, and give this\n` +
    `   demo its own hue so no two prospects see the same palette. */\n` +
    contents
  fs.writeFileSync(path.join(target, file), contents)
}

console.log(`✓ src/data/${slug}/ created from ${source}

Next:
  1. Replace the facts in src/data/${slug}/site.js (sourcing rule applies).
  2. Pick a distinct hue in src/data/${slug}/theme.css.
  3. VITE_DEMO=${slug} npm run dev`)
