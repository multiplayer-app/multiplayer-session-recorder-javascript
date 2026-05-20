import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import type { RuntimeState } from '../runtime/types.js'
import type { AgentConfig } from '../types/index.js'
import {
  BORDER_MUTED,
  BRAND_MARK_PRIMARY,
  CONNECTION_STATUS_COLORS,
  FG_DIM,
  FG_META,
  FG_MUTED,
  SEM_RED
} from './shared/tuiTheme.js'

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
  const conn = CONNECTION_STATUS_COLORS[state.connection]
  const displayDir = shortenPath(config.dir)
  const separator = <text fg={BORDER_MUTED}> │ </text>

  return (
    <box
      flexDirection='row'
      flexShrink={0}
      justifyContent='space-between'
      paddingLeft={1}
      paddingRight={1}
      height={1}
    >
      {/* Left: Brand */}
      <box flexDirection='row' gap={0} flexShrink={0}>
        <text fg={BRAND_MARK_PRIMARY} attributes={tuiAttrs({ bold: true })}>
          ◆ MULTIPLAYER
        </text>
      </box>

      {/* Right: dir · model · connection */}
      <box flexDirection='row' gap={0} flexShrink={1}>
        {!isNarrow && (
          <>
            <text fg={FG_DIM}>{displayDir}</text>
            {separator}
          </>
        )}
        <text fg={FG_META}>model:</text>
        <text fg={FG_MUTED}>{config.model}</text>
        {separator}
        <text fg={conn.color}>
          {conn.symbol} {conn.label}
        </text>
        {state.connectionError && (
          <>
            <text> </text>
            <text fg={SEM_RED} attributes={tuiAttrs({ dim: true })}>
              {state.connectionError.slice(0, 30)}
            </text>
          </>
        )}
      </box>
    </box>
  ) as ReactElement
}

export const DashboardHeader = DashboardHeaderImpl as (props: Props) => ReactElement
