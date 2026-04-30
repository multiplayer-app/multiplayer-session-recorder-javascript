#!/usr/bin/env bun
import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import React from 'react'
import { App } from './App.js'
import { isCompleteConfig } from './cli/flags.js'
import { runCli } from './commands/cli.js'
import { RuntimeController } from './runtime/controller.js'
import { decodeApiKeyPayload, validateApiKey } from './services/radar.service.js'
import { getOAuthParams } from './services/auth.service.js'
import { OAuthManager } from './auth/oauth-manager.js'

import { startHealthServer } from './services/health.service.js'
import type { AgentConfig } from './types/index.js'
import type { ParsedFlags } from './cli/flags.js'

runCli(process.argv, ({ mode, initialConfig, healthPort, profileName }: ParsedFlags) => {
  void (async () => {
    // For OAuth profiles, refresh the access token if expired and start a background
    // refresh timer so long-running agents never hit the 1-hour expiry mid-session.
    let stopTokenRefresh: (() => void) | undefined
    if (initialConfig.authType === 'oauth' && initialConfig.url) {
      try {
        const oauthManager = new OAuthManager(profileName)
        try {
          const oauthParams = await getOAuthParams(initialConfig.url)
          oauthManager.loadParams(oauthParams)
        } catch {
          // Network unavailable — proceed with cached params
        }
        const freshToken = await oauthManager.getAccessToken()
        if (freshToken) initialConfig.apiKey = freshToken
        // Mutate initialConfig.apiKey in place so every part of the running agent
        // (HTTP calls, socket reconnects) automatically picks up the new token.
        stopTokenRefresh = oauthManager.scheduleRefresh((newToken) => {
          initialConfig.apiKey = newToken
        })
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

        const controller = new RuntimeController(config, logger)

        if (healthPort) {
          const healthServer = startHealthServer(healthPort, controller)
          logger('info', `Health server listening on port ${healthPort}`)
          controller.on('quit', () => healthServer.close())
        }

        controller.on('quit', () => {
          process.exit(0)
        })

        process.on('SIGTERM', () => {
          stopTokenRefresh?.()
          logger('info', 'SIGTERM received — waiting for active sessions to complete')
          controller.quit('after-current')
        })
        process.on('SIGINT', () => {
          stopTokenRefresh?.()
          controller.quit('now')
        })

        controller.connect()
      })()
    } else {
      void (async () => {
        const renderer = await createCliRenderer({
          exitOnCtrlC: false,
          targetFps: 60,
          screenMode: 'alternate-screen',
          consoleMode: 'console-overlay',
        })

        const exitApp = () => {
        // stop() only halts the loop; destroy() restores tty (raw mode, mouse, alt screen).
          renderer.destroy()
          process.exit(0)
        }

        process.on('SIGINT', exitApp)
        process.on('SIGTERM', exitApp)

        createRoot(renderer).render(
          React.createElement(App, { initialConfig, profileName, onExit: exitApp }),
        )

        renderer.start()
      })()
    }
  })()
})
