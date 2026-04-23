import { useEffect, useState, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import * as AiService from '../../services/ai.service.js'
import * as GitService from '../../services/git.service.js'
import { validateApiKey } from '../../services/radar.service.js'
import { StatusIcon, FooterHints } from '../shared/index.js'

interface Props {
  config: AgentConfig
  onComplete: (config: AgentConfig) => void
  onBack?: () => void
}

type Status = 'checking-api-key' | 'checking-git' | 'checking-ai' | 'done' | 'error'

export function ConnectingStep({ config, onComplete, onBack }: Props): ReactElement {
  const [status, setStatus] = useState<Status>('checking-api-key')
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState(0)

  useKeyboard(({ name }) => {
    if (name === 'escape' && status === 'error') onBack?.()
    if (name === 'return' && status === 'error') {
      setError(null)
      setStatus('checking-api-key')
      setRunId((v) => v + 1)
    }
  })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        if (cancelled) return
        setStatus('checking-api-key')
        const { workspace, project } = await validateApiKey(config.url, config.apiKey)
        if (!config.workspace) config.workspace = workspace
        if (!config.project) config.project = project

        if (cancelled) return
        setStatus('checking-git')
        const isGit = await GitService.isGitRepo(config.dir)
        if (!isGit) throw new Error(`Not a git repository: ${config.dir}`)

        if (cancelled) return
        setStatus('checking-ai')
        const isClaudeModel = config.model === 'claude-code' || config.model.startsWith('claude')
        if (isClaudeModel) {
          await AiService.checkClaudeRequirements()
        } else {
          await AiService.checkOpenAiRequirements(config.modelKey, config.modelUrl)
        }

        if (cancelled) return
        setStatus('done')
        await new Promise((r) => setTimeout(r, 400))
        if (cancelled) return
        onComplete(config)
      } catch (err: unknown) {
        if (cancelled) return
        setStatus('error')
        setError((err as Error).message)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [runId])

  const apiKeyPassed =
    status !== 'checking-api-key' &&
    !(status === 'error' && !error?.includes('git') && !error?.includes('AI') && !error?.includes('model'))
  const apiKeyStatus =
    status === 'checking-api-key'
      ? ('loading' as const)
      : status === 'error' && !apiKeyPassed
        ? ('error' as const)
        : ('success' as const)

  const gitStarted =
    (status !== 'checking-api-key' && status !== 'error') ||
    (status === 'error' && (error?.includes('git') || apiKeyPassed))
  const gitStatus = !gitStarted
    ? ('idle' as const)
    : status === 'checking-git'
      ? ('loading' as const)
      : status === 'error' && error?.includes('git')
        ? ('error' as const)
        : ('success' as const)

  const aiStatus =
    status === 'checking-ai' ? ('loading' as const) : status === 'error' ? ('error' as const) : ('success' as const)

  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Starting Agent</text>
      <box flexDirection='column' marginTop={1} gap={0}>
        <box gap={2}>
          <StatusIcon status={apiKeyStatus} />
          <text>API key</text>
          {status === 'checking-api-key' && <text attributes={tuiAttrs({ dim: true })}>validating...</text>}
        </box>
        <box gap={2}>
          <StatusIcon status={gitStatus} />
          <text>Git repository</text>
          {status === 'checking-git' && <text attributes={tuiAttrs({ dim: true })}>checking...</text>}
        </box>
        {status !== 'checking-api-key' && status !== 'checking-git' && (
          <box gap={2}>
            <StatusIcon status={aiStatus} />
            <text>AI provider</text>
            {status === 'checking-ai' && <text attributes={tuiAttrs({ dim: true })}>checking...</text>}
          </box>
        )}
        {status === 'done' && (
          <box gap={2} marginTop={1}>
            <StatusIcon status='success' />
            <text fg='#10b981'>All checks passed — connecting to Radar</text>
          </box>
        )}
      </box>
      {error && (
        <box flexDirection='column' gap={1} marginTop={1}>
          <text fg='#ef4444'>✗ {error}</text>
          <FooterHints hints='Enter retry · Esc back' />
        </box>
      )}
    </box>
  ) as ReactElement
}
