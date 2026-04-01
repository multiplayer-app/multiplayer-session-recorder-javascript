#!/usr/bin/env node
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const BINARIES = {
  'darwin-arm64': 'multiplayer-darwin-arm64',
  'darwin-x64':   'multiplayer-darwin-x64',
  'linux-x64':    'multiplayer-linux-x64',
  'linux-arm64':  'multiplayer-linux-arm64',
}

const key = `${process.platform}-${process.arch}`
const binary = BINARIES[key]

if (!binary) {
  process.stderr.write(`Unsupported platform: ${key}\n`)
  process.exit(1)
}

const binPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', binary)

execFileSync(binPath, process.argv.slice(2), { stdio: 'inherit' })
