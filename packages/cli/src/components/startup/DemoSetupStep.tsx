import { useEffect, useState, type ReactElement } from 'react'
import { useKeyboard } from '@opentui/react'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { AgentConfig } from '../../types/index.js'
import { createApiService } from '../../services/api.service.js'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { FooterHints, StatusIcon } from '../shared/index.js'

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
  onBack?: () => void
}

type Status = 'preparing' | 'done' | 'error'

function updateEnvFile(filePath: string, updates: Record<string, string>): void {
  let content = ''
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8')
  } else {
    const examplePath = `${filePath}.example`
    content = fs.existsSync(examplePath) ? fs.readFileSync(examplePath, 'utf-8') : ''
  }

  const lines = content.split(/\r?\n/)
  const updated = new Set<string>()
  const nextLines = lines.map((line) => {
    const match = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=).*$/)
    if (!match) return line

    const [, prefix = '', name, separator = '='] = match
    if (!name || !(name in updates)) return line

    updated.add(name)
    return `${prefix}${name}${separator}${updates[name]}`
  })

  for (const [name, value] of Object.entries(updates)) {
    if (!updated.has(name)) nextLines.push(`${name}=${value}`)
  }

  while (nextLines.length > 0 && nextLines[nextLines.length - 1] === '') nextLines.pop()
  fs.writeFileSync(filePath, `${nextLines.join('\n')}\n`, 'utf-8')
}

export function DemoSetupStep({ config, onComplete, onBack }: Props): ReactElement {
  const [status, setStatus] = useState<Status>('preparing')
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState(0)

  useKeyboard(({ name }) => {
    if (name === 'return' && status === 'error') {
      setError(null)
      setStatus('preparing')
      setRunId((v) => v + 1)
    } else if (name === 'escape' && status === 'error') {
      onBack?.()
    }
  })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const { dir, url, apiKey, workspace, project } = config
        if (!dir) throw new Error('Demo project directory is missing')
        if (!url || !apiKey || !workspace || !project) {
          throw new Error('Workspace, project, and API key are required before configuring the demo app')
        }

        const api = createApiService({ url, apiKey })
        const suffix = crypto.randomBytes(3).toString('hex')

        if (cancelled) return
        setStatus('preparing')
        const frontend = await api.createIntegration(workspace, project, `session-recorder-demo-frontend-${suffix}`)
        if (cancelled) return

        const backend = await api.createIntegration(workspace, project, `session-recorder-demo-backend-${suffix}`)
        if (cancelled) return

        updateEnvFile(path.join(dir, 'client', '.env'), {
          VITE_ENVIRONMENT: 'development',
          VITE_MULTIPLAYER_SDK_API_KEY: frontend.otel.apiKey
        })
        updateEnvFile(path.join(dir, 'server', '.env'), {
          MULTIPLAYER_SDK_API_KEY: backend.otel.apiKey,
          ENVIRONMENT: 'development',
          NODE_ENV: 'development'
        })

        if (cancelled) return
        setStatus('done')
        onComplete({ demoSetupDone: true, sessionRecorderSetupDone: true })
      } catch (err: unknown) {
        if (cancelled) return
        setError((err as Error).message)
        setStatus('error')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [runId])

  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Preparing Demo App</text>
      <box flexDirection='row' gap={2} marginTop={1}>
        <StatusIcon status={status === 'error' ? 'error' : status === 'done' ? 'success' : 'loading'} />
        <text>Configuring the cloned demo app...</text>
      </box>
      <text attributes={tuiAttrs({ dim: true })}>This may take a few seconds.</text>

      {error && (
        <box flexDirection='column' gap={1} marginTop={1}>
          <text fg='#ef4444'>✗ {error}</text>
          <FooterHints hints='Enter retry · Esc back' />
        </box>
      )}
    </box>
  ) as ReactElement
}
