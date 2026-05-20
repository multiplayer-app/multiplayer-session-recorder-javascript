import type { ReactElement } from 'react'
import type { MouseEvent } from '@opentui/core'
import { MouseButton } from '@opentui/core'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { LogOutput } from './LogOutput.js'
import type { LogEntry } from '../types/index.js'
import { BORDER_MUTED, SEM_VIOLET_SOFT } from './shared/tuiTheme.js'

interface Props {
  logs: LogEntry[]
  height: number
  isFocused: boolean
  onRequestFocus: () => void
}

function LogsDockImpl({ logs, height, isFocused, onRequestFocus }: Props): ReactElement {
  const handleMouseUp = (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    onRequestFocus()
  }

  return (
    <box
      border={true}
      borderStyle='rounded'
      borderColor={isFocused ? SEM_VIOLET_SOFT : BORDER_MUTED}
      padding={1}
      flexShrink={0}
      flexDirection='column'
      gap={1}
      height={height}
      onMouseUp={handleMouseUp}
    >
      <text flexShrink={0} attributes={tuiAttrs({ dim: true, bold: true })}>
        Logs
      </text>
      <scrollbox
        flexGrow={1}
        scrollY
        focused={isFocused}
        stickyScroll
        stickyStart='bottom'
        onMouseUp={handleMouseUp}
        style={{
          wrapperOptions: { flexGrow: 1 },
          viewportOptions: { flexGrow: 1 },
          scrollbarOptions: {
            showArrows: true,
            trackOptions: {
              foregroundColor: SEM_VIOLET_SOFT,
              backgroundColor: BORDER_MUTED
            }
          }
        }}
      >
        <LogOutput logs={logs} showTitle={false} />
      </scrollbox>
    </box>
  ) as ReactElement
}

export const LogsDock = LogsDockImpl as (props: Props) => ReactElement
