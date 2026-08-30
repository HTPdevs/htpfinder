#!/usr/bin/env node
/**
 * Converts a single-file Vite build into an artifact-ready fragment.
 *
 * The Artifact host supplies its own <!doctype>/<html>/<head>/<body>, so a
 * complete document would nest. This lifts the title, the Google Fonts link,
 * the inlined <style> and the body contents into a flat fragment.
 *
 *   node scripts/make-artifact.mjs   ->  artifact/<slug>.html
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const previewDir = path.join(rootDir, 'preview')
const outDir = path.join(rootDir, 'artifact')

fs.mkdirSync(outDir, { recursive: true })

const demos = fs
  .readdirSync(previewDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

for (const demo of demos) {
  const html = fs.readFileSync(path.join(previewDir, demo, 'index.html'), 'utf8')

  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? demo
  const fontLinks = [...html.matchAll(/<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>/g)].map(
    (m) => m[0]
  )
  const styles = [...html.matchAll(/<style[\s\S]*?<\/style>/g)].map((m) => m[0])
  // vite-plugin-singlefile hoists the bundled script into <head>, so scripts
  // have to be collected document-wide and re-emitted after #root exists.
  const scripts = [...html.matchAll(/<script[\s\S]*?<\/script>/g)].map((m) => m[0])
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? ''

  if (!body.trim()) {
    throw new Error(`No <body> content found for ${demo}. Did the single file build run?`)
  }
  if (!scripts.length) {
    throw new Error(`No <script> found for ${demo}. The fragment would render blank.`)
  }

  const fragment = [
    `<title>${title}</title>`,
    ...fontLinks,
    ...styles,
    body.trim(),
    ...scripts,
    '',
  ].join('\n')

  const outFile = path.join(outDir, `${demo}.html`)
  fs.writeFileSync(outFile, fragment)
  console.log(`✓ ${path.relative(rootDir, outFile)}  (${(fragment.length / 1024).toFixed(0)} kB)`)
}
