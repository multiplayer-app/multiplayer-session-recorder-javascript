#!/usr/bin/env bun
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import React from 'react'
import { App } from './App.js'
import { isCompleteConfig } from './cli/flags.js'
import { runCli } from './commands/cli.js'
import { RuntimeController } from './runtime/controller.js'
import { decodeApiKeyPayload, validateApiKey } from './services/radar.service.js'
import { refreshOAuthTokenIfNeeded } from './services/auth.service.js'

import { startHealthServer } from './services/health.service.js'
import { logToTui } from './lib/tuiSink.js'
import type { AgentConfig } from './types/index.js'
import type { ParsedFlags } from './cli/flags.js'

runCli(process.argv, ({ mode, initialConfig, healthPort, profileName }: ParsedFlags) => {
  void (async () => {
    // For OAuth profiles, silently refresh the access token if it has expired
    if (initialConfig.authType === 'oauth' && initialConfig.url) {
      try {
        const freshToken = await refreshOAuthTokenIfNeeded(initialConfig.url, profileName)
        if (freshToken) {
          initialConfig.apiKey = freshToken
        }
      } catch {
        // Non-fatal — proceed with stored token; validation will surface the error
      }
    }

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
      if (!isCompleteConfig(initialConfig)) {
        process.stderr.write(
          'headless mode requires a complete config via flags or environment variables.\n' +
          'Required: --api-key, --dir, --model (and --model-key for non-Claude models)\n',
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

      void (async () => {
        try {
          const { workspace, project } = await validateApiKey(config.url, config.apiKey)
          if (!config.workspace) config.workspace = workspace
          if (!config.project) config.project = project
        } catch (err: unknown) {
          process.stderr.write(`API key validation failed: ${(err as Error).message}\n`)
          process.exit(1)
        }

        const getToken = config.authType === 'oauth'
          ? async () => (await refreshOAuthTokenIfNeeded(config.url, profileName)) ?? config.apiKey
          : undefined
        const controller = new RuntimeController(config, logger, getToken)

        if (healthPort) {
          const healthServer = startHealthServer(healthPort, controller)
          logger('info', `Health server listening on port ${healthPort}`)
          controller.on('quit', () => healthServer.close())
        }

        controller.on('quit', () => {
          process.exit(0)
        })

        process.on('SIGTERM', () => {
          logger('info', 'SIGTERM received — waiting for active sessions to complete')
          controller.quit('after-current')
        })
        process.on('SIGINT', () => controller.quit('now'))
        process.on('SIGHUP', () => controller.quit('now'))

        controller.connect()
      })()
    } else {
      void (async () => {
        process.on('uncaughtException', (err: Error) => {
          logToTui('error', `Uncaught exception: ${err.message}`)
        })
        process.on('unhandledRejection', (reason: unknown) => {
          const msg = reason instanceof Error ? reason.message : String(reason)
          logToTui('error', `Unhandled rejection: ${msg}`)
        })

        const renderer = await createCliRenderer({
          exitOnCtrlC: false,
          targetFps: 60,
          screenMode: 'alternate-screen',
          // Keep 'console-overlay' so console.log/error are captured rather
          // than writing through to stdout (which would corrupt the
          // alt-screen). Disable auto-open on error: surface errors through
          // LogsDock instead (see src/lib/tuiSink.ts) — the overlay has no
          // close affordance in our TUI.
          consoleMode: 'console-overlay',
          openConsoleOnError: false,
        })

        let beforeExit: (() => void) | null = null
        const exitApp = () => {
          // Disconnect the socket synchronously so the server gets a clean close frame
          // before the process terminates (covers SIGHUP / terminal close).
          beforeExit?.()
          // stop() only halts the loop; destroy() restores tty (raw mode, mouse, alt screen).
          renderer.destroy()
          process.exit(0)
        }

        process.on('SIGHUP', exitApp)
        process.on('SIGINT', exitApp)
        process.on('SIGTERM', exitApp)

        createRoot(renderer).render(
          React.createElement(App, {
            initialConfig,
            profileName,
            onExit: exitApp,
            onRegisterBeforeExit: (fn) => { beforeExit = fn },
          }),
        )

        renderer.start()
      })()
    }
  })()
})
