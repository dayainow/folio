#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'

import { prepareStandalone } from './prepare-standalone.mjs'

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const standaloneDir = await prepareStandalone()
const child = spawn(process.execPath, [path.join(standaloneDir, 'server.js')], {
  cwd: standaloneDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: option('--hostname', process.env.FOLIO_HOSTNAME || '127.0.0.1'),
    PORT: option('--port', process.env.PORT || '3000'),
  },
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', (error) => {
  console.error(`standalone_start_failed: ${error.message}`)
  process.exit(1)
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
