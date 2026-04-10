import { useState, useRef, type ReactElement } from 'react'
import { useKeyboard } from '@opentui/react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { stringFromInputSubmit } from '../../lib/inputSubmit.js'
import type { AgentConfig } from '../../types/index.js'
import { OAuthManager } from '../../auth/oauth-manager.js'
import { writeProfile } from '../../cli/profile.js'
import { createApiService } from '../../services/api.service.js'
import { API_URL } from '../../config.js'
import { decodeApiKeyPayload } from '../../services/radar.service.js'
import type { SelectableWorkspace } from './ProjectSelectStep.js'
import { FooterHints, SelectionList, InputField, type SelectionItem } from '../shared/index.js'

type AuthMethod = 'oauth' | 'api-token'

const OPTIONS: { id: AuthMethod; label: string; description: string }[] = [
  { id: 'oauth', label: 'Browser login (OAuth)', description: 'Opens your browser to authenticate with Multiplayer' },
  { id: 'api-token', label: 'API token', description: 'Paste a personal API key from the Multiplayer dashboard' }
]

const SELECTION_ITEMS: SelectionItem[] = OPTIONS.map((opt) => ({
  key: opt.id,
  icon: opt.id === 'oauth' ? '◆' : '◇',
  iconColor: opt.id === 'oauth' ? '#22d3ee' : '#f59e0b',
  label: opt.label,
  description: opt.description
}))

type SubStep = 'select' | 'api-key'
type OAuthState = 'idle' | 'loading' | 'waiting' | 'error'

interface Props {
  config: Partial<AgentConfig>
  url: string
  profileName?: string
  onComplete: (updates: Partial<AgentConfig> & { _oauthWorkspaces?: SelectableWorkspace[] }) => void
}

export function AuthMethodStep({ config, url, profileName, onComplete }: Props): ReactElement {
  const [subStep, setSubStep] = useState<SubStep>('select')
  const [selected, setSelected] = useState(0)
  const [oauthState, setOAuthState] = useState<OAuthState>('idle')
  const [oauthUrl, setOAuthUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const oauthManagerRef = useRef<OAuthManager | null>(null)

  // API key sub-step state
  const [apiKeyValue, setApiKeyValue] = useState(config.authType === 'api_key' ? (config.apiKey ?? '') : '')
  const [apiKeyValidating, setApiKeyValidating] = useState(false)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)

  const resetToSelect = () => {
    if (oauthManagerRef.current) {
      void oauthManagerRef.current.stopCallbackServer()
      oauthManagerRef.current = null
    }
    setSubStep('select')
    setOAuthState('idle')
    setOAuthUrl(null)
    setError(null)
    setApiKeyError(null)
    setApiKeyValidating(false)
  }

  useKeyboard((key) => {
    const { name } = key
    // API key sub-step
    if (subStep === 'api-key') {
      if (name === 'escape' && !apiKeyValidating) {
        resetToSelect()
        key.stopPropagation()
      }
      return
    }

    // Selection sub-step
    if (oauthState === 'idle') {
      if (name === 'up' || name === 'k') setSelected((s) => Math.max(0, s - 1))
      else if (name === 'down' || name === 'j') setSelected((s) => Math.min(OPTIONS.length - 1, s + 1))
      else if (name === 'return') handleConfirm()
      return
    }

    // OAuth in-progress states
    if (name === 'escape') {
      resetToSelect()
      key.stopPropagation()
    } else if (name === 'return' && oauthState === 'error') {
      startOAuth()
    }
  })

  const selectOption = (index: number) => {
    setSelected(index)
    const method = OPTIONS[index]!.id
    if (method === 'api-token') {
      setSubStep('api-key')
    } else {
      startOAuth()
    }
  }

  const handleConfirm = () => {
    selectOption(selected)
  }

  // ─── API Key ────────────────────────────────────────────────────────────────

  const handleApiKeyInput = (nextValue: string) => {
    setApiKeyValue(nextValue.replace(/\s+/g, ''))
  }

  const handleApiKeySubmit = (apiKey: string) => {
    const trimmedApiKey = apiKey.trim()
    if (!trimmedApiKey) return

    const apiKeyPayload = decodeApiKeyPayload(trimmedApiKey)

    if (apiKeyPayload.type && apiKeyPayload.type !== 'API_KEY') {
      setApiKeyError(`Invalid key type "${apiKeyPayload.type}". Please use an Agent API key from the Multiplayer dashboard (Settings → API Keys).`)
      return
    }

    const workspaceId = apiKeyPayload.workspace!
    const projectId = apiKeyPayload.project!

    const apiService = createApiService({
      url: config.url || API_URL,
      apiKey: trimmedApiKey
    })
    setApiKeyValidating(true)
    setApiKeyError(null)

    apiService
      .fetchProject(workspaceId, projectId)
      .then((result) => {
        if (!result) {
          setApiKeyValidating(false)
          setApiKeyError('Invalid API key or workspace/project not found.')
          return
        }

        setApiKeyValidating(false)
        const profile = profileName || process.env.MULTIPLAYER_PROFILE || 'default'
        writeProfile(profile, { apiKey: trimmedApiKey, authType: 'api_key' })
        onComplete({
          apiKey: trimmedApiKey,
          authType: 'api_key',
          workspace: workspaceId,
          project: projectId
        })
      })
      .catch((err: any) => {
        setApiKeyValidating(false)
        setApiKeyError(err.message)
      })
  }

  // ─── OAuth ──────────────────────────────────────────────────────────────────

  const startOAuth = () => {
    setOAuthState('loading')
    setError(null)

    void (async () => {
      try {
        const baseUrl = url.replace(/\/v\d+\/?$/, '')
        const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)
        if (!response.ok) throw new Error(`Failed to fetch OAuth config: ${response.status}`)
        const data = (await response.json()) as any
        const oauthParams = {
          authorizationServerUrl: data.issuer,
          authorizationEndpoint: data.authorization_endpoint,
          tokenEndpoint: data.token_endpoint,
          registrationEndpoint: data.registration_endpoint
        }

        const oauthManager = new OAuthManager()
        oauthManagerRef.current = oauthManager
        await oauthManager.init(oauthParams)

        setOAuthState('waiting')
        await oauthManager.authenticate((url) => setOAuthUrl(url))

        const token = await oauthManager.getAccessToken()
        if (!token) throw new Error('Authentication failed. Please try again.')

        const api = createApiService({ url, apiKey: '', bearerToken: token })
        const session = await api.fetchUserSession()
        if (!session.workspaces.length) throw new Error('No workspace found for this account')

        const workspaces: SelectableWorkspace[] = await Promise.all(
          session.workspaces.map(async (ws) => ({
            _id: ws._id,
            name: ws.name,
            projects: (await api.fetchProjects(ws._id)).filter((p) => !!p._id && !!p.name)
          }))
        )

        const profile = profileName || process.env.MULTIPLAYER_PROFILE || 'default'
        writeProfile(profile, { apiKey: token, authType: 'oauth' })

        onComplete({ apiKey: token, authType: 'oauth', _oauthWorkspaces: workspaces })
      } catch (err: any) {
        setOAuthState('error')
        setError(err.message)
      }
    })()
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (subStep === 'api-key') {
    return (
      <box flexDirection='column' gap={1}>
        <text attributes={tuiAttrs({ dim: true })}>
          Enter your Multiplayer project API key. We validate immediately and auto-load workspace/project.
        </text>
        <text attributes={tuiAttrs({ dim: true })}>
          Format usually starts with <span fg='#f59e0b'>`eyJ...`</span>
        </text>
        {apiKeyError && (
          <box>
            <text fg='#ef4444'>✗ {apiKeyError}</text>
          </box>
        )}
        {apiKeyValidating ? (
          <text fg='#f59e0b'>◌ Validating API key...</text>
        ) : (
          <InputField
            value={apiKeyValue}
            onInput={handleApiKeyInput}
            onSubmit={(p) => handleApiKeySubmit(stringFromInputSubmit(p, apiKeyValue))}
            placeholder='eyJ...'
          />
        )}
        <FooterHints hints='Enter continue · Esc back' />
      </box>
    ) as ReactElement
  }

  return (
    <box flexDirection='column' gap={1}>
      {oauthState === 'idle' && (
        <>
          <text attributes={tuiAttrs({ dim: true })}>Choose how to authenticate with Multiplayer.</text>
          <SelectionList items={SELECTION_ITEMS} selectedIndex={selected} onSelect={selectOption} />
          <FooterHints hints='↑↓ navigate · Enter select · Click to select' />
        </>
      )}

      {oauthState === 'loading' && (
        <box flexDirection='column' gap={1}>
          <text fg='#f59e0b'>◌ Setting up OAuth...</text>
          <FooterHints hints='Esc back' />
        </box>
      )}

      {oauthState === 'waiting' && (
        <box flexDirection='column' gap={1}>
          <text fg='#10b981'>✓ Browser opened — complete login in your browser.</text>
          {oauthUrl && (
            <box flexDirection='column' gap={0}>
              <text attributes={tuiAttrs({ dim: true })}>If the browser did not open, visit:</text>
              <text fg='#22d3ee'>{oauthUrl}</text>
            </box>
          )}
          <text fg='#f59e0b'>◌ Waiting for authentication...</text>
          <FooterHints hints='Esc back' />
        </box>
      )}

      {oauthState === 'error' && (
        <box flexDirection='column' gap={1}>
          <text fg='#ef4444'>✗ {error}</text>
          <FooterHints hints='Enter retry · Esc back' />
        </box>
      )}
    </box>
  ) as ReactElement
}
