import React, { useState, type ReactElement } from 'react'
import { stringFromInputSubmit } from '../../lib/inputSubmit.js'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { createApiService } from '../../services/api.service.js'
import type { AgentConfig } from '../../types/index.js'
import { API_URL } from '../../config.js'
import { decodeApiKeyPayload } from '../../services/radar.service.js'
import { writeProfile } from '../../cli/profile.js'

interface Props {
  config: Partial<AgentConfig>
  profileName?: string
  onComplete: (updates: Partial<AgentConfig>) => void
}

export function ApiKeyStep({ config, profileName, onComplete }: Props): ReactElement {
  const [value, setValue] = useState(config.apiKey ?? '')
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (apiKey: string) => {
    const trimmedApiKey = apiKey.trim()
    if (!trimmedApiKey) {
      return
    }

    const apiKeyPayload = decodeApiKeyPayload(trimmedApiKey)

    if (apiKeyPayload.type && apiKeyPayload.type !== 'API_KEY') {
      setError(`Invalid key type "${apiKeyPayload.type}". Please use an Agent API key from the Multiplayer dashboard (Settings → API Keys).`)
      return
    }

    const workspaceId = apiKeyPayload.workspace!
    const projectId = apiKeyPayload.project!

    const apiService = createApiService({
      url: config.url || API_URL,
      apiKey: trimmedApiKey,
    })
    setValidating(true)
    setError(null)

    apiService.fetchProject(workspaceId, projectId)
      .then((result) => {
        if (!result) {
          setValidating(false)
          setError('Invalid API key or workspace/project not found.')
          return
        }

        setValidating(false)
        const profile = profileName || process.env.MULTIPLAYER_PROFILE || 'default'
        writeProfile(profile, { apiKey: trimmedApiKey, authType: 'api_key' })
        onComplete({
          apiKey: trimmedApiKey,
          authType: 'api_key',
          workspace: workspaceId,
          project: projectId,
        })
      })
      .catch((err: any) => {
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
