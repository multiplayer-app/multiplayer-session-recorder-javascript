import { useState, type ReactElement } from 'react'
import { useKeyboard } from '@opentui/react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { listAccounts, readCredentials } from '../../cli/profile.js'
import { FooterHints, SelectionList, type SelectionItem } from '../shared/index.js'
import { clickHandler } from '../shared/clickHandler.js'

interface Props {
  onComplete: (updates: Partial<AgentConfig>) => void
  onAddNew: () => void
}

export function AccountSelectStep({ onComplete, onAddNew }: Props): ReactElement {
  const accounts = listAccounts()

  const items: SelectionItem[] = [
    ...accounts.map((name) => {
      const creds = readCredentials(name)
      const badge = creds.authType === 'oauth' ? 'OAuth' : creds.authType === 'api_key' ? 'API key' : 'unknown'
      return {
        key: name,
        icon: '◆',
        iconColor: '#22d3ee',
        label: name,
        description: badge,
      } satisfies SelectionItem
    }),
    {
      key: '__new__',
      icon: '◇',
      iconColor: '#f59e0b',
      label: 'Add new account',
      description: 'Authenticate with a different Multiplayer account',
    },
  ]

  const [selected, setSelected] = useState(0)

  useKeyboard(({ name }) => {
    if (name === 'up' || name === 'k') setSelected((s) => Math.max(0, s - 1))
    else if (name === 'down' || name === 'j') setSelected((s) => Math.min(items.length - 1, s + 1))
    else if (name === 'return') handleConfirm(selected)
  })

  const handleConfirm = (idx: number) => {
    const item = items[idx]
    if (!item) return
    if (item.key === '__new__') {
      onAddNew()
    } else {
      const creds = readCredentials(item.key)
      onComplete({
        apiKey: creds.apiKey,
        authType: creds.authType,
        url: creds.url,
      })
    }
  }

  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ dim: true })}>
        Choose an account to link with this project, or add a new one.
      </text>
      <SelectionList
        items={items}
        selectedIndex={selected}
        onSelect={(idx) => {
          setSelected(idx)
          handleConfirm(idx)
        }}
      />
      <FooterHints hints='↑↓ navigate · Enter select · Click to select' />
    </box>
  ) as ReactElement
}
