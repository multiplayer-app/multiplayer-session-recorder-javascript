import React, { useEffect, useState, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import * as AiService from '../../services/ai.service.js'
import * as GitService from '../../services/git.service.js'

interface Props {
  config: AgentConfig
  onComplete: (config: AgentConfig) => void
  onBack?: () => void
}

type Status = 'checking-git' | 'checking-ai' | 'done' | 'error'

export function ConnectingStep({ config, onComplete, onBack }: Props): ReactElement {
  const [status, setStatus] = useState<Status>('checking-git')
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState(0)

  useKeyboard(({ name }) => {
    if (name === 'escape' && status === 'error') onBack?.()
    if (name === 'return' && status === 'error') {
      setError(null)
      setStatus('checking-git')
      setRunId((v) => v + 1)
    }
  })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
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
    return () => { cancelled = true }
  }, [runId]) // eslint-disable-line react-hooks/exhaustive-deps

  const gitColor =
    status === 'checking-git' ? '#f59e0b'
    : status === 'error' && error?.includes('git') ? '#ef4444'
    : '#10b981'
  const gitSymbol =
    status === 'checking-git' ? '◌'
    : status === 'error' && error?.includes('git') ? '✕'
    : '✓'

  return (
    <box flexDirection="column" gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>Starting Agent</text>
      <box flexDirection="column" marginTop={1} gap={0}>
        <box gap={2}>
          <text fg={gitColor}>{gitSymbol}</text>
          <text>Git repository</text>
          {status === 'checking-git' && <text attributes={tuiAttrs({ dim: true })}>checking...</text>}
        </box>
        {status !== 'checking-git' && (
          <box gap={2}>
            <text fg={status === 'checking-ai' ? '#f59e0b' : status === 'error' ? '#ef4444' : '#10b981'}>
              {status === 'checking-ai' ? '◌' : status === 'error' ? '✕' : '✓'}
            </text>
            <text>AI provider</text>
            {status === 'checking-ai' && <text attributes={tuiAttrs({ dim: true })}>checking...</text>}
          </box>
        )}
        {status === 'done' && (
          <box gap={2} marginTop={1}>
            <text fg="#10b981">✓</text>
            <text fg="#10b981">All checks passed — connecting to Radar</text>
          </box>
        )}
      </box>
      {error && (
        <box flexDirection="column" gap={1} marginTop={1}>
          <text fg="#ef4444">✗ {error}</text>
          <text attributes={tuiAttrs({ dim: true })}>Enter retry  ·  Esc back</text>
        </box>
      )}
    </box>
  ) as ReactElement
}
