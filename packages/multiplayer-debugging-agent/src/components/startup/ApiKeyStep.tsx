import React, { useState, type ReactElement } from 'react'
import { stringFromInputSubmit } from '../../lib/inputSubmit.js'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { validateApiKey } from '../../services/radar.service.js'
import type { AgentConfig } from '../../types/index.js'

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

export function ApiKeyStep({ config, onComplete }: Props): ReactElement {
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
    <box flexDirection="column" gap={1}>
      <text attributes={tuiAttrs({ dim: true })}>
        Enter your Multiplayer project API key. We validate immediately and auto-load workspace/project.
      </text>
      <text attributes={tuiAttrs({ dim: true })}>Format usually starts with <span fg="#f59e0b">`eyJ...`</span></text>
      {error && (
        <box>
          <text fg="#ef4444">✗ {error}</text>
        </box>
      )}
      {validating ? (
        <text fg="#f59e0b">◌ Validating API key...</text>
      ) : (
        <box
          border={true}
          borderStyle="rounded"
          borderColor="#22d3ee"
          padding={1}
          flexDirection="row"
          gap={1}
        >
          <text fg="#22d3ee">❯</text>
          <input
            width={50}
            value={value}
            onInput={setValue}
            onSubmit={(p) => handleSubmit(stringFromInputSubmit(p, value))}
            placeholder="eyJ..."
            focusedBackgroundColor="transparent"
          />
        </box>
      )}
      <text attributes={tuiAttrs({ dim: true })}>Press Enter to continue</text>
    </box>
  ) as ReactElement
}
