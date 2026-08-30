import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { DEMOS_ROOT } from './paths.js'

/**
 * The vocabularies a profile is allowed to draw on, read out of the renderer
 * rather than restated here.
 *
 * A profile that names a motif, mark or icon the renderer does not implement
 * does not crash. It falls back to a leaf, or a plain hero, on somebody's demo
 * page. That is the quietest possible failure, so the brief that gets handed to
 * whoever writes a profile has to carry the real list, and a stale copy of the
 * list in a second file would defect from the renderer within a release.
 *
 * Everything here is lazy on purpose. `demos/` is a sibling package, and one
 * command needing it should not stop `htpfinder list` from running if it is
 * missing.
 */

const ICON_NAMES_FILE = path.join(DEMOS_ROOT, 'src/lib/icon-names.js')
const CSS_FILE = path.join(DEMOS_ROOT, 'src/styles/index.css')
const BRAND_MARK_FILE = path.join(DEMOS_ROOT, 'src/components/BrandMark.jsx')

export async function listIcons() {
  if (!fs.existsSync(ICON_NAMES_FILE)) return []
  const module = await import(pathToFileURL(ICON_NAMES_FILE).href)
  return [...(module.ICON_NAMES || [])]
}

/** Hero textures, declared as `.motif-*` rules in the renderer stylesheet. */
export function listMotifs() {
  const css = read(CSS_FILE)
  return unique([...css.matchAll(/\.motif-([a-z0-9-]+)\s*\{/g)].map((match) => match[1]))
}

/** Header marks, the keys of the MARKS map in BrandMark.jsx. */
export function listMarks() {
  const jsx = read(BRAND_MARK_FILE)
  const block = jsx.match(/const MARKS\s*=\s*\{([\s\S]*?)\n\}/)
  if (!block) return []
  return unique([...block[1].matchAll(/^ {2}([a-zA-Z0-9-]+):/gm)].map((match) => match[1]))
}

export async function rendererVocabulary() {
  return {
    icons: await listIcons(),
    motifs: listMotifs(),
    marks: listMarks(),
  }
}

function read(file) {
  if (!fs.existsSync(file)) return ''
  return fs.readFileSync(file, 'utf8')
}

function unique(values) {
  return [...new Set(values)].sort()
}
