#!/usr/bin/env node
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const PLATFORM_MAP = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
const ARCH_MAP = { x64: 'x64', arm64: 'arm64' }

const platform = PLATFORM_MAP[process.platform]
const arch = ARCH_MAP[process.arch]

if (!platform || !arch) {
  process.stderr.write(`Unsupported platform: ${process.platform}-${process.arch}\n`)
  process.exit(1)
}

const pkgName = `@multiplayer-app/cli-${platform}-${arch}`
const binName = process.platform === 'win32' ? 'multiplayer.exe' : 'multiplayer'
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// In a source checkout (src/index.tsx present), prefer running via bun so that
// locally-added commands work without a full binary rebuild.
const sourceEntry = path.join(rootDir, 'src', 'index.tsx')
if (existsSync(sourceEntry)) {
  const bunCandidates = [
    path.join(rootDir, 'node_modules', '.bin', 'bun'),
    '/opt/homebrew/bin/bun',
    '/usr/local/bin/bun',
    'bun',
  ]
  for (const bunBin of bunCandidates) {
    if (!existsSync(bunBin) && bunBin !== 'bun') continue
    try {
      execFileSync(bunBin, [sourceEntry, ...process.argv.slice(2)], { stdio: 'inherit' })
      process.exit(0)
    } catch (err) {
      if (err.status !== undefined) process.exit(err.status)
      // bun not found at this path, try next
    }
  }
}

// Walk up from this file looking for the binary in node_modules
function findBinary() {
  if (process.env.MULTIPLAYER_BIN_PATH) return process.env.MULTIPLAYER_BIN_PATH

  let dir = path.dirname(fileURLToPath(import.meta.url))
  while (true) {
    const candidate = path.join(dir, 'node_modules', pkgName, 'bin', binName)
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  // Fallback: sibling dist/ for local dev
  const devBin = path.join(rootDir, 'dist', `${platform}-${arch}`, 'bin', binName)
  if (existsSync(devBin)) return devBin

  return null
}

const bin = findBinary()
if (!bin) {
  process.stderr.write(
    `Could not find binary for ${platform}-${arch}.\n` +
    `Try reinstalling: npm install -g @multiplayer-app/cli\n`
  )
  process.exit(1)
}

execFileSync(bin, process.argv.slice(2), { stdio: 'inherit' })
