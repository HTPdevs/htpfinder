#!/usr/bin/env node
/**
 * Enforces the copy rules from CLAUDE.md against the built pages.
 *
 *   1. No dashes of any kind in rendered text.
 *   2. None of the banned AI words.
 *
 * Runs against dist/ so it checks what a prospect actually sees, not what
 * the source happens to contain.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(rootDir, 'dist')

// Hyphen, non breaking hyphen, figure dash, en dash, em dash, horizontal bar,
// minus sign. Built from code points so a find and replace pass over this repo
// can never quietly empty the character class.
const DASHES = new RegExp(
  '[' + [0x2d, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212].map((c) => String.fromCharCode(c)).join('') + ']'
)
/**
 * The no dashes rule governs authored prose. A phone number's separator is
 * data formatting that customers expect to see, so those are stripped before
 * the check rather than reformatted into something unrecognisable.
 */
const PHONE = /\(?\d{3}\)?[\s.]?\d{3}-\d{4}/g
const BANNED = [
  'delve',
  'tapestry',
  'pivotal',
  'realm',
  'underscore',
  'multifaceted',
  'nuanced',
  'harness',
  'elevate',
  'resonate',
]

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }

function serve(root) {
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end('nf')
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' })
    fs.createReadStream(p).pipe(res)
  })
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  )
}

const demos = fs
  .readdirSync(distDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

const { server, port } = await serve(distDir)
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
)

let failures = 0

for (const demo of demos) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`http://127.0.0.1:${port}/${demo}/index.html`, { waitUntil: 'networkidle' })

  const text = await page.evaluate(() => document.body.innerText)
  const title = await page.title()
  const haystack = `${title}\n${text}`.replace(PHONE, 'PHONE')

  const dashLines = haystack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => DASHES.test(line))

  const banned = BANNED.filter((word) => new RegExp(`\\b${word}`, 'i').test(haystack))

  if (dashLines.length || banned.length) {
    failures += 1
    console.log(`FAIL ${demo}`)
    dashLines.forEach((line) => console.log(`     dash: ${line}`))
    banned.forEach((word) => console.log(`     banned word: ${word}`))
  } else {
    console.log(`ok   ${demo}  (no dashes, no banned words)`)
  }

  await page.close()
}

await browser.close()
server.close()
console.log(failures ? `\n${failures} page(s) violate the copy rules.` : '\nCopy rules clean.')
process.exit(failures ? 1 : 0)
