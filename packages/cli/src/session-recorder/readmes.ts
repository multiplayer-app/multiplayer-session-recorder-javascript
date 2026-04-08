/**
 * SDK integration READMEs embedded as strings.
 *
 * These are read at build time by Bun's bundler and compiled into the binary,
 * so they're available at runtime without filesystem access to the monorepo.
 *
 * To update: edit the source README, then rebuild the CLI.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readReadmeAtBuildTime(relativePath: string): string {
  // At build time (bun build --compile), this resolves relative to the monorepo.
  // The content gets inlined into the compiled binary as a string literal.
  try {
    // From packages/cli/src/session-recorder/ → walk up to monorepo root
    const monorepoRoot = path.resolve(__dirname, '..', '..', '..', '..')
    return fs.readFileSync(path.join(monorepoRoot, relativePath), 'utf-8')
  } catch {
    return `(README not found: ${relativePath})`
  }
}

// ─── Embedded READMEs ────────────────────────────────────────────────────────

export const README_REACT = readReadmeAtBuildTime('packages/session-recorder-react/README.md')
export const README_BROWSER = readReadmeAtBuildTime('packages/session-recorder-browser/README.md')
export const README_NODE = readReadmeAtBuildTime('packages/session-recorder-node/README.md')
export const README_REACT_NATIVE = readReadmeAtBuildTime('packages/session-recorder-react-native/README.md')
export const README_ANGULAR = readReadmeAtBuildTime('packages/session-recorder-browser/examples/angular/README.md')
export const README_VUE = readReadmeAtBuildTime('packages/session-recorder-browser/examples/vue/README.md')

// ─── Lookup by SDK + framework ───────────────────────────────────────────────

export function getReadmeContent(sdkPackage: string, framework: string): string {
  // Framework-specific overrides
  if (framework === 'angular') return README_ANGULAR
  if (framework === 'vue' || framework === 'nuxt') return README_VUE

  // SDK-level defaults
  switch (sdkPackage) {
    case '@multiplayer-app/session-recorder-react':
      return README_REACT
    case '@multiplayer-app/session-recorder-react-native':
      return README_REACT_NATIVE
    case '@multiplayer-app/session-recorder-node':
      return README_NODE
    case '@multiplayer-app/session-recorder-browser':
      return README_BROWSER
    default:
      // Non-JS SDKs — return browser README as best available reference
      return README_BROWSER
  }
}
