#!/usr/bin/env bun
import { $ } from 'bun'
import path from 'path'
import fs from 'fs'

const ROOT = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const prereleaseMatch = pkg.version?.match(/-([\w]+)(\.\d+)?$/)
const distTag = prereleaseMatch ? prereleaseMatch[1] : 'latest'

const PLATFORMS: { dir: string; bin: string }[] = [
  { dir: 'darwin-arm64',  bin: 'multiplayer'     },
  { dir: 'darwin-x64',    bin: 'multiplayer'     },
  { dir: 'linux-x64',     bin: 'multiplayer'     },
  { dir: 'linux-arm64',   bin: 'multiplayer'     },
  { dir: 'windows-x64',   bin: 'multiplayer.exe' },
  { dir: 'windows-arm64', bin: 'multiplayer.exe' },
]

async function publish(pkgDir: string, label: string, ignoreScripts = false) {
  const provenance = process.env.NPM_CONFIG_PROVENANCE === 'true' ? ['--provenance'] : []
  const result = ignoreScripts
    ? await $`npm publish --access public --tag ${distTag} --ignore-scripts ${provenance}`.cwd(pkgDir).nothrow()
    : await $`npm publish --access public --tag ${distTag} ${provenance}`.cwd(pkgDir).nothrow()
  if (result.exitCode === 0) {
    console.log(`Published ${label}`)
  } else {
    const stderr = result.stderr.toString()
    const output = stderr + result.stdout.toString()
    if (output.includes('You cannot publish over the previously published versions') || output.includes('previously published')) {
      console.log(`Skipping ${label} — already published`)
    } else {
      process.stderr.write(stderr)
      process.exit(result.exitCode)
    }
  }
}

// Publish platform packages first
for (const { dir, bin } of PLATFORMS) {
  const pkgDir = path.join(ROOT, 'dist', dir)
  if (!fs.existsSync(pkgDir)) {
    console.error(`Missing: dist/${dir} — run 'bun run build' first`)
    process.exit(1)
  }
  fs.chmodSync(path.join(pkgDir, 'bin', bin), 0o755)
  await publish(pkgDir, `@multiplayer-app/cli-${dir}`)
}

// Then publish the main wrapper package (--ignore-scripts prevents recursive publish lifecycle hook)
await publish(ROOT, '@multiplayer-app/cli', true)

console.log('All packages published.')
