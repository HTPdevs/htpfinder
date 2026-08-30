import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The build lands in ui/dist, which is what `htpfinder ui` serves.
 *
 * The dev server proxies /api to that same command running on 4317, so
 * `npm run dev` here gives hot reload against the real backend rather than a
 * mock. Start `htpfinder ui --no-open` alongside it.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4318,
    proxy: { '/api': 'http://localhost:4317' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
