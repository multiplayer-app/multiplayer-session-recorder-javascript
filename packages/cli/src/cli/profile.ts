import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * Profile config keys map 1-to-1 with AgentConfig fields (minus workspace/project,
 * which are derived from the api_key JWT at runtime).
 *
 * Config file format (INI-style, same as AWS):
 *
 *   [default]
 *   api_key = <jwt>
 *   url = https://api.multiplayer.app/v0
 *   dir = /path/to/repo
 *   model = claude-sonnet-4-6
 *   model_key = sk-...
 *   model_url = https://...
 *   name = my-agent
 *   max_concurrent = 2
 *   no_git_branch = false
 *
 *   [staging]
 *   api_key = <staging-jwt>
 *   dir = /path/to/repo
 *   model = claude-sonnet-4-6
 */

export interface ProfileConfig {
  url?: string
  apiKey?: string
  name?: string
  dir?: string
  model?: string
  modelKey?: string
  modelUrl?: string
  maxConcurrentIssues?: number
  noGitBranch?: boolean
}

/**
 * Parse a simple INI file into a map of profile name → key/value pairs.
 * Supports `[profile_name]` sections and `key = value` entries.
 * Lines starting with `#` or `;` are treated as comments.
 */
function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}
  let currentSection = 'default'

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue

    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]!.trim()
      if (!result[currentSection]) result[currentSection] = {}
      continue
    }

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue
    const key = line.slice(0, eqIdx).trim()
    const value = line.slice(eqIdx + 1).trim()
    if (!result[currentSection]) result[currentSection] = {}
    result[currentSection]![key] = value
  }

  return result
}

function iniToProfileConfig(raw: Record<string, string>): ProfileConfig {
  const cfg: ProfileConfig = {}
  if (raw['url']) cfg.url = raw['url']
  if (raw['api_key']) cfg.apiKey = raw['api_key']
  if (raw['name']) cfg.name = raw['name']
  if (raw['dir']) cfg.dir = raw['dir']
  if (raw['model']) cfg.model = raw['model']
  if (raw['model_key']) cfg.modelKey = raw['model_key']
  if (raw['model_url']) cfg.modelUrl = raw['model_url']
  if (raw['max_concurrent']) cfg.maxConcurrentIssues = Number(raw['max_concurrent'])
  if (raw['no_git_branch']) cfg.noGitBranch = raw['no_git_branch'] === 'true'
  return cfg
}

/**
 * Locate `.multiplayer/config` by checking:
 *   1. The project directory (cwd or provided path)
 *   2. The user's home directory
 *
 * Returns the path of the first file found, or undefined.
 */
function findConfigFile(projectDir?: string): string | undefined {
  // Walk up from dir, collecting candidate paths
  function ancestorCandidates(dir: string): string[] {
    const result: string[] = []
    let current = path.resolve(dir)
    const home = os.homedir()
    while (true) {
      result.push(path.join(current, '.multiplayer', 'config'))
      const parent = path.dirname(current)
      if (parent === current || current === home) break
      current = parent
    }
    return result
  }

  const candidates = [
    projectDir ? path.join(projectDir, '.multiplayer', 'config') : undefined,
    ...ancestorCandidates(process.cwd()),
    path.join(os.homedir(), '.multiplayer', 'config'),
  ].filter(Boolean) as string[]

  // Deduplicate
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate)
    if (seen.has(resolved)) continue
    seen.add(resolved)
    if (fs.existsSync(resolved)) return resolved
  }

  return undefined
}

/**
 * Load config for a named profile.
 *
 * Resolution order (highest priority first):
 *   1. CLI flags / env vars (applied by the caller after this returns)
 *   2. Named profile in project-dir config file
 *   3. Named profile in home-dir config file
 *   4. `default` profile (same search order)
 */
export function loadProfile(profileName: string, projectDir?: string): ProfileConfig {
  const configPath = findConfigFile(projectDir)
  if (!configPath) return {}

  let content: string
  try {
    content = fs.readFileSync(configPath, 'utf-8')
  } catch {
    return {}
  }

  const parsed = parseIni(content)

  // Merge default → named profile so named profile values take precedence
  const defaultRaw = parsed['default'] ?? {}
  const profileRaw = profileName !== 'default' ? (parsed[profileName] ?? {}) : {}
  const merged = { ...defaultRaw, ...profileRaw }

  return iniToProfileConfig(merged)
}
