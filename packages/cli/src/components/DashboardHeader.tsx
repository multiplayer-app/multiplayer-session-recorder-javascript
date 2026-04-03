import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import type { RuntimeState } from '../runtime/types.js'
import type { AgentConfig } from '../types/index.js'

type ConnectionState = RuntimeState['connection']

const CONNECTION_BADGE: Record<ConnectionState, { symbol: string; color: string }> = {
  idle:         { symbol: '○', color: '#6b7280' },
  connecting:   { symbol: '◌', color: '#f59e0b' },
  connected:    { symbol: '●', color: '#10b981' },
  disconnected: { symbol: '○', color: '#6b7280' },
  error:        { symbol: '✕', color: '#ef4444' },
}

interface Props {
  state: RuntimeState
  config: AgentConfig
  isNarrow: boolean
}

function resolveLabel(
  stateDisplay: string | undefined,
  configDisplay: string | undefined,
  rawId: string | undefined,
): string {
  return stateDisplay?.trim() || configDisplay?.trim() || (rawId ? rawId.slice(-8) : '')
}

function DashboardHeaderImpl({ state, config, isNarrow }: Props): ReactElement {
  const { symbol, color } = CONNECTION_BADGE[state.connection]
  const activeCount = state.sessions.filter(
    (s) => !['done', 'failed', 'aborted'].includes(s.status),
  ).length

  const workspaceLabel = resolveLabel(
    state.workspaceDisplayName,
    config.workspaceDisplayName,
    config.workspace,
  )
  const projectLabel = resolveLabel(
    state.projectDisplayName,
    config.projectDisplayName,
    config.project,
  )

  // ── Shared fragments ────────────────────────────────────────────────────────

  const brandBadge = (
    <text fg='#6366f1' attributes={tuiAttrs({ bold: true })}>
      ◆ MULTIPLAYER
    </text>
  )

  const connectionBadge = (
    <text fg={color}>
      {symbol} {state.connection}
    </text>
  )

  const connectionError = state.connectionError ? (
    <text fg='#ef4444'>{state.connectionError}</text>
  ) : null

  const separator = <text attributes={tuiAttrs({ dim: true })}>│</text>

  const statsBadges = (
    <>
      {activeCount > 0 && (
        <>
          {separator}
          <text fg='#f59e0b'>{activeCount} active</text>
        </>
      )}
      {separator}
      <text fg='#10b981'>{state.resolvedCount} resolved</text>
    </>
  )

  // ── Wide layout (single row) ────────────────────────────────────────────────

  if (!isNarrow) {
    return (
      <box
        border={true}
        borderStyle='rounded'
        borderColor='#374151'
        padding={1}
        flexDirection='row'
        flexShrink={0}
        gap={2}
      >
        {brandBadge}
        {separator}
        {connectionBadge}
        {connectionError}
        {config.workspace && (
          <>
            {separator}
            <text attributes={tuiAttrs({ dim: true })}>workspace:</text>
            <text>{workspaceLabel}</text>
          </>
        )}
        {config.project && (
          <>
            <text attributes={tuiAttrs({ dim: true })}>project:</text>
            <text>{projectLabel}</text>
          </>
        )}
        {separator}
        <text attributes={tuiAttrs({ dim: true })}>model:</text>
        <text>{config.model}</text>
        {statsBadges}
      </box>
    ) as ReactElement
  }

  // ── Narrow layout (multi-row) ───────────────────────────────────────────────

  return (
    <box
      border={true}
      borderStyle='rounded'
      borderColor='#374151'
      padding={1}
      flexDirection='column'
      flexShrink={0}
      gap={1}
    >
      {/* Row 1: brand + connection */}
      <box flexDirection='row' flexWrap='wrap' gap={2}>
        {brandBadge}
        {separator}
        {connectionBadge}
        {connectionError}
      </box>

      {/* Row 2: workspace / project (conditional) */}
      {(config.workspace || config.project) && (
        <box flexDirection='row' flexWrap='wrap' gap={2}>
          {config.workspace && (
            <>
              <text attributes={tuiAttrs({ dim: true })}>workspace:</text>
              <text>{workspaceLabel}</text>
            </>
          )}
          {config.workspace && config.project && separator}
          {config.project && (
            <>
              <text attributes={tuiAttrs({ dim: true })}>project:</text>
              <text>{projectLabel}</text>
            </>
          )}
        </box>
      )}

      {/* Row 3: model + stats */}
      <box flexDirection='row' flexWrap='wrap' gap={2}>
        <text attributes={tuiAttrs({ dim: true })}>model:</text>
        <text>{config.model}</text>
        {statsBadges}
      </box>
    </box>
  ) as ReactElement
}

export const DashboardHeader = DashboardHeaderImpl as (props: Props) => ReactElement
