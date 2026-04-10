import { type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import { FooterHints } from '../shared/index.js'

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

export function WorkspaceStep({ config, onComplete }: Props): ReactElement {
  useKeyboard(({ name }) => {
    if (name === 'return') onComplete({})
  })
  const workspaceDisplayName = config.workspaceDisplayName?.trim()
  const projectDisplayName = config.projectDisplayName?.trim()
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ dim: true })}>Confirm detected workspace/project before proceeding.</text>
      <box flexDirection='column' border={true} borderStyle='rounded' borderColor='#374151' paddingLeft={1} gap={0}>
        <box flexDirection='row' gap={2}>
          <text attributes={tuiAttrs({ dim: true })}>Workspace:</text>
          <text fg='#22d3ee'>{workspaceDisplayName || config.workspace || '—'}</text>
        </box>
        {config.workspace && !workspaceDisplayName ? (
          <box flexDirection='row' gap={2} marginLeft={11}>
            <text attributes={tuiAttrs({ dim: true })}>id</text>
            <text attributes={tuiAttrs({ dim: true })}>{config.workspace}</text>
          </box>
        ) : null}
        <box flexDirection='row' gap={2}>
          <text attributes={tuiAttrs({ dim: true })}>Project: </text>
          <text fg='#22d3ee'>{projectDisplayName || config.project || '—'}</text>
        </box>
        {config.project && !projectDisplayName ? (
          <box flexDirection='row' gap={2} marginLeft={11}>
            <text attributes={tuiAttrs({ dim: true })}>id</text>
            <text attributes={tuiAttrs({ dim: true })}>{config.project}</text>
          </box>
        ) : null}
        <box flexDirection='row' gap={2}>
          <text attributes={tuiAttrs({ dim: true })}>URL: </text>
          <text>{config.url}</text>
        </box>
      </box>
      <FooterHints hints='Enter accept' />
    </box>
  ) as ReactElement
}
