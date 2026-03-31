import React, { type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

export function WorkspaceStep({ config, onComplete }: Props): ReactElement {
  useKeyboard(({ name }) => {
    if (name === 'return') onComplete({})
  })

  return (
    <box flexDirection="column" gap={1}>
      <text attributes={tuiAttrs({ dim: true })}>Confirm detected workspace/project before proceeding.</text>
      <box
        flexDirection="column"
        border={true}
        borderStyle="rounded"
        borderColor="#374151"
        padding={1}
        marginTop={1}
        gap={0}
      >
        <box flexDirection="row" gap={2}>
          <text attributes={tuiAttrs({ dim: true })}>Workspace:</text>
          <text fg="#22d3ee">{config.workspace ?? '—'}</text>
        </box>
        <box flexDirection="row" gap={2}>
          <text attributes={tuiAttrs({ dim: true })}>Project:  </text>
          <text fg="#22d3ee">{config.project ?? '—'}</text>
        </box>
        <box flexDirection="row" gap={2}>
          <text attributes={tuiAttrs({ dim: true })}>URL:      </text>
          <text>{config.url}</text>
        </box>
      </box>
      <text attributes={tuiAttrs({ dim: true })}>Press Enter to accept</text>
    </box>
  ) as ReactElement
}
