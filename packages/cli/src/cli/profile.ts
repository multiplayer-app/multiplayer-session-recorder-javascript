import fs from 'fs'
import path from 'path'
import os from 'os'
import { MP_DIR, PRODUCTION_HOSTNAME } from '../config.js'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Authentication credentials stored in ~/.multiplayer/credentials.json,
 * keyed by account name (e.g. "default", "work").
 */
export interface CredentialsConfig {
  apiKey?: string
  authType?: 'oauth' | 'api_key'
  url?: string
  email?: string
}

export interface GitSettings {
  commit?: boolean
  branch_create?: boolean
  pr_create?: boolean
  push?: boolean
  use_worktree?: boolean
}

/**
 * Project-specific settings stored in <projectDir>/.multiplayer/settings.json.
 * Contains no auth or user information.
 */
export interface ProjectSettings {
  name?: string
  workspace?: string
  project?: string
  model?: string
  modelKey?: string
  modelUrl?: string
  maxConcurrentIssues?: number
  noGitBranch?: boolean
  skipSdkCheck?: boolean
  /** True once the user has either completed or explicitly skipped the Session Recorder SDK step. */
  sessionRecorderSetupDone?: boolean
  /** Stacks detected during onboarding that need session-recorder SDK setup. */
  sessionRecorderStacks?: import('../session-recorder/detectStacks.js').DetectedStack[]
  git?: GitSettings
}

/**
 * Merged runtime config (credentials + project settings + resolved dir).
 * Kept for backward compatibility with the rest of the codebase.
 */
export interface ProfileConfig extends CredentialsConfig, ProjectSettings {
  /** Resolved project directory — derived from root settings, not stored in either config file. */
  dir?: string
}

/** One entry in the root project registry. */
export interface ProjectEntry {
  path: string
  account: string
  lastOpenedAt?: string
  demo?: boolean
}

/** Root settings stored in ~/.multiplayer/settings.json. */
export interface RootSettings {
  projects: ProjectEntry[]
}

// ─── File paths ─────────────────────────────────────────────────────────────

// Active file suffix — set once at startup via initEnvironment()
let _fileSuffix = ''

/**
 * Call once at startup with the explicit URL from --url / MULTIPLAYER_URL.
 * Derives the file suffix from the URL hostname so that non-production
 * environments use separate credential and settings files.
 *
 * Examples:
 *   http://localhost:3000           → credentials.localhost.json
 *   https://api.staging.example.com → credentials.api.staging.example.com.json
 *   https://api.multiplayer.app     → credentials.json  (production — no suffix)
 */
export function initEnvironment(explicitUrl?: string): void {
  if (!explicitUrl) {
    _fileSuffix = ''
    return
  }
  try {
    const { hostname } = new URL(explicitUrl)
    _fileSuffix = hostname && hostname !== PRODUCTION_HOSTNAME ? `.${hostname}` : ''
  } catch {
    _fileSuffix = ''
  }
}

/** Returns the active file suffix, e.g. '' or '.localhost' */
export function getFileSuffix(): string {
  return _fileSuffix
}

function credentialsFilePath(): string {
  return path.join(MP_DIR, `credentials${_fileSuffix}.json`)
}

function rootSettingsFilePath(): string {
  return path.join(MP_DIR, `settings${_fileSuffix}.json`)
}

function projectSettingsFileName(): string {
  return `settings${_fileSuffix}.json`
}

// Auth fields that belong in credentials.json (vs project settings)
const CREDENTIAL_KEYS = new Set<string>(['apiKey', 'authType', 'url'])

// ─── Low-level helpers ───────────────────────────────────────────────────────

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ─── Migration ───────────────────────────────────────────────────────────────

/**
 * Parse the legacy INI config format (pre-JSON era) into profile objects.
 */
function parseLegacyIni(content: string): Record<string, ProfileConfig> {
  const raw: Record<string, Record<string, string>> = {}
  let currentSection = 'default'

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue

    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]!.trim()
      if (!raw[currentSection]) raw[currentSection] = {}
      continue
    }
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue
    const key = line.slice(0, eqIdx).trim()
    const value = line.slice(eqIdx + 1).trim()
    if (!raw[currentSection]) raw[currentSection] = {}
    raw[currentSection]![key] = value
  }

  const result: Record<string, ProfileConfig> = {}
  for (const [section, entries] of Object.entries(raw)) {
    const cfg: ProfileConfig = {}
    if (entries['url']) cfg.url = entries['url']
    if (entries['api_key']) cfg.apiKey = entries['api_key']
    if (entries['auth_type'] === 'oauth' || entries['auth_type'] === 'api_key') cfg.authType = entries['auth_type']
    if (entries['workspace']) cfg.workspace = entries['workspace']
    if (entries['project']) cfg.project = entries['project']
    if (entries['name']) cfg.name = entries['name']
    if (entries['dir']) cfg.dir = entries['dir']
    if (entries['model']) cfg.model = entries['model']
    if (entries['model_key']) cfg.modelKey = entries['model_key']
    if (entries['model_url']) cfg.modelUrl = entries['model_url']
    if (entries['max_concurrent']) cfg.maxConcurrentIssues = Number(entries['max_concurrent'])
    if (entries['no_git_branch']) cfg.noGitBranch = entries['no_git_branch'] === 'true'
    if (entries['skip_sdk_check']) cfg.skipSdkCheck = entries['skip_sdk_check'] === 'true'
    result[section] = cfg
  }
  return result
}

/**
 * One-time migration from old all-in-one formats to the new 3-file layout:
 *   - ~/.multiplayer/settings.json  → { projects: [...] }   (root registry)
 *   - ~/.multiplayer/credentials.json → { account: {...} }  (per-account auth)
 *   - <dir>/.multiplayer/settings.json → { model, ... }     (per-project settings)
 *
 * Safe to call on every startup — no-ops if credentials.json already exists.
 */
function migrateIfNeeded(): void {
  // Non-production environments start fresh — no legacy files to migrate
  if (_fileSuffix !== '') return

  if (fs.existsSync(credentialsFilePath())) {
    normaliseAccountKeysToEmail()
    return
  }

  let profiles: Record<string, ProfileConfig> = {}

  // Try reading old JSON settings file (intermediate JSON format)
  if (fs.existsSync(rootSettingsFilePath())) {
    try {
      const parsed = readJson<unknown>(rootSettingsFilePath(), null)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const rec = parsed as Record<string, unknown>
        // Already new format if it has a "projects" array
        if (Array.isArray(rec['projects'])) return
        profiles = rec as Record<string, ProfileConfig>
      }
    } catch { /* ignore */ }
  }

  // Try legacy INI file
  const legacyIniFile = path.join(MP_DIR, 'config')
  if (Object.keys(profiles).length === 0 && fs.existsSync(legacyIniFile)) {
    try {
      profiles = parseLegacyIni(fs.readFileSync(legacyIniFile, 'utf-8'))
      fs.unlinkSync(legacyIniFile)
    } catch { /* ignore */ }
  }

  const allCredentials: Record<string, CredentialsConfig> = {}
  const rootSettings: RootSettings = { projects: [] }

  for (const [accountName, profile] of Object.entries(profiles)) {
    const creds: CredentialsConfig = {}
    const projectSettings: ProjectSettings = {}

    for (const [key, value] of Object.entries(profile) as [keyof ProfileConfig, unknown][]) {
      if (key === 'dir') continue
      if (CREDENTIAL_KEYS.has(key)) {
        (creds as Record<string, unknown>)[key] = value
      } else {
        (projectSettings as Record<string, unknown>)[key] = value
      }
    }

    if (Object.keys(creds).length > 0) allCredentials[accountName] = creds

    if (profile.dir) {
      try {
        const settingsFile = path.join(profile.dir, '.multiplayer', projectSettingsFileName())
        if (!fs.existsSync(settingsFile)) writeJson(settingsFile, projectSettings)
      } catch { /* ignore — project dir may not exist */ }
      rootSettings.projects.push({ path: path.resolve(profile.dir), account: accountName })
    }
  }

  writeJson(credentialsFilePath(), allCredentials)
  writeJson(rootSettingsFilePath(), rootSettings)
  normaliseAccountKeysToEmail()
}

/**
 * Rename any account key that is NOT an email but has an `email` field stored,
 * using the email as the new key. Runs after initial migration and on startup.
 */
function normaliseAccountKeysToEmail(): void {
  if (!fs.existsSync(credentialsFilePath())) return
  const all = readJson<Record<string, CredentialsConfig>>(credentialsFilePath(), {})
  let changed = false
  const normalised: Record<string, CredentialsConfig> = {}

  for (const [key, creds] of Object.entries(all)) {
    const email = creds.email
    const newKey = email && email !== key ? email : key
    if (newKey !== key) {
      changed = true
      normalised[newKey] = { ...normalised[newKey], ...creds }
      // Update root settings references
      const settings = readJson<RootSettings>(rootSettingsFilePath(), { projects: [] })
      const updated = settings.projects.map((p) => p.account === key ? { ...p, account: newKey } : p)
      writeJson(rootSettingsFilePath(), { projects: updated })
    } else {
      normalised[key] = creds
    }
  }

  if (changed) writeJson(credentialsFilePath(), normalised)
}

// ─── Root settings (project registry) ───────────────────────────────────────

function pruneStaleProjects(): void {
  if (!fs.existsSync(rootSettingsFilePath())) return
  const settings = readJson<RootSettings>(rootSettingsFilePath(), { projects: [] })
  const live = settings.projects.filter((p) => {
    const resolved = path.resolve(p.path)
    if (!fs.existsSync(resolved)) return false
    const settingsFile = path.join(resolved, '.multiplayer', projectSettingsFileName())
    return fs.existsSync(settingsFile)
  })
  if (live.length !== settings.projects.length) {
    writeJson(rootSettingsFilePath(), { projects: live })
  }
}

export function readRootSettings(): RootSettings {
  migrateIfNeeded()
  pruneStaleProjects()
  return readJson<RootSettings>(rootSettingsFilePath(), { projects: [] })
}

export function writeRootSettings(settings: RootSettings): void {
  writeJson(rootSettingsFilePath(), settings)
}

/** Register (or re-associate) a project path with an account. */
export function addProject(projectPath: string, accountName: string): void {
  const settings = readRootSettings()
  const resolved = path.resolve(projectPath)
  const idx = settings.projects.findIndex((p) => path.resolve(p.path) === resolved)
  if (idx >= 0) {
    settings.projects[idx]!.account = accountName
  } else {
    settings.projects.push({ path: resolved, account: accountName })
  }
  writeRootSettings(settings)
}

/** Remove a project from the registry. */
export function removeProject(projectPath: string): void {
  const settings = readRootSettings()
  const resolved = path.resolve(projectPath)
  settings.projects = settings.projects.filter((p) => path.resolve(p.path) !== resolved)
  writeRootSettings(settings)
}

/** Return the account name linked to a project path, or undefined if not registered. */
export function getProjectAccount(projectPath: string): string | undefined {
  const settings = readRootSettings()
  const resolved = path.resolve(projectPath)
  return settings.projects.find((p) => path.resolve(p.path) === resolved)?.account
}

export function listProjects(): ProjectEntry[] {
  const { projects } = readRootSettings()
  return [...projects].sort((a, b) => {
    if (!a.lastOpenedAt && !b.lastOpenedAt) return 0
    if (!a.lastOpenedAt) return 1
    if (!b.lastOpenedAt) return -1
    return b.lastOpenedAt.localeCompare(a.lastOpenedAt)
  })
}

/** Update the lastOpenedAt timestamp for a registered project. */
export function touchProject(projectPath: string): void {
  const settings = readRootSettings()
  const resolved = path.resolve(projectPath)
  const idx = settings.projects.findIndex((p) => path.resolve(p.path) === resolved)
  if (idx >= 0) {
    settings.projects[idx]!.lastOpenedAt = new Date().toISOString()
    writeRootSettings(settings)
  }
}

/** Mark or unmark a project as a demo project. */
export function setProjectDemo(projectPath: string, demo: boolean): void {
  const settings = readRootSettings()
  const resolved = path.resolve(projectPath)
  const idx = settings.projects.findIndex((p) => path.resolve(p.path) === resolved)
  if (idx >= 0) {
    settings.projects[idx]!.demo = demo
    writeRootSettings(settings)
  }
}

// ─── Credentials ────────────────────────────────────────────────────────────

export function readCredentials(accountName: string): CredentialsConfig {
  migrateIfNeeded()
  return readJson<Record<string, CredentialsConfig>>(credentialsFilePath(), {})[accountName] ?? {}
}

export function writeCredentials(accountName: string, creds: Partial<CredentialsConfig>): void {
  const defined = Object.entries(creds).filter(([, v]) => v !== undefined)
  if (defined.length === 0) return
  migrateIfNeeded()
  const all = readJson<Record<string, CredentialsConfig>>(credentialsFilePath(), {})
  if (!all[accountName]) all[accountName] = {}
  for (const [key, value] of defined as [keyof CredentialsConfig, unknown][]) {
    (all[accountName] as Record<string, unknown>)[key] = value
  }
  writeJson(credentialsFilePath(), all)
}

/** Fully remove an account from credentials.json and unlink its projects from the registry. */
export function removeAccount(accountName: string): void {
  migrateIfNeeded()
  const all = readJson<Record<string, unknown>>(credentialsFilePath(), {})
  delete all[accountName]
  writeJson(credentialsFilePath(), all)

  const settings = readRootSettings()
  settings.projects = settings.projects.filter((p) => p.account !== accountName)
  writeRootSettings(settings)
}

/** Clear auth tokens/keys from an account, leaving other credential fields intact. */
export function clearCredentials(accountName: string): void {
  migrateIfNeeded()
  const all = readJson<Record<string, CredentialsConfig>>(credentialsFilePath(), {})
  const entry = all[accountName]
  if (!entry) return
  delete entry.apiKey
  delete entry.authType
  writeJson(credentialsFilePath(), all)
}

/** Return all account names that have actual auth credentials stored. */
export function listAccounts(): string[] {
  migrateIfNeeded()
  const all = readJson<Record<string, CredentialsConfig>>(credentialsFilePath(), {})
  return Object.entries(all)
    .filter(([, creds]) => !!creds.apiKey || !!creds.authType)
    .map(([name]) => name)
}

// ─── Project settings ────────────────────────────────────────────────────────

export function readProjectSettings(projectPath: string): ProjectSettings {
  const resolved = path.resolve(projectPath)
  const file = path.join(resolved, '.multiplayer', projectSettingsFileName())
  if (_fileSuffix) {
    // In non-production envs, merge the base settings.json (lower priority) with the
    // env-specific file so that project-level settings (git, etc.) set in production
    // remain accessible without needing a separate per-environment setup.
    const base = readJson<ProjectSettings>(path.join(resolved, '.multiplayer', 'settings.json'), {})
    const env = readJson<ProjectSettings>(file, {})
    return { ...base, ...env }
  }
  return readJson<ProjectSettings>(file, {})
}

export function writeProjectSettings(projectPath: string, settings: Partial<ProjectSettings>): void {
  const file = path.join(path.resolve(projectPath), '.multiplayer', projectSettingsFileName())
  const existing = readJson<ProjectSettings>(file, {})
  for (const [key, value] of Object.entries(settings) as [keyof ProjectSettings, unknown][]) {
    if (value !== undefined) (existing as Record<string, unknown>)[key] = value
  }
  writeJson(file, existing)
}

// ─── Project dir resolution (internal) ──────────────────────────────────────

/**
 * Rename an account key everywhere it appears (credentials + root settings).
 * Used after authentication to replace the temporary key with the user's email.
 */
export function renameAccount(oldKey: string, newKey: string): void {
  if (oldKey === newKey) return
  const all = readJson<Record<string, unknown>>(credentialsFilePath(), {})
  if (!all[oldKey]) return
  // Merge old into new (new takes precedence if the key already exists)
  all[newKey] = { ...(all[oldKey] as object), ...(all[newKey] as object ?? {}) }
  delete all[oldKey]
  writeJson(credentialsFilePath(), all)

  const settings = readJson<RootSettings>(rootSettingsFilePath(), { projects: [] })
  const updated = settings.projects.map((p) => p.account === oldKey ? { ...p, account: newKey } : p)
  writeJson(rootSettingsFilePath(), { projects: updated })
}

/**
 * Walk up from the given path (or cwd) and return the first registered
 * project entry whose path matches. Ignores account — matches on path alone.
 */
function searchProjects(projects: ProjectEntry[], fromPath?: string): ProjectEntry | undefined {
  const home = os.homedir()
  let current = path.resolve(fromPath ?? process.cwd())
  while (current !== home) {
    const match = projects.find((p) => path.resolve(p.path) === current)
    if (match) return match
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return undefined
}

export function findRegisteredProject(fromPath?: string): ProjectEntry | undefined {
  const result = searchProjects(listProjects(), fromPath)
  if (result) return result

  // In non-production envs the env-specific registry may not include projects that
  // were registered in production. Fall back to the production settings.json so that
  // project-level settings (git flags, etc.) are still discoverable.
  if (_fileSuffix) {
    const prodSettings = readJson<RootSettings>(path.join(MP_DIR, 'settings.json'), { projects: [] })
    return searchProjects(prodSettings.projects, fromPath)
  }

  return undefined
}

// ─── Backward-compatible API ─────────────────────────────────────────────────

/**
 * Load the merged runtime config for an account + project dir.
 *
 * If the cwd (or an ancestor) is a registered project, its path and associated
 * account are used automatically — the caller's accountName is only a fallback.
 *
 * Resolution order (highest priority first):
 *   1. CLI flags / env vars (applied by the caller after this returns)
 *   2. Project settings from <projectDir>/.multiplayer/settings.json
 *   3. Credentials from ~/.multiplayer/credentials.json
 */
export function loadProfile(accountName: string, projectDir?: string): ProfileConfig {
  migrateIfNeeded()
  const registered = findRegisteredProject(projectDir)
  const effectiveAccount = registered?.account ?? accountName
  const creds = readCredentials(effectiveAccount)
  const dir = projectDir ?? registered?.path
  const projectSettings = dir ? readProjectSettings(dir) : {}
  return { ...creds, ...projectSettings, ...(dir ? { dir } : {}) }
}

/**
 * Write profile fields, routing credential fields to credentials.json and
 * project fields to the appropriate project settings file.
 *
 * @deprecated Prefer writeCredentials / writeProjectSettings / addProject directly.
 */
export function writeProfile(accountName: string, config: Partial<ProfileConfig>): void {
  const creds: Partial<CredentialsConfig> = {}
  const projectFields: Partial<ProjectSettings> = {}
  let configDir: string | undefined

  for (const [key, value] of Object.entries(config) as [keyof ProfileConfig, unknown][]) {
    if (key === 'dir') {
      configDir = value as string | undefined
    } else if (CREDENTIAL_KEYS.has(key)) {
      (creds as Record<string, unknown>)[key] = value
    } else {
      (projectFields as Record<string, unknown>)[key] = value
    }
  }

  if (Object.keys(creds).length > 0) writeCredentials(accountName, creds)

  const dir = configDir ?? findRegisteredProject()?.path
  if (dir && Object.keys(projectFields).length > 0) {
    addProject(dir, accountName)
    writeProjectSettings(dir, projectFields)
  }
}

/**
 * Remove auth fields from an account's credentials. Called on auth error or logout.
 *
 * @deprecated Prefer clearCredentials directly.
 */
export function clearProfileAuth(accountName: string): void {
  clearCredentials(accountName)
}
