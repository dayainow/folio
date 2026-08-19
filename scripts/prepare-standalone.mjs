#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nextDir = path.join(root, '.next')
const standaloneDir = path.join(nextDir, 'standalone')

async function copyFresh(source, destination) {
  await rm(destination, { recursive: true, force: true })
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true })
}

export async function prepareStandalone() {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  await readFile(path.join(standaloneDir, 'server.js'), 'utf8').catch(() => {
    throw new Error('standalone_server_missing: run npm run build first')
  })

  await copyFresh(path.join(root, 'public'), path.join(standaloneDir, 'public'))
  await copyFresh(path.join(nextDir, 'static'), path.join(standaloneDir, '.next', 'static'))
  await writeFile(
    path.join(standaloneDir, 'release.json'),
    `${JSON.stringify({ name: packageJson.name, version: packageJson.version, next: packageJson.dependencies?.next }, null, 2)}\n`,
    'utf8',
  )

  return standaloneDir
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  prepareStandalone()
    .then((directory) => console.log(`Standalone package ready: ${path.relative(root, directory)}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
