import fs from 'node:fs'
import { execFile } from 'node:child_process'

import * as log from '../lib/log.js'
import { loadEnv } from '../lib/env.js'
import { createServer, UI_DIST } from '../server/http.js'
import { routes } from '../server/routes.js'

export const help = `
htpfinder ui

  Starts the local control panel and opens it in your browser. Everything the
  CLI can do is in here, running the same code underneath.

  The server binds to the loopback address only. It is not reachable from
  anywhere else on the network, which is why it needs no login of its own.

Options
  --port <n>     Port to listen on. Default 4317.
  --no-open      Start the server without opening a browser.
`

const DEFAULT_PORT = 4317

export async function run(args) {
  loadEnv()

  const server = createServer(routes())
  const port = Number(args.port) || DEFAULT_PORT

  // Loopback only, and stated in the help. A server that writes files, spends
  // Places quota and holds a Supabase session has no business listening on a
  // network interface.
  await new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Try: htpfinder ui --port ${port + 1}`))
      } else reject(err)
    })
    server.listen(port, '127.0.0.1', resolve)
  })

  const url = `http://localhost:${port}`
  log.ok(`htpfinder running at ${url}`)

  if (!fs.existsSync(UI_DIST)) {
    log.warn('The UI has not been built yet. Run: cd ui && npm install && npm run build')
  } else if (!args['no-open']) {
    open(url)
  }

  log.info(log.dim('Ctrl+C to stop.'))

  // Resolves only on shutdown, so the command holds the process open.
  await new Promise((resolve) => {
    process.on('SIGINT', () => {
      log.info('')
      log.info(log.dim('stopped'))
      server.close(() => resolve())
      resolve()
    })
  })

  return 0
}

function open(url) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  execFile(command, [url], (err) => {
    if (err) log.info(log.dim(`Open ${url} in your browser.`))
  })
}
