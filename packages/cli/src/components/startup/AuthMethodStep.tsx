import { useState, type ReactElement } from 'react'
import { useKeyboard } from '@opentui/react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { OAuthManager } from '../../auth/oauth-manager.js'
import { BASE_API_URL, API_URL } from '../../config.js'
import { writeProfile } from '../../cli/profile.js'
import { createApiService } from '../../services/api.service.js'
import type { SelectableWorkspace } from './ProjectSelectStep.js'

type AuthMethod = 'oauth' | 'api-token'

const OPTIONS: { id: AuthMethod; label: string; description: string }[] = [
  { id: 'oauth', label: 'Browser login (OAuth)', description: 'Opens your browser to authenticate with Multiplayer' },
  { id: 'api-token', label: 'API token', description: 'Paste a personal API key from the Multiplayer dashboard' }
]

type OAuthState = 'idle' | 'loading' | 'waiting' | 'error'

interface Props {
  profileName?: string
  onComplete: (updates: Partial<AgentConfig> & { _oauthWorkspaces?: SelectableWorkspace[] }) => void
}

export function AuthMethodStep({ profileName, onComplete }: Props): ReactElement {
  const [selected, setSelected] = useState(0)
  const [oauthState, setOAuthState] = useState<OAuthState>('idle')
  const [oauthUrl, setOAuthUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useKeyboard(({ name }) => {
    if (oauthState !== 'idle') return

    if (name === 'up' || name === 'k') setSelected((s) => Math.max(0, s - 1))
    else if (name === 'down' || name === 'j') setSelected((s) => Math.min(OPTIONS.length - 1, s + 1))
    else if (name === 'return') handleConfirm()
  })

  const handleConfirm = () => {
    const method = OPTIONS[selected]!.id
    if (method === 'api-token') {
      onComplete({ _authMethod: 'api-token' } as any)
    } else {
      startOAuth()
    }
  }

  const startOAuth = () => {
    setOAuthState('loading')
    setError(null)

    void (async () => {
      try {
        const response = await fetch(`${BASE_API_URL}/.well-known/oauth-authorization-server`)
        if (!response.ok) throw new Error(`Failed to fetch OAuth config: ${response.status}`)
        const data = (await response.json()) as any
        const oauthParams = {
          authorizationServerUrl: data.issuer,
          authorizationEndpoint: data.authorization_endpoint,
          tokenEndpoint: data.token_endpoint,
          registrationEndpoint: data.registration_endpoint
        }

        const oauthManager = new OAuthManager()
        await oauthManager.init(oauthParams)

        setOAuthState('waiting')
        await oauthManager.authenticate((url) => setOAuthUrl(url))

        const token = await oauthManager.getAccessToken()
        if (!token) throw new Error('Authentication failed. Please try again.')

        // OAuth tokens don't embed workspace/project — fetch all for user selection
        const api = createApiService({ url: API_URL, apiKey: '', bearerToken: token })
        const session = await api.fetchUserSession()
        if (!session.workspaces.length) throw new Error('No workspace found for this account')

        const workspaces: SelectableWorkspace[] = await Promise.all(
          session.workspaces.map(async (ws) => ({
            _id: ws._id,
            name: ws.name,
            projects: await api.fetchProjects(ws._id),
          })),
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

  return (
    <box flexDirection='column' gap={1}>
      {oauthState === 'idle' && (
        <>
          <text attributes={tuiAttrs({ dim: true })}>Choose how to authenticate with Multiplayer.</text>
          <box flexDirection='column' gap={1} marginTop={1}>
            {OPTIONS.map((opt, i) => {
              const isCurrent = i === selected
              return (
                <box key={opt.id} flexDirection='row' gap={1}>
                  <text fg={isCurrent ? '#22d3ee' : '#6b7280'}>{isCurrent ? '❯' : ' '}</text>
                  <box flexDirection='column'>
                    <text fg={isCurrent ? '#22d3ee' : undefined} attributes={tuiAttrs({ bold: isCurrent })}>
                      {opt.label}
                    </text>
                    <text attributes={tuiAttrs({ dim: true })}>{opt.description}</text>
                  </box>
                </box>
              )
            })}
          </box>
          <text attributes={tuiAttrs({ dim: true })} marginTop={1}>
            ↑↓ to select · Enter to confirm
          </text>
        </>
      )}

      {oauthState === 'loading' && <text fg='#f59e0b'>◌ Setting up OAuth...</text>}

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
        </box>
      )}

      {oauthState === 'error' && (
        <box flexDirection='column' gap={1}>
          <text fg='#ef4444'>✗ {error}</text>
          <text attributes={tuiAttrs({ dim: true })}>Press Enter to retry</text>
        </box>
      )}
    </box>
  ) as ReactElement
}
