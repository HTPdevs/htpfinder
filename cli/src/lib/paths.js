import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const CLI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
/** apps/htpfinder */
export const APP_ROOT = path.resolve(CLI_ROOT, '..')
export const DEMOS_ROOT = path.join(APP_ROOT, 'demos')
export const DATA_ROOT = path.join(APP_ROOT, 'data')
export const PROSPECTS_ROOT = path.join(DATA_ROOT, 'prospects')
export const INDUSTRIES_ROOT = path.join(CLI_ROOT, 'industries')
export const FIXTURES_ROOT = path.join(CLI_ROOT, 'fixtures')

export function prospectDir(slug) {
  return path.join(PROSPECTS_ROOT, slug)
}

export function prospectFile(slug, name) {
  return path.join(prospectDir(slug), name)
}

export function demoDataDir(slug) {
  return path.join(DEMOS_ROOT, 'src/data', slug)
}

/** Where a finished demo site lands, one directory per prospect. */
export const DEMOS_DIST = path.join(DEMOS_ROOT, 'dist')

export function demoDistDir(slug) {
  return path.join(DEMOS_DIST, slug)
}

/** True once `htpfinder build <slug> --run` has produced a page to open. */
export function isDemoBuilt(slug) {
  return fs.existsSync(path.join(demoDistDir(slug), 'index.html'))
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function readJson(file, fallback = undefined) {
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback
    throw new Error(`Missing file: ${file}`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  return file
}

export function listProspectSlugs() {
  if (!fs.existsSync(PROSPECTS_ROOT)) return []
  return fs
    .readdirSync(PROSPECTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}
