import { Command } from 'commander'
import { create as createRelease } from './releases/create.js'
import { create as createDeployment } from './deployments/create.js'
import { upload as uploadSourcemap } from './sourcemaps/upload.js'
import logger from '../logger.js'

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

export function runCli(argv: string[]): void {
  const program = new Command()
  program
    .name('multiplayer')
    .description('Multiplayer CLI — manage releases, deployments, and sourcemaps')

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
        release: opts.release || process.env.VERSION,
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

  program.parse(argv)
}
