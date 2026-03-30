import React, { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { AgentConfig } from '../../types/index.js'
import * as AiService from '../../services/ai.service.js'
import * as GitService from '../../services/git.service.js'

interface Props {
  config: AgentConfig
  onComplete: (config: AgentConfig) => void
  onBack?: () => void
}

type Status = 'checking-git' | 'checking-ai' | 'done' | 'error'

export const ConnectingStep: React.FC<Props> = ({ config, onComplete, onBack }) => {
  const [status, setStatus] = useState<Status>('checking-git')
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState(0)

  useInput((_, key) => {
    if (key.escape && status === 'error') {
      onBack?.()
    }
    if (key.return && status === 'error') {
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
        if (!isGit) {
          throw new Error(`Not a git repository: ${config.dir}`)
        }

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
        // Brief pause so the user sees the success state
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
  }, [runId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Starting Agent</Text>
      <Box flexDirection="column" marginTop={1} gap={0}>
        <Box gap={2}>
          <Text color={status === 'checking-git' ? 'yellow' : status === 'error' && error?.includes('git') ? 'red' : 'green'}>
            {status === 'checking-git' ? '○' : status === 'error' && error?.includes('git') ? '✗' : '✓'}
          </Text>
          <Text>Git repository</Text>
          {status === 'checking-git' && <Text dimColor>checking...</Text>}
        </Box>
        {status !== 'checking-git' && (
          <Box gap={2}>
            <Text color={status === 'checking-ai' ? 'yellow' : status === 'error' ? 'red' : 'green'}>
              {status === 'checking-ai' ? '○' : status === 'error' ? '✗' : '✓'}
            </Text>
            <Text>AI provider</Text>
            {status === 'checking-ai' && <Text dimColor>checking...</Text>}
          </Box>
        )}
        {status === 'done' && (
          <Box gap={2} marginTop={1}>
            <Text color="green">✓</Text>
            <Text color="green">All checks passed — connecting to Radar</Text>
          </Box>
        )}
      </Box>
      {error && (
        <Box flexDirection="column" gap={1} marginTop={1}>
          <Text color="red">✗ {error}</Text>
          <Text dimColor>Enter retry  ·  Esc back</Text>
        </Box>
      )}
    </Box>
  )
}
