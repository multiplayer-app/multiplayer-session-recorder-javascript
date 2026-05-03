import { useState, type ReactElement } from 'react'
import { useKeyboard } from '@opentui/react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { listAccounts, readCredentials } from '../../cli/profile.js'
import { OAuthManager } from '../../auth/oauth-manager.js'
import { createApiService } from '../../services/api.service.js'
import { decodeApiKeyPayload } from '../../services/radar.service.js'
import { API_URL } from '../../config.js'
import { FooterHints, SelectionList, type SelectionItem } from '../shared/index.js'
import type { SelectableWorkspace } from './ProjectSelectStep.js'

interface Props {
  url: string
  onComplete: (updates: Partial<AgentConfig> & { _oauthWorkspaces?: SelectableWorkspace[] }) => void
  onAddNew: () => void
}

export function AccountSelectStep({ url, onComplete, onAddNew }: Props): ReactElement {
  const accounts = listAccounts()

  const items: SelectionItem[] = [
    ...accounts.map((name) => {
      const creds = readCredentials(name)
      const badge = creds.authType === 'oauth' ? 'OAuth' : creds.authType === 'api_key' ? 'API key' : ''
      const label = creds.email ? `${name} (${creds.email})` : name
      return {
        key: name,
        icon: '◆',
        iconColor: '#22d3ee',
        label,
        description: badge,
      } satisfies SelectionItem
    }),
    {
      key: '__new__',
      icon: '◇',
      iconColor: '#f59e0b',
      label: 'Login with new account',
      description: 'Authenticate with a different Multiplayer account',
    },
  ]

  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useKeyboard(({ name }) => {
    if (loading) return
    if (name === 'up' || name === 'k') setSelected((s) => Math.max(0, s - 1))
    else if (name === 'down' || name === 'j') setSelected((s) => Math.min(items.length - 1, s + 1))
    else if (name === 'return') void handleConfirm(selected)
    else if (name === 'escape' && error) setError(null)
  })

  const handleConfirm = async (idx: number) => {
    const item = items[idx]
    if (!item) return

    if (item.key === '__new__') {
      onAddNew()
      return
    }

    const accountName = item.key
    const creds = readCredentials(accountName)
    setError(null)
    setLoading(true)

    try {
      if (creds.authType === 'oauth') {
        const oauthManager = new OAuthManager(accountName)
        const token = await oauthManager.getAccessToken()
        if (!token) {
          setLoading(false)
          setError('Token expired — please login with a new account or re-authenticate.')
          return
        }

        const api = createApiService({ url: creds.url ?? url, apiKey: '', bearerToken: token })
        const session = await api.fetchUserSession()
        const workspaces: SelectableWorkspace[] = await Promise.all(
          session.workspaces.map(async (ws) => ({
            _id: ws._id,
            name: ws.name,
            projects: (await api.fetchProjects(ws._id)).filter((p) => !!p._id && !!p.name),
          }))
        )

        onComplete({ apiKey: token, authType: 'oauth', url: creds.url, _oauthWorkspaces: workspaces })
      } else if (creds.authType === 'api_key' && creds.apiKey) {
        const payload = decodeApiKeyPayload(creds.apiKey)
        onComplete({
          apiKey: creds.apiKey,
          authType: 'api_key',
          url: creds.url,
          workspace: payload.workspace,
          project: payload.project,
        })
      } else {
        setLoading(false)
        setError('No valid credentials found for this account.')
      }
    } catch (err: any) {
      setLoading(false)
      setError(err.message ?? 'Failed to load account.')
    }
  }

  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ dim: true })}>
        Choose an account to link with this project, or login with a new one.
      </text>

      {loading ? (
        <text fg='#f59e0b'>◌ Loading account...</text>
      ) : error ? (
        <box flexDirection='column' gap={1}>
          <text fg='#ef4444'>✗ {error}</text>
          <FooterHints hints='Esc dismiss' />
        </box>
      ) : (
        <>
          <SelectionList
            items={items}
            selectedIndex={selected}
            onSelect={(idx) => {
              setSelected(idx)
              void handleConfirm(idx)
            }}
          />
          <FooterHints hints='↑↓ navigate · Enter select · Click to select' />
        </>
      )}
    </box>
  ) as ReactElement
}
