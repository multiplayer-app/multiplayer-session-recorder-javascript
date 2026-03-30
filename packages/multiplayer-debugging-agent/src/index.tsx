#!/usr/bin/env node
import 'dotenv/config'
import { render } from 'ink'
import React from 'react'
import { App } from './App.js'
import { parseFlags, isCompleteConfig } from './cli/flags.js'
import { runCli } from './commands/cli.js'
import { RuntimeController } from './runtime/controller.js'
import { decodeApiKeyPayload } from './services/radar.service.js'
import { startHealthServer } from './services/health.service.js'
import type { AgentConfig } from './types/index.js'

const CLI_SUBCOMMANDS = new Set(['releases', 'deployments', 'sourcemaps'])
const firstArg = process.argv[2]

if (firstArg && CLI_SUBCOMMANDS.has(firstArg)) {
  runCli(process.argv)
} else {
  const { mode, initialConfig, healthPort, profileName } = parseFlags(process.argv)

  // Decode workspace/project from API key JWT if not already set
  if (initialConfig.apiKey && (!initialConfig.workspace || !initialConfig.project)) {
    try {
      const payload = decodeApiKeyPayload(initialConfig.apiKey)
      if (!initialConfig.workspace) initialConfig.workspace = payload.workspace
      if (!initialConfig.project) initialConfig.project = payload.project
    } catch {
      // invalid key format — startup wizard will validate
    }
  }

  if (mode === 'headless') {
    // Headless mode: validate config completeness and run without TUI
    if (!isCompleteConfig(initialConfig)) {
      process.stderr.write(
        'headless mode requires a complete config via flags or environment variables.\n' +
        'Required: --api-key, --dir, --model (and --model-key for non-Claude models)\n'
      )
      process.exit(1)
    }
    const config = initialConfig as AgentConfig
    const logger = (level: 'info' | 'error' | 'debug', msg: string) => {
      const ts = new Date().toISOString()
      const line = JSON.stringify({ ts, level, msg })
      if (level === 'error') process.stderr.write(line + '\n')
      else process.stdout.write(line + '\n')
    }

    logger('info', `Using profile: ${profileName}`)

    const controller = new RuntimeController(config, logger)

    if (healthPort) {
      const healthServer = startHealthServer(healthPort, controller)
      logger('info', `Health server listening on port ${healthPort}`)
      controller.on('quit', () => healthServer.close())
    }

    controller.on('quit', () => {
      process.exit(0)
    })

    // SIGTERM: finish active sessions before exiting (graceful k8s pod shutdown)
    // SIGINT (Ctrl-C): stop immediately
    process.on('SIGTERM', () => {
      logger('info', 'SIGTERM received — waiting for active sessions to complete')
      controller.quit('after-current')
    })
    process.on('SIGINT', () => controller.quit('now'))

    controller.connect()
  } else {
    // TUI mode (default when no arguments given)
    const { waitUntilExit } = render(React.createElement(App, { initialConfig, profileName }))

    process.on('SIGINT', () => process.exit(0))
    process.on('SIGTERM', () => process.exit(0))

    waitUntilExit().then(() => {
      // Clear the terminal after TUI exits
      process.stdout.write('\x1b[2J\x1b[H')
      process.exit(0)
    })
  }
}
