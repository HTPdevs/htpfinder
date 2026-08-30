import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const demosDir = path.resolve(rootDir, 'src/data')

/**
 * Which prospect are we building?
 *   npm run dev                                 -> first demo alphabetically
 *   VITE_DEMO=new-green-landscaping npm run build
 *
 * Everything demo-specific resolves through the `@demo` alias, so the shared
 * layout under src/ never imports a business by name.
 */
function resolveDemo() {
  const available = fs
    .readdirSync(demosDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(demosDir, entry.name, 'site.js')))
    .map((entry) => entry.name)
    .sort()

  const requested = process.env.VITE_DEMO || available[0]

  if (!available.includes(requested)) {
    throw new Error(
      `Unknown demo "${requested}". Available: ${available.join(', ')}\n` +
        `Usage: VITE_DEMO=<slug> npm run build`
    )
  }
  return requested
}

export default defineConfig(async () => {
  const demo = resolveDemo()
  const demoDir = path.join(demosDir, demo)
  const site = (await import(pathToFileURL(path.join(demoDir, 'site.js')).href)).default
  const singleFile = process.env.SINGLE_FILE === '1'

  return {
    // Relative base so a dist/ folder can be dropped into any subdirectory
    // on Hostinger/Cloudflare without a rebuild.
    base: './',
    plugins: [
      react(),
      {
        name: 'htpfinder-demo-html',
        transformIndexHtml(html) {
          return html
            .replace(/%DEMO_TITLE%/g, site.seo.title)
            .replace(/%DEMO_DESCRIPTION%/g, site.seo.description)
            .replace(/%DEMO_THEME_COLOR%/g, site.seo.themeColor)
        },
      },
      ...(singleFile ? [viteSingleFile()] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
        '@demo': demoDir,
      },
    },
    build: {
      outDir: singleFile ? `preview/${demo}` : `dist/${demo}`,
      emptyOutDir: true,
    },
  }
})
