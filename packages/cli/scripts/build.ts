#!/usr/bin/env bun
import { $ } from 'bun'
import path from 'path'
import fs from 'fs'

const ROOT = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))

const TARGETS = [
  { target: 'bun-darwin-arm64', platform: 'darwin', arch: 'arm64', os: 'darwin', cpu: 'arm64', entry: 'src/index.tsx', bin: 'multiplayer' },
  { target: 'bun-darwin-x64', platform: 'darwin', arch: 'x64', os: 'darwin', cpu: 'x64', entry: 'src/index.tsx', bin: 'multiplayer' },
  { target: 'bun-linux-x64', platform: 'linux', arch: 'x64', os: 'linux', cpu: 'x64', entry: 'src/index.tsx', bin: 'multiplayer' },
  { target: 'bun-linux-arm64', platform: 'linux', arch: 'arm64', os: 'linux', cpu: 'arm64', entry: 'src/index.tsx', bin: 'multiplayer' },
  { target: 'bun-windows-x64', platform: 'windows', arch: 'x64', os: 'win32', cpu: 'x64', entry: 'src/index.tsx', bin: 'multiplayer.exe' },
  { target: 'bun-windows-arm64', platform: 'windows', arch: 'arm64', os: 'win32', cpu: 'arm64', entry: 'src/index.tsx', bin: 'multiplayer.exe' },
]

const single = process.argv.includes('--single')
const targets = single
  ? [TARGETS.find(t => t.platform === (process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux') && t.arch === process.arch)!]
  : TARGETS

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true })

console.log(`Building ${targets.length} target(s)...`)

for (const { target, platform, arch, os, cpu, entry, bin } of targets) {
  const pkgName = `@multiplayer-app/cli-${platform}-${arch}`
  const pkgDir = path.join(ROOT, 'dist', `${platform}-${arch}`)
  const binPath = path.join(pkgDir, bin)

  fs.mkdirSync(pkgDir, { recursive: true })

  console.log(`  → ${target}`)
  await $`bun build ${path.join(ROOT, entry)} --compile --target=${target} --outfile=${binPath} --sourcemap=none`.cwd(ROOT)

  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
    name: pkgName,
    version: pkg.version,
    description: `Multiplayer CLI binary for ${platform}-${arch}`,
    os: [os],
    cpu: [cpu],
    bin: { multiplayer: `./${bin}` },
    files: [bin],
    license: pkg.license,
  }, null, 2))
}

console.log('Done.')
