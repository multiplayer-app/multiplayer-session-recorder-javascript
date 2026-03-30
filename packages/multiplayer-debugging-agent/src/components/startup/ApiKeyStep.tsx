import React, { useState } from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { validateApiKey } from '../../services/radar.service.js'
import type { AgentConfig } from '../../types/index.js'

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

export const ApiKeyStep: React.FC<Props> = ({ config, onComplete }) => {
  const [value, setValue] = useState(config.apiKey ?? '')
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) return

    const url = config.url || 'https://api.multiplayer.app/v0'
    setValidating(true)
    setError(null)

    validateApiKey(url, trimmed)
      .then(({ workspace, project }) => {
        setValidating(false)
        onComplete({ apiKey: trimmed, workspace, project })
      })
      .catch((err: Error) => {
        setValidating(false)
        setError(err.message)
      })
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>
        Enter your Multiplayer project API key. We validate immediately and auto-load workspace/project.
      </Text>
      <Text dimColor>Format usually starts with `eyJ...`</Text>
      {error && (
        <Box>
          <Text color="red">✗ {error}</Text>
        </Box>
      )}
      {validating ? (
        <Text color="yellow">○ Validating API key...</Text>
      ) : (
        <Box>
          <Text color="cyan">{'› '}</Text>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder="eyJ..."
            mask="*"
          />
        </Box>
      )}
      <Text dimColor>Press Enter to continue</Text>
    </Box>
  )
}
