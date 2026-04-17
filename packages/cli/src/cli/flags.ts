import { Command, CommanderError } from 'commander'
import os from 'os'
import type { RuntimeMode } from '../runtime/types.js'
import type { AgentConfig } from '../types/index.js'
import { loadProfile } from './profile.js'
import { API_URL, DEFAULT_MAX_CONCURRENT } from '../config.js'
import pkg from '../../package.json' with { type: 'json' }

export interface ParsedFlags {
  mode: RuntimeMode
  initialConfig: Partial<AgentConfig>
  healthPort?: number
  profileName: string
}

export function parseFlags(argv: string[]): ParsedFlags {
  const program = new Command()

  program
    .name('multiplayer')
    .description('Multiplayer debugging agent — automatically resolves issues using AI')
    .version(pkg.version, '-v, --version', 'Output the version number')
    .option('--headless', 'Run without TUI (structured log output, requires full config); also set via MULTIPLAYER_HEADLESS=true')
    .option('--profile <name>', 'Config profile to use from .multiplayer/config (default: "default"); also set via MULTIPLAYER_PROFILE')
    .option('--url <url>', 'Multiplayer base API URL')
    .option('--api-key <key>', 'Multiplayer API key')
    .option('--name <name>', 'Agent name (defaults to hostname)')
    .option('--dir <path>', 'Project directory (must be a git repo)')
    .option('--model <name>', 'AI model name (e.g. claude-sonnet-4-6, gpt-4o)')
    .option('--model-key <key>', 'API key for the AI provider')
    .option('--model-url <url>', 'Optional base URL for OpenAI-compatible APIs')
    .option(
      '--max-concurrent <n>',
      'Maximum number of issues to resolve in parallel',
      String(DEFAULT_MAX_CONCURRENT),
    )
    .option('--no-git-branch', 'Work in current branch — no worktree, no new branch, no push')
    .option('--health-port <port>', 'Port for HTTP health check endpoint (headless mode only); also set via MULTIPLAYER_HEALTH_PORT')
    .addHelpText('after', `
Subcommands:
  releases create     Create a release
  deployments create  Create a deployment
  sourcemaps upload   Upload sourcemaps from one or more directories

Run 'multiplayer <subcommand> --help' for subcommand usage.`)
    .exitOverride()

  try {
    program.parse(argv)
  } catch (err) {
    if (err instanceof CommanderError) {
      process.exit(err.exitCode)
    }
    throw err
  }

  const opts = program.opts()
  const mode: RuntimeMode = (opts.headless || process.env.MULTIPLAYER_HEADLESS === 'true') ? 'headless' : 'tui'

  // Resolve profile: flag > env var > "default"
  const profileName: string = opts.profile || process.env.MULTIPLAYER_PROFILE || 'default'

  // Load profile from .multiplayer/config (project dir first, then home dir).
  // Use --dir or MULTIPLAYER_DIR as the project dir hint when searching.
  const projectDirHint = opts.dir || process.env.MULTIPLAYER_DIR
  const profile = loadProfile(profileName, projectDirHint)

  // CLI flags and env vars take precedence over profile values.
  const initialConfig: Partial<AgentConfig> = {
    url: opts.url || process.env.MULTIPLAYER_URL || profile.url || API_URL,
    apiKey: opts.apiKey || process.env.MULTIPLAYER_API_KEY || profile.apiKey,
    authType: profile.authType,
    workspace: profile.workspace,
    project: profile.project,
    name: opts.name || process.env.MULTIPLAYER_AGENT_NAME || profile.name || os.hostname(),
    dir: opts.dir || process.env.MULTIPLAYER_DIR || profile.dir,
    model: opts.model || process.env.AI_MODEL || profile.model,
    modelKey: opts.modelKey || process.env.AI_API_KEY || profile.modelKey,
    modelUrl: opts.modelUrl || process.env.AI_BASE_URL || profile.modelUrl,
    maxConcurrentIssues: Number(
      opts.maxConcurrent || process.env.MULTIPLAYER_MAX_CONCURRENT || profile.maxConcurrentIssues || DEFAULT_MAX_CONCURRENT,
    ),
    noGitBranch: opts.noGitBranch || process.env.MULTIPLAYER_NO_GIT_BRANCH === 'true' || profile.noGitBranch || false,
  }

  const rawHealthPort = opts.healthPort || process.env.MULTIPLAYER_HEALTH_PORT
  const healthPort = rawHealthPort ? Number(rawHealthPort) : undefined

  return { mode, initialConfig, healthPort, profileName }
}

export function isCompleteConfig(cfg: Partial<AgentConfig>): cfg is AgentConfig {
  const needsModelKey = cfg.model ? !cfg.model.startsWith('claude') : true
  return !!(
    cfg.url &&
    cfg.apiKey &&
    cfg.dir &&
    cfg.model &&
    (!needsModelKey || cfg.modelKey)
  )
}
