import fs from 'fs'
import path from 'path'

// ─── Types ───────────────────────────────────────────────────────────────────

export type StackType = 'frontend' | 'backend' | 'fullstack' | 'mobile'

export type Framework =
  | 'react'
  | 'next'
  | 'vue'
  | 'nuxt'
  | 'angular'
  | 'svelte'
  | 'sveltekit'
  | 'react-native'
  | 'expo'
  | 'express'
  | 'fastify'
  | 'nestjs'
  | 'hono'
  | 'koa'
  | 'django'
  | 'flask'
  | 'fastapi'
  | 'rails'
  | 'sinatra'
  | 'gin'
  | 'fiber'
  | 'spring'
  | 'aspnet'
  | 'node-generic'
  | 'python-generic'
  | 'go-generic'
  | 'ruby-generic'
  | 'java-generic'
  | 'dotnet-generic'

export type SdkPackage =
  | '@multiplayer-app/session-recorder-react'
  | '@multiplayer-app/session-recorder-browser'
  | '@multiplayer-app/session-recorder-node'
  | '@multiplayer-app/session-recorder-react-native'
  // Non-JS SDKs (external)
  | 'multiplayer-go'
  | 'multiplayer-python'
  | 'multiplayer-ruby'
  | 'multiplayer-dotnet'
  | 'multiplayer-java'

export type SdkRelevance =
  /** SDK is needed and not yet installed */
  | 'needed'
  /** SDK is already installed */
  | 'installed'
  /** This package doesn't need the SDK (e.g., utility lib, types package) */
  | 'not-needed'
  /** SDK is provided by a dependency this package consumes */
  | 'covered-by-dependency'

export interface DetectedStack {
  /** Root directory of this app/package */
  root: string
  /** Relative path from scan root (for display) */
  relativePath: string
  /** Human-readable label, e.g. "Next.js frontend" */
  label: string
  /** Primary framework detected */
  framework: Framework
  /** Frontend, backend, fullstack, or mobile */
  type: StackType
  /** Which SDK package we recommend installing */
  sdkPackage: SdkPackage
  /** Path to the README with integration instructions (relative to monorepo root) */
  readmePath: string
  /** Package manager detected */
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'go' | 'gem' | 'maven' | 'gradle' | 'dotnet' | 'unknown'
  /** Whether any Multiplayer session recorder SDK is already installed */
  alreadyInstalled: boolean
  /** Which SDK package is actually installed (may differ from recommended sdkPackage) */
  installedSdkPackage?: string
  /** Likely entry file for integration (best guess) */
  entryFile?: string
  /** Language */
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'ruby' | 'java' | 'kotlin' | 'csharp'
  /** AI-determined SDK relevance (set after classification) */
  sdkRelevance?: SdkRelevance
  /** Human-readable reason for the relevance classification */
  sdkRelevanceReason?: string
  /** Package name from package.json (for monorepo graph) */
  packageName?: string
  /** Description from package.json */
  packageDescription?: string
  /** Internal monorepo packages this stack depends on */
  internalDeps?: string[]
  /** Internal monorepo packages that depend on this stack */
  internalDependents?: string[]
}

/** Monorepo dependency graph: maps package name → list of internal package names it depends on */
export interface MonorepoGraph {
  /** All package names found in the monorepo */
  packages: Map<string, { root: string; relativePath: string; deps: string[] }>
  /** Reverse map: package name → packages that depend on it */
  dependents: Map<string, string[]>
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_DEPTH = 3

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', '.tox', 'vendor', 'target', 'bin', 'obj',
  '.svelte-kit', '.output', 'coverage', '.turbo', '.cache',
])

// Maps dependency names to framework detection
const JS_FRONTEND_SIGNALS: Record<string, { framework: Framework; label: string; type: StackType }> = {
  'next': { framework: 'next', label: 'Next.js', type: 'fullstack' },
  '@angular/core': { framework: 'angular', label: 'Angular', type: 'frontend' },
  'vue': { framework: 'vue', label: 'Vue.js', type: 'frontend' },
  'nuxt': { framework: 'nuxt', label: 'Nuxt', type: 'fullstack' },
  'svelte': { framework: 'svelte', label: 'Svelte', type: 'frontend' },
  '@sveltejs/kit': { framework: 'sveltekit', label: 'SvelteKit', type: 'fullstack' },
  'react-native': { framework: 'react-native', label: 'React Native', type: 'mobile' },
  'expo': { framework: 'expo', label: 'Expo (React Native)', type: 'mobile' },
  'react': { framework: 'react', label: 'React', type: 'frontend' },
}

const JS_BACKEND_SIGNALS: Record<string, { framework: Framework; label: string }> = {
  'express': { framework: 'express', label: 'Express' },
  'fastify': { framework: 'fastify', label: 'Fastify' },
  '@nestjs/core': { framework: 'nestjs', label: 'NestJS' },
  'hono': { framework: 'hono', label: 'Hono' },
  'koa': { framework: 'koa', label: 'Koa' },
}

// ─── SDK Mapping ─────────────────────────────────────────────────────────────

function getSdkPackage(framework: Framework, type: StackType): SdkPackage {
  if (type === 'mobile') return '@multiplayer-app/session-recorder-react-native'
  if (framework === 'react' || framework === 'next') return '@multiplayer-app/session-recorder-react'
  if (framework === 'angular' || framework === 'vue' || framework === 'svelte' || framework === 'sveltekit' || framework === 'nuxt') {
    return '@multiplayer-app/session-recorder-browser'
  }
  if (type === 'backend') {
    // Check language
    if (['express', 'fastify', 'nestjs', 'hono', 'koa', 'node-generic'].includes(framework)) {
      return '@multiplayer-app/session-recorder-node'
    }
    if (['django', 'flask', 'fastapi', 'python-generic'].includes(framework)) return 'multiplayer-python'
    if (['gin', 'fiber', 'go-generic'].includes(framework)) return 'multiplayer-go'
    if (['rails', 'sinatra', 'ruby-generic'].includes(framework)) return 'multiplayer-ruby'
    if (['spring', 'java-generic'].includes(framework)) return 'multiplayer-java'
    if (['aspnet', 'dotnet-generic'].includes(framework)) return 'multiplayer-dotnet'
  }
  return '@multiplayer-app/session-recorder-browser'
}

function getReadmePath(sdk: SdkPackage, framework: Framework): string {
  switch (sdk) {
    case '@multiplayer-app/session-recorder-react':
      return 'packages/session-recorder-react/README.md'
    case '@multiplayer-app/session-recorder-react-native':
      return 'packages/session-recorder-react-native/README.md'
    case '@multiplayer-app/session-recorder-node':
      return 'packages/session-recorder-node/README.md'
    case '@multiplayer-app/session-recorder-browser':
      if (framework === 'angular') return 'packages/session-recorder-browser/examples/angular/README.md'
      if (framework === 'vue' || framework === 'nuxt') return 'packages/session-recorder-browser/examples/vue/README.md'
      return 'packages/session-recorder-browser/README.md'
    default:
      return 'packages/session-recorder-browser/README.md'
  }
}

// ─── Detection helpers ───────────────────────────────────────────────────────

function readJsonSafe(filePath: string): Record<string, any> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function detectPackageManager(root: string): DetectedStack['packageManager'] {
  if (fileExists(path.join(root, 'bun.lockb')) || fileExists(path.join(root, 'bun.lock'))) return 'bun'
  if (fileExists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fileExists(path.join(root, 'yarn.lock'))) return 'yarn'
  if (fileExists(path.join(root, 'package-lock.json'))) return 'npm'
  return 'npm' // default for JS projects
}

function findEntryFile(root: string, framework: Framework): string | undefined {
  const candidates: string[] = []
  switch (framework) {
    case 'next':
      candidates.push('src/app/layout.tsx', 'src/app/layout.jsx', 'app/layout.tsx', 'app/layout.jsx',
        'src/pages/_app.tsx', 'src/pages/_app.jsx', 'pages/_app.tsx', 'pages/_app.jsx')
      break
    case 'react':
      candidates.push('src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx',
        'src/App.tsx', 'src/App.jsx')
      break
    case 'angular':
      candidates.push('src/main.ts', 'src/app/app.config.ts', 'src/app/app.module.ts')
      break
    case 'vue':
    case 'nuxt':
      candidates.push('src/main.ts', 'src/main.js', 'app.vue', 'src/App.vue')
      break
    case 'svelte':
    case 'sveltekit':
      candidates.push('src/main.ts', 'src/main.js', 'src/routes/+layout.svelte')
      break
    case 'react-native':
    case 'expo':
      candidates.push('App.tsx', 'App.jsx', 'app/_layout.tsx', 'src/App.tsx', 'index.js')
      break
    case 'express':
    case 'fastify':
    case 'nestjs':
    case 'hono':
    case 'koa':
    case 'node-generic':
      candidates.push('src/server.ts', 'src/index.ts', 'src/main.ts', 'src/app.ts',
        'server.ts', 'index.ts', 'app.ts',
        'src/server.js', 'src/index.js', 'server.js', 'index.js', 'app.js')
      break
    default:
      break
  }
  for (const c of candidates) {
    if (fileExists(path.join(root, c))) return c
  }
  return undefined
}

/** All known Multiplayer session recorder JS SDK packages */
const ALL_JS_SDK_PACKAGES = [
  '@multiplayer-app/session-recorder-react',
  '@multiplayer-app/session-recorder-browser',
  '@multiplayer-app/session-recorder-node',
  '@multiplayer-app/session-recorder-react-native',
  '@multiplayer-app/session-recorder-common',
] as const

/**
 * Check if ANY Multiplayer session recorder SDK is installed in this project.
 * Returns the installed package name, or null if none found.
 *
 * This handles the case where e.g. a React app uses session-recorder-browser
 * instead of session-recorder-react — both are valid integrations.
 */
function findInstalledSdk(root: string): string | null {
  const pkgJson = readJsonSafe(path.join(root, 'package.json'))
  if (!pkgJson) return null
  const allDeps = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
  }
  for (const sdk of ALL_JS_SDK_PACKAGES) {
    if (sdk in allDeps) return sdk
  }
  return null
}

/** The Multiplayer OTLP endpoint domain — backends can use standard OTel with this endpoint */
const MULTIPLAYER_OTLP_DOMAIN = 'otlp.multiplayer.app'

/** Known OTel OTLP packages that indicate OpenTelemetry is configured */
const OTEL_PACKAGES = [
  '@opentelemetry/sdk-trace-node',
  '@opentelemetry/sdk-trace-base',
  '@opentelemetry/sdk-node',
  '@opentelemetry/exporter-trace-otlp-http',
  '@opentelemetry/exporter-trace-otlp-grpc',
  '@opentelemetry/exporter-trace-otlp-proto',
  '@opentelemetry/exporter-logs-otlp-http',
  '@opentelemetry/auto-instrumentations-node',
] as const

/**
 * Check if a backend project has OpenTelemetry set up to export to the Multiplayer
 * OTLP endpoint (otlp.multiplayer.app). This counts as "installed" because standard
 * OTel with the Multiplayer endpoint is sufficient for backend tracing — no Multiplayer
 * SDK package, ID generator, or exporter needed.
 *
 * Checks:
 * 1. OTel packages in dependencies
 * 2. Multiplayer OTLP endpoint in source files, env files, or OTel collector configs
 */
function hasOtelWithMultiplayerEndpoint(root: string): boolean {
  const pkgJson = readJsonSafe(path.join(root, 'package.json'))
  if (!pkgJson) return false

  const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies }
  const depNames = Object.keys(allDeps)
  const hasOtel = OTEL_PACKAGES.some(pkg => depNames.includes(pkg))
  if (!hasOtel) return false

  // Check source files, env files, and OTel configs for the Multiplayer OTLP endpoint
  const filesToCheck = [
    // OTel config files
    'src/opentelemetry.ts', 'src/opentelemetry.js',
    'src/tracing.ts', 'src/tracing.js',
    'src/instrumentation.ts', 'src/instrumentation.js',
    'opentelemetry.ts', 'opentelemetry.js',
    'tracing.ts', 'tracing.js',
    // OTel collector configs
    'otel-collector-config.yaml', 'otel-collector-config.yml',
    // Env files (endpoint may be configured via OTEL_EXPORTER_OTLP_ENDPOINT)
    '.env', '.env.example', '.env.local', '.env.production',
    // Docker compose (may configure OTel collector with Multiplayer endpoint)
    'docker-compose.yml', 'docker-compose.yaml',
    // Entry files
    'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
    'src/server.ts', 'src/server.js', 'src/app.ts', 'src/app.js',
    'index.ts', 'index.js', 'server.ts', 'server.js', 'app.ts', 'app.js',
  ]

  for (const rel of filesToCheck) {
    const abs = path.join(root, rel)
    try {
      if (!fs.existsSync(abs)) continue
      const content = fs.readFileSync(abs, 'utf-8')
      if (content.length > 100_000) continue // skip very large files
      if (content.includes(MULTIPLAYER_OTLP_DOMAIN)) return true
    } catch { /* skip unreadable */ }
  }

  return false
}

// ─── JS/TS project scanning ─────────────────────────────────────────────────

function scanJsProject(root: string, relativePath: string): DetectedStack[] {
  const pkgJson = readJsonSafe(path.join(root, 'package.json'))
  if (!pkgJson) return []

  const allDeps = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
  }
  const depNames = Object.keys(allDeps)
  const results: DetectedStack[] = []
  const packageManager = detectPackageManager(root)

  // Check if ANY Multiplayer session recorder SDK is already installed
  // (user may have used browser lib in a React app, etc.)
  const installedSdk = findInstalledSdk(root)
  // For backends: also check if OTel is configured with Multiplayer OTLP endpoint
  // (standard OTel + otlp.multiplayer.app is sufficient — no Multiplayer SDK package needed)
  const hasOtelMultiplayer = hasOtelWithMultiplayerEndpoint(root)
  const isLanguageTs = depNames.includes('typescript') || fileExists(path.join(root, 'tsconfig.json'))

  // Detect frontend/fullstack framework (priority order matters)
  let frontendDetected = false
  for (const [dep, info] of Object.entries(JS_FRONTEND_SIGNALS)) {
    if (depNames.includes(dep)) {
      const sdkPackage = getSdkPackage(info.framework, info.type)
      results.push({
        root,
        relativePath,
        label: `${info.label} ${info.type}`,
        framework: info.framework,
        type: info.type,
        sdkPackage,
        readmePath: getReadmePath(sdkPackage, info.framework),
        packageManager,
        alreadyInstalled: installedSdk !== null,
        installedSdkPackage: installedSdk ?? undefined,
        entryFile: findEntryFile(root, info.framework),
        language: isLanguageTs ? 'typescript' : 'javascript',
      })
      frontendDetected = true
      break // take first (highest priority) match
    }
  }

  // Detect backend framework
  let backendDetected = false
  for (const [dep, info] of Object.entries(JS_BACKEND_SIGNALS)) {
    if (depNames.includes(dep)) {
      const sdkPackage = getSdkPackage(info.framework, 'backend')
      // Skip if the same project already detected as fullstack (e.g., Next.js with API routes)
      const existingFullstack = results.find(r => r.type === 'fullstack')
      if (existingFullstack) break

      const backendInstalled = installedSdk !== null || hasOtelMultiplayer
      results.push({
        root,
        relativePath,
        label: `${info.label} backend`,
        framework: info.framework,
        type: 'backend',
        sdkPackage,
        readmePath: getReadmePath(sdkPackage, info.framework),
        packageManager,
        alreadyInstalled: backendInstalled,
        installedSdkPackage: installedSdk ?? (hasOtelMultiplayer ? 'otel+otlp.multiplayer.app' : undefined),
        entryFile: findEntryFile(root, info.framework),
        language: isLanguageTs ? 'typescript' : 'javascript',
      })
      backendDetected = true
      break
    }
  }

  // If we have package.json with a backend-ish main/bin but no framework detected
  if (!frontendDetected && !backendDetected && (pkgJson.main || pkgJson.bin)) {
    const sdkPackage = getSdkPackage('node-generic', 'backend')
    const backendInstalled = installedSdk !== null || hasOtelMultiplayer
    results.push({
      root,
      relativePath,
      label: 'Node.js app',
      framework: 'node-generic',
      type: 'backend',
      sdkPackage,
      readmePath: getReadmePath(sdkPackage, 'node-generic'),
      packageManager,
      alreadyInstalled: backendInstalled,
      installedSdkPackage: installedSdk ?? (hasOtelMultiplayer ? 'otel+otlp.multiplayer.app' : undefined),
      entryFile: findEntryFile(root, 'node-generic'),
      language: isLanguageTs ? 'typescript' : 'javascript',
    })
  }

  return results
}

// ─── Non-JS project scanning ─────────────────────────────────────────────────

function scanPythonProject(root: string, relativePath: string): DetectedStack[] {
  const hasPyproject = fileExists(path.join(root, 'pyproject.toml'))
  const hasRequirements = fileExists(path.join(root, 'requirements.txt'))
  if (!hasPyproject && !hasRequirements) return []

  // Read requirements or pyproject to detect framework
  let content = ''
  try {
    if (hasRequirements) content = fs.readFileSync(path.join(root, 'requirements.txt'), 'utf-8')
    if (hasPyproject) content += '\n' + fs.readFileSync(path.join(root, 'pyproject.toml'), 'utf-8')
  } catch { /* ignore */ }

  let framework: Framework = 'python-generic'
  let label = 'Python app'
  if (content.includes('django')) { framework = 'django'; label = 'Django' }
  else if (content.includes('fastapi')) { framework = 'fastapi'; label = 'FastAPI' }
  else if (content.includes('flask')) { framework = 'flask'; label = 'Flask' }

  return [{
    root,
    relativePath,
    label: `${label} backend`,
    framework,
    type: 'backend',
    sdkPackage: 'multiplayer-python',
    readmePath: 'packages/session-recorder-browser/README.md', // fallback until Python SDK docs exist
    packageManager: 'pip',
    alreadyInstalled: false, // TODO: check pip freeze
    language: 'python',
  }]
}

function scanGoProject(root: string, relativePath: string): DetectedStack[] {
  if (!fileExists(path.join(root, 'go.mod'))) return []

  let content = ''
  try { content = fs.readFileSync(path.join(root, 'go.mod'), 'utf-8') } catch { /* ignore */ }

  let framework: Framework = 'go-generic'
  let label = 'Go app'
  if (content.includes('github.com/gin-gonic/gin')) { framework = 'gin'; label = 'Gin' }
  else if (content.includes('github.com/gofiber/fiber')) { framework = 'fiber'; label = 'Fiber' }

  return [{
    root,
    relativePath,
    label: `${label} backend`,
    framework,
    type: 'backend',
    sdkPackage: 'multiplayer-go',
    readmePath: 'packages/session-recorder-browser/README.md',
    packageManager: 'go',
    alreadyInstalled: false,
    language: 'go',
  }]
}

function scanRubyProject(root: string, relativePath: string): DetectedStack[] {
  if (!fileExists(path.join(root, 'Gemfile'))) return []

  let content = ''
  try { content = fs.readFileSync(path.join(root, 'Gemfile'), 'utf-8') } catch { /* ignore */ }

  let framework: Framework = 'ruby-generic'
  let label = 'Ruby app'
  if (content.includes('rails')) { framework = 'rails'; label = 'Rails' }
  else if (content.includes('sinatra')) { framework = 'sinatra'; label = 'Sinatra' }

  return [{
    root,
    relativePath,
    label: `${label} backend`,
    framework,
    type: 'backend',
    sdkPackage: 'multiplayer-ruby',
    readmePath: 'packages/session-recorder-browser/README.md',
    packageManager: 'gem',
    alreadyInstalled: false,
    language: 'ruby',
  }]
}

function scanJvmProject(root: string, relativePath: string): DetectedStack[] {
  const hasGradle = fileExists(path.join(root, 'build.gradle')) || fileExists(path.join(root, 'build.gradle.kts'))
  const hasMaven = fileExists(path.join(root, 'pom.xml'))
  if (!hasGradle && !hasMaven) return []

  return [{
    root,
    relativePath,
    label: 'Java/Kotlin backend',
    framework: 'java-generic',
    type: 'backend',
    sdkPackage: 'multiplayer-java',
    readmePath: 'packages/session-recorder-browser/README.md',
    packageManager: hasGradle ? 'gradle' : 'maven',
    alreadyInstalled: false,
    language: hasGradle && fileExists(path.join(root, 'build.gradle.kts')) ? 'kotlin' : 'java',
  }]
}

function scanDotnetProject(root: string, relativePath: string): DetectedStack[] {
  // Check for .csproj or .sln files
  try {
    const entries = fs.readdirSync(root)
    const hasCsproj = entries.some(e => e.endsWith('.csproj'))
    const hasSln = entries.some(e => e.endsWith('.sln'))
    if (!hasCsproj && !hasSln) return []
  } catch {
    return []
  }

  return [{
    root,
    relativePath,
    label: '.NET backend',
    framework: 'aspnet',
    type: 'backend',
    sdkPackage: 'multiplayer-dotnet',
    readmePath: 'packages/session-recorder-browser/README.md',
    packageManager: 'dotnet',
    alreadyInstalled: false,
    language: 'csharp',
  }]
}

// ─── Main scan ───────────────────────────────────────────────────────────────

function scanDirectory(dir: string, scanRoot: string, depth: number): DetectedStack[] {
  if (depth > MAX_DEPTH) return []

  const relativePath = path.relative(scanRoot, dir) || '.'
  const results: DetectedStack[] = [
    ...scanJsProject(dir, relativePath),
    ...scanPythonProject(dir, relativePath),
    ...scanGoProject(dir, relativePath),
    ...scanRubyProject(dir, relativePath),
    ...scanJvmProject(dir, relativePath),
    ...scanDotnetProject(dir, relativePath),
  ]

  // If we found something at this level, don't recurse deeper (this is a project root)
  if (results.length > 0) return results

  // Recurse into subdirectories (monorepo support)
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      results.push(...scanDirectory(path.join(dir, entry.name), scanRoot, depth + 1))
    }
  } catch { /* permission errors etc */ }

  return results
}

/**
 * Build a dependency graph for all packages in a monorepo.
 * Maps package names to their internal dependencies and dependents.
 */
export function buildMonorepoGraph(dir: string, _stacks: DetectedStack[]): MonorepoGraph {
  const packages = new Map<string, { root: string; relativePath: string; deps: string[] }>()
  const allPkgJsons = new Map<string, Record<string, any>>()

  // First pass: collect all package names
  const collectPackages = (searchDir: string, depth: number) => {
    if (depth > MAX_DEPTH) return
    const pkgJsonPath = path.join(searchDir, 'package.json')
    const pkgJson = readJsonSafe(pkgJsonPath)
    if (pkgJson?.name) {
      const relativePath = path.relative(dir, searchDir) || '.'
      allPkgJsons.set(pkgJson.name, pkgJson)
      packages.set(pkgJson.name, { root: searchDir, relativePath, deps: [] })
    }
    try {
      const entries = fs.readdirSync(searchDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        collectPackages(path.join(searchDir, entry.name), depth + 1)
      }
    } catch { /* ignore */ }
  }
  collectPackages(dir, 0)

  const allPackageNames = new Set(packages.keys())

  // Second pass: build dependency edges (only internal deps)
  for (const [name, pkgJson] of allPkgJsons) {
    const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies }
    const internalDeps = Object.keys(allDeps).filter(d => allPackageNames.has(d))
    const entry = packages.get(name)
    if (entry) entry.deps = internalDeps
  }

  // Build reverse map (dependents)
  const dependents = new Map<string, string[]>()
  for (const [name, entry] of packages) {
    for (const dep of entry.deps) {
      const existing = dependents.get(dep) ?? []
      existing.push(name)
      dependents.set(dep, existing)
    }
  }

  return { packages, dependents }
}

/**
 * Enrich detected stacks with monorepo graph information.
 */
function enrichStacksWithGraph(stacks: DetectedStack[], graph: MonorepoGraph): void {
  for (const stack of stacks) {
    const pkgJson = readJsonSafe(path.join(stack.root, 'package.json'))
    if (!pkgJson?.name) continue

    stack.packageName = pkgJson.name
    stack.packageDescription = pkgJson.description

    const entry = graph.packages.get(pkgJson.name)
    if (entry) {
      stack.internalDeps = entry.deps
    }

    const deps = graph.dependents.get(pkgJson.name)
    if (deps) {
      stack.internalDependents = deps
    }
  }
}

/**
 * Scan a directory for detectable application stacks.
 * Returns a list of detected stacks with SDK recommendations.
 */
export function detectStacks(dir: string): DetectedStack[] {
  const results = scanDirectory(dir, dir, 0)

  // Deduplicate: if same root appears multiple times, keep the most specific
  const byRoot = new Map<string, DetectedStack[]>()
  for (const r of results) {
    const existing = byRoot.get(r.root) || []
    existing.push(r)
    byRoot.set(r.root, existing)
  }

  const deduped: DetectedStack[] = []
  for (const stacks of byRoot.values()) {
    // Keep all unique types per root (e.g., frontend + backend in same dir)
    const seen = new Set<string>()
    for (const s of stacks) {
      const key = `${s.type}:${s.sdkPackage}`
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(s)
      }
    }
  }

  // Build monorepo graph and enrich stacks
  const graph = buildMonorepoGraph(dir, deduped)
  enrichStacksWithGraph(deduped, graph)

  return deduped
}

/**
 * Summarize detected stacks for display.
 */
export function summarizeDetection(stacks: DetectedStack[]): {
  hasFrontend: boolean
  hasBackend: boolean
  hasMobile: boolean
  allInstalled: boolean
  needsSetup: DetectedStack[]
} {
  const hasFrontend = stacks.some(s => s.type === 'frontend' || s.type === 'fullstack')
  const hasBackend = stacks.some(s => s.type === 'backend' || s.type === 'fullstack')
  const hasMobile = stacks.some(s => s.type === 'mobile')
  const needsSetup = stacks.filter(s => !s.alreadyInstalled)
  const allInstalled = needsSetup.length === 0

  return { hasFrontend, hasBackend, hasMobile, allInstalled, needsSetup }
}
