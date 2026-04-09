import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import type { RuntimeState } from '../runtime/types.js'
import type { AgentConfig } from '../types/index.js'

type ConnectionState = RuntimeState['connection']

const CONNECTION_BADGE: Record<ConnectionState, { symbol: string; color: string; label: string }> = {
  idle: { symbol: '○', color: '#6b7280', label: 'idle' },
  connecting: { symbol: '◌', color: '#f59e0b', label: 'connecting' },
  connected: { symbol: '●', color: '#10b981', label: 'connected' },
  disconnected: { symbol: '○', color: '#6b7280', label: 'disconnected' },
  error: { symbol: '✕', color: '#ef4444', label: 'error' },
}

interface Props {
  state: RuntimeState
  config: AgentConfig
  isNarrow: boolean
}

/** Shorten an absolute path by replacing $HOME with ~. */
function shortenPath(dir: string): string {
  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? ''
  if (home && dir.startsWith(home)) return '~' + dir.slice(home.length)
  return dir
}

function DashboardHeaderImpl({ state, config, isNarrow }: Props): ReactElement {
  const conn = CONNECTION_BADGE[state.connection]
  const displayDir = shortenPath(config.dir)
  const separator = <text fg='#374151'> │ </text>

  return (
    <box
      flexDirection='row'
      flexShrink={0}
      justifyContent='space-between'
      paddingLeft={1}
      paddingRight={1}
      height={1}
      // backgroundColor='#1e1e2e'
    >
      {/* Left: Brand */}
      <box flexDirection='row' gap={0} flexShrink={0}>
        <text fg='#6366f1' attributes={tuiAttrs({ bold: true })}>
          ◆ MULTIPLAYER
        </text>
      </box>

      {/* Right: dir · model · connection */}
      <box flexDirection='row' gap={0} flexShrink={1}>
        {!isNarrow && (
          <>
            <text fg='#6b7280'>{displayDir}</text>
            {separator}
          </>
        )}
        <text fg='#4b5563'>model:</text>
        <text fg='#9ca3af'>{config.model}</text>
        {separator}
        <text fg={conn.color}>
          {conn.symbol} {conn.label}
        </text>
        {state.connectionError && (
          <>
            <text> </text>
            <text fg='#ef4444' attributes={tuiAttrs({ dim: true })}>
              {state.connectionError.slice(0, 30)}
            </text>
          </>
        )}
      </box>
    </box>
  ) as ReactElement
}

export const DashboardHeader = DashboardHeaderImpl as (props: Props) => ReactElement
