import type { ReactElement } from 'react'
import type { MouseEvent } from '@opentui/core'
import { MouseButton } from '@opentui/core'
import { tuiAttrs } from '../lib/tuiAttrs.js'

export interface StatusBarHint {
  id: string
  keys: string
  label?: string
  onPress?: () => void
}

interface Props {
  hints: StatusBarHint[]
  version?: string
  quitPending?: boolean
}

function pressMouseUp(handler: () => void) {
  return (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    handler()
  }
}

function StatusBarImpl({ hints, version, quitPending }: Props): ReactElement {
  return (
    <box
      flexDirection='row'
      flexShrink={0}
      justifyContent='space-between'
      height={1}
      // backgroundColor='#1e1e2e'
      paddingLeft={1}
      paddingRight={1}
    >
      {/* Left: key hints */}
      <box flexDirection='row' gap={2} flexShrink={1}>
        {quitPending ? (
          <text fg='#f59e0b'>Waiting for active sessions...</text>
        ) : (
          hints.map((h) => (
            <box
              key={h.id}
              flexDirection='row'
              gap={0}
              flexShrink={0}
              onMouseUp={h.onPress ? pressMouseUp(h.onPress) : undefined}
            >
              <text fg='#22d3ee' attributes={tuiAttrs({ bold: true })}>
                {h.keys}
              </text>
              {h.label && <text fg='#6b7280'> {h.label}</text>}
            </box>
          ))
        )}
      </box>

      {/* Right: version */}
      {version && (
        <box flexDirection='row' gap={0} flexShrink={0}>
          <text fg='#4b5563'>v{version}</text>
        </box>
      )}
    </box>
  ) as ReactElement
}

export const StatusBar = StatusBarImpl as (props: Props) => ReactElement
