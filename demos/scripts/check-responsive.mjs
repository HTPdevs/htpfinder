#!/usr/bin/env node
/**
 * Screenshots every built demo at the six breakpoints CLAUDE.md requires and
 * reports any horizontal overflow. Run after `node scripts/build-all.mjs`.
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

/** ES modules are blocked over file://, so the built output needs a real server. */
function serve(root) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let filePath = path.join(root, urlPath)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }
    if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
      res.writeHead(404).end('not found')
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' })
    fs.createReadStream(filePath).pipe(res)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(rootDir, 'dist')
const shotDir = path.join(rootDir, '.screenshots')

const WIDTHS = [1440, 1024, 768, 425, 375, 320]

fs.mkdirSync(shotDir, { recursive: true })

const demos = fs
  .readdirSync(distDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()

const { server, port } = await serve(distDir)

// Use a preinstalled Chromium when one is present (CI images often pin a
// different build number than the local Playwright package expects).
const pinned = process.env.CHROMIUM_PATH
const browser = await chromium.launch(pinned ? { executablePath: pinned } : {})
let problems = 0

for (const demo of demos) {
  const file = `http://127.0.0.1:${port}/${demo}/index.html`

  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', (err) => errors.push(String(err)))

    await page.goto(file, { waitUntil: 'networkidle' })
    // Let scroll-reveal settle so screenshots aren't full of invisible sections.
    await page.evaluate(() =>
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'))
    )
    await page.waitForTimeout(250)

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement
      const offenders = []
      const limit = doc.clientWidth + 1
      document.querySelectorAll('body *').forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0) return
        if (rect.right > limit || rect.left < -1) {
          offenders.push(
            `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]} (${Math.round(rect.left)}→${Math.round(rect.right)})`
          )
        }
      })
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        // Guards against a "clean" pass on a page that rendered nothing.
        mounted: (document.getElementById('root')?.children.length || 0) > 0,
        textLength: (document.body.innerText || '').trim().length,
        offenders: offenders.slice(0, 5),
      }
    })

    const overflow = metrics.scrollWidth > metrics.clientWidth + 1
    const blank = !metrics.mounted || metrics.textLength < 400
    const failed = overflow || blank || errors.length > 0
    const status = failed ? 'FAIL' : 'ok'
    if (failed) problems += 1

    console.log(
      `${status.padEnd(4)} ${demo} @ ${String(width).padStart(4)}px  ` +
        `scrollW=${metrics.scrollWidth} clientW=${metrics.clientWidth} chars=${metrics.textLength}` +
        (blank ? '\n       page did not render' : '') +
        (metrics.offenders.length ? `\n       overflow: ${metrics.offenders.join(', ')}` : '') +
        (errors.length ? `\n       js errors: ${errors.join(' | ')}` : '')
    )

    await page.screenshot({
      path: path.join(shotDir, `${demo}-${width}.png`),
      fullPage: width === 1440 || width === 375,
    })
    await page.close()
  }
}

await browser.close()
server.close()
console.log(problems ? `\n${problems} breakpoint(s) need attention.` : '\nAll breakpoints clean.')
process.exit(problems ? 1 : 0)
