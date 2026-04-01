import React from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface Props {
  connectionState: ConnectionState
  workspace?: string
  project?: string
  resolvedCount: number
  activeCount: number
}

const stateLabel: Record<ConnectionState, { symbol: string; color: string }> = {
  connecting:   { symbol: '◌', color: '#f59e0b' },
  connected:    { symbol: '●', color: '#10b981' },
  disconnected: { symbol: '○', color: '#6b7280' },
  error:        { symbol: '✕', color: '#ef4444' },
}

export const StatusBar: React.FC<Props> = ({
  connectionState,
  workspace,
  project,
  resolvedCount,
  activeCount,
}) => {
  const { symbol, color } = stateLabel[connectionState]

  return (
    <box
      border={true}
      borderStyle="rounded"
      borderColor="#374151"
      padding={1}
      flexDirection="row"
      gap={2}
    >
      <text fg={color}>{symbol} {connectionState}</text>
      {workspace && (
        <>
          <text attributes={tuiAttrs({ dim: true })}>│</text>
          <text attributes={tuiAttrs({ dim: true })}>workspace: </text>
          <text>{workspace.slice(-8)}</text>
        </>
      )}
      {project && (
        <>
          <text attributes={tuiAttrs({ dim: true })}>project: </text>
          <text>{project.slice(-8)}</text>
        </>
      )}
      <text attributes={tuiAttrs({ dim: true })}>│</text>
      {activeCount > 0 && (
        <>
          <text fg="#f59e0b">{activeCount} fixing</text>
          <text attributes={tuiAttrs({ dim: true })}>│</text>
        </>
      )}
      <text fg="#10b981">{resolvedCount} resolved</text>
    </box>
  )
}
