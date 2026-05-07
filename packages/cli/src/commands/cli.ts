import { Command } from 'commander'
import os from 'os'
import { create as createRelease } from './releases/create.js'
import { create as createDeployment } from './deployments/create.js'
import { upload as uploadSourcemap } from './sourcemaps/upload.js'
import { login, logout, status as authStatus } from '../services/auth.service.js'
import { startMcpServer } from './mcp.js'
import { loadProfile, writeCredentials, writeProjectSettings, findRegisteredProject, initEnvironment } from '../cli/profile.js'
import { API_URL, DEFAULT_MAX_CONCURRENT } from '../config.js'
import type { ParsedFlags } from '../cli/flags.js'
import type { RuntimeMode } from '../runtime/types.js'
import type { AgentConfig } from '../types/index.js'
import { logger } from '../logger.js'
import pkg from '../../package.json' with { type: 'json' }

function handleResult(err: Error | null, response: unknown): void {
  if (err) {
    if ((err as NodeJS.ErrnoException & { status?: number }).status) {
      logger.error('Status Code:', (err as NodeJS.ErrnoException & { status?: number }).status)
    }
    const errWithResponse = err as unknown as { response?: { text?: string } }
    if (errWithResponse.response) {
      logger.error(errWithResponse.response.text ?? '')
    } else {
      logger.error(err.message)
    }
    process.exit(1)
  } else {
    logger.info(JSON.stringify(response, null, 2))
  }
}

function exitWithError(message: string): never {
  logger.error(message)
  process.exit(1)
}

export function runCli(argv: string[], onAgent: (flags: ParsedFlags) => void): void {
  const program = new Command()
  program
    .name('multiplayer')
    .description('Multiplayer debugging agent — automatically resolves issues using AI')
    .version(pkg.version, '-v, --version', 'Output the version number')

  // agent (default)
  program
    .command('agent', { isDefault: true })
    .description('Start the debugging agent')
    .option('--headless', 'Run without TUI (structured log output, requires full config); also set via MULTIPLAYER_HEADLESS=true')
    .option('--profile <name>', 'Account to use (default: auto-detected from registered project)')
    .option('--url <url>', 'Multiplayer base API URL')
    .option('--api-key <key>', 'Multiplayer API key')
    .option('--name <name>', 'Agent name (defaults to hostname)')
    .option('--dir <path>', 'Project directory (must be a git repo)')
    .option('--model <name>', 'AI model name (e.g. claude-sonnet-4-6, gpt-4o)')
    .option('--model-key <key>', 'API key for the AI provider')
    .option('--model-url <url>', 'Optional base URL for OpenAI-compatible APIs')
    .option('--max-concurrent <n>', 'Maximum number of issues to resolve in parallel', String(DEFAULT_MAX_CONCURRENT))
    .option('--no-git-branch', 'Work in current branch — no worktree, no new branch, no push')
    .option('--skip-sdk-check', 'Skip the Multiplayer SDK installation check/setup step')
    .option('--health-port <port>', 'Port for HTTP health check endpoint (headless mode only); also set via MULTIPLAYER_HEALTH_PORT')
    .action((opts) => {
      initEnvironment(opts.url || process.env.MULTIPLAYER_URL)
      const mode: RuntimeMode = (opts.headless || process.env.MULTIPLAYER_HEADLESS === 'true') ? 'headless' : 'tui'
      const profileName: string = opts.profile || 'default'
      const explicitDir = opts.dir || process.env.MULTIPLAYER_DIR
      const registered = findRegisteredProject(explicitDir)
      const effectiveProfileName = registered?.account ?? profileName
      const profile = loadProfile(effectiveProfileName, explicitDir)
      const resolvedDir = explicitDir || profile.dir
      const initialConfig: Partial<AgentConfig> = {
        url: opts.url || process.env.MULTIPLAYER_URL || profile.url || API_URL,
        apiKey: opts.apiKey || process.env.MULTIPLAYER_API_KEY || profile.apiKey,
        authType: profile.authType,
        workspace: profile.workspace,
        project: profile.project,
        name: opts.name || process.env.MULTIPLAYER_AGENT_NAME || profile.name || os.hostname(),
        dir: resolvedDir,
        model: opts.model || process.env.AI_MODEL || profile.model,
        modelKey: opts.modelKey || process.env.AI_API_KEY || profile.modelKey,
        modelUrl: opts.modelUrl || process.env.AI_BASE_URL || profile.modelUrl,
        maxConcurrentIssues: Number(
          opts.maxConcurrent || process.env.MULTIPLAYER_MAX_CONCURRENT || profile.maxConcurrentIssues || DEFAULT_MAX_CONCURRENT,
        ),
        noGitBranch: opts.noGitBranch || process.env.MULTIPLAYER_NO_GIT_BRANCH === 'true' || profile.noGitBranch || false,
        skipSdkCheck: opts.skipSdkCheck || process.env.MULTIPLAYER_SKIP_SDK_CHECK === 'true' || profile.skipSdkCheck || false,
        sessionRecorderSetupDone: profile.sessionRecorderSetupDone || false,
        isDemoProject: registered?.demo ?? false,
        git: profile.git,
      }
      const rawHealthPort = opts.healthPort || process.env.MULTIPLAYER_HEALTH_PORT
      const healthPort = rawHealthPort ? Number(rawHealthPort) : undefined

      // Persist --url to credentials if explicitly provided and not already saved
      if (opts.url && !profile.url) {
        writeCredentials(effectiveProfileName, { url: opts.url })
      }
      // Persist --skip-sdk-check to project settings if explicitly set and dir is known
      if (opts.skipSdkCheck && !profile.skipSdkCheck && resolvedDir) {
        writeProjectSettings(resolvedDir, { skipSdkCheck: true })
      }

      onAgent({ mode, initialConfig, healthPort, profileName: effectiveProfileName })
    })

  // releases
  const releases = program.command('releases').description('Manage releases')
  releases
    .command('create')
    .description('Create a release')
    .option('--api-key <key>', 'Multiplayer personal user API key (MULTIPLAYER_API_KEY)')
    .option('--service <name>', 'Service name (SERVICE_NAME)')
    .option('--release-version <version>', 'Release version (RELEASE)')
    .option('--commit-hash <hash>', 'Commit hash (COMMIT_HASH)')
    .option('--repository-url <url>', 'Repository URL (REPOSITORY_URL)')
    .option('--release-notes <notes>', '[Optional] Release notes (RELEASE_NOTES)')
    .option('--base-url <url>', '[Optional] Base URL (BASE_URL)')
    .action((opts) => {
      const options = {
        apiKey: opts.apiKey || process.env.MULTIPLAYER_API_KEY,
        service: opts.service || process.env.SERVICE_NAME,
        release: opts.releaseVersion || process.env.RELEASE,
        commitHash: opts.commitHash || process.env.COMMIT_HASH,
        repositoryUrl: opts.repositoryUrl || process.env.REPOSITORY_URL,
        releaseNotes: opts.releaseNotes || process.env.RELEASE_NOTES,
        baseUrl: opts.baseUrl || process.env.BASE_URL,
      }
      if (!options.apiKey) exitWithError('A Multiplayer personal user API key is required.')
      if (!options.service) exitWithError('A service name is required.')
      if (!options.release) exitWithError('A release is required.')
      createRelease(options as Parameters<typeof createRelease>[0], handleResult)
    })

  // deployments
  const deployments = program.command('deployments').description('Manage deployments')
  deployments
    .command('create')
    .description('Create a deployment')
    .option('--api-key <key>', 'Multiplayer personal user API key (MULTIPLAYER_API_KEY)')
    .option('--service <name>', 'Service name (SERVICE_NAME)')
    .option('--release <version>', 'Service release (RELEASE)')
    .option('--environment <name>', 'Environment name (ENVIRONMENT)')
    .option('--base-url <url>', '[Optional] Base URL (BASE_URL)')
    .action((opts) => {
      const options = {
        apiKey: opts.apiKey || process.env.MULTIPLAYER_API_KEY,
        service: opts.service || process.env.SERVICE_NAME,
        release: opts.release || process.env.RELEASE,
        environment: opts.environment || process.env.ENVIRONMENT,
        baseUrl: opts.baseUrl || process.env.BASE_URL,
      }
      if (!options.apiKey) exitWithError('A Multiplayer personal user API key is required.')
      if (!options.service) exitWithError('A service name is required.')
      if (!options.release) exitWithError('A version is required.')
      if (!options.environment) exitWithError('An environment is required.')
      createDeployment(options as Parameters<typeof createDeployment>[0], handleResult)
    })

  // sourcemaps
  const sourcemaps = program.command('sourcemaps').description('Manage sourcemaps')
  sourcemaps
    .command('upload <directories...>')
    .description('Upload sourcemaps from one or more directories')
    .option('--api-key <key>', 'Multiplayer personal user API key (MULTIPLAYER_API_KEY)')
    .option('--service <name>', 'Service name (SERVICE_NAME)')
    .option('--release <version>', 'Service release (RELEASE)')
    .option('--base-url <url>', '[Optional] Base URL (BASE_URL)')
    .action((directories: string[], opts) => {
      const options = {
        apiKey: opts.apiKey || process.env.MULTIPLAYER_API_KEY,
        service: opts.service || process.env.SERVICE_NAME,
        release: opts.release || process.env.RELEASE,
        baseUrl: opts.baseUrl || process.env.BASE_URL,
      }
      if (!options.apiKey) exitWithError('A Multiplayer personal user API key is required.')
      if (!options.service) exitWithError('A service name is required.')
      if (!options.release) exitWithError('A release is required.')
      uploadSourcemap(directories, options as Parameters<typeof uploadSourcemap>[1], handleResult)
    })

  // auth
  const auth = program.command('auth').description('Authenticate with Multiplayer')
  auth
    .command('login')
    .description('Log in via browser OAuth flow')
    .option('--url <url>', 'Multiplayer API base URL')
    .option('--profile <name>', 'Config profile to save credentials into')
    .action(async (opts) => {
      const url = opts.url || process.env.MULTIPLAYER_URL
      initEnvironment(url)
      try {
        await login({ url, profileName: opts.profile })
      } catch (err: any) {
        exitWithError(err.message)
      }
    })
  auth
    .command('logout')
    .description('Log out and clear stored credentials')
    .option('--url <url>', 'Multiplayer API base URL')
    .option('--profile <name>', 'Config profile to log out from')
    .action((opts) => {
      initEnvironment(opts.url || process.env.MULTIPLAYER_URL)
      logout(opts.profile || 'default')
    })
  auth
    .command('status')
    .description('Check authentication status')
    .option('--url <url>', 'Multiplayer API base URL')
    .option('--profile <name>', 'Config profile to check')
    .action(async (opts) => {
      initEnvironment(opts.url || process.env.MULTIPLAYER_URL)
      try {
        await authStatus(opts.profile || 'default')
      } catch (err: any) {
        exitWithError(err.message)
      }
    })

  // mcp
  program
    .command('mcp')
    .description('Start an MCP server over stdio for AI agent integration')
    .action(async () => {
      try {
        await startMcpServer()
      } catch (err: any) {
        exitWithError(err.message)
      }
    })

  program.parse(argv)
}
