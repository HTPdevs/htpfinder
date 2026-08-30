#!/usr/bin/env node
/**
 * Builds every demo under src/data.
 *
 *   node scripts/build-all.mjs          -> dist/<slug>/     (deployable)
 *   node scripts/build-all.mjs --single -> preview/<slug>/  (one inlined .html)
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const demosDir = path.join(rootDir, 'src/data')
const single = process.argv.includes('--single')

const demos = fs
  .readdirSync(demosDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

if (!demos.length) {
  console.error('No demos found in src/data.')
  process.exit(1)
}

for (const demo of demos) {
  console.log(`\n▸ building ${demo}${single ? ' (single file)' : ''}`)
  execFileSync('npx', ['vite', 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEMO: demo, SINGLE_FILE: single ? '1' : '' },
  })
}

console.log(`\n✓ ${demos.length} demo${demos.length === 1 ? '' : 's'} built.`)
