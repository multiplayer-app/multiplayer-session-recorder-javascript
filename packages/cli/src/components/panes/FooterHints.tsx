import type { ReactElement } from 'react'
import type { MouseEvent } from '@opentui/core'
import { MouseButton } from '@opentui/core'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { ACCENT, BORDER_MUTED, SEM_AMBER } from '../shared/tuiTheme.js'

export interface FooterHintItem {
  id: string
  keys: string
  /** Short action name; omit when the key chord is self-explanatory. */
  label?: string
  alt?: string
  /** Only on a couple of rows (e.g. l / q). */
  onPress?: () => void
}

/** Dashboard status bar: open issue subscription / agent advanced settings (keyboard `s`). */
export function dashboardAdvancedSettingsHint(onPress: () => void): FooterHintItem {
  return { id: 'advanced-settings', keys: 's', label: 'advanced settings', onPress }
}

interface Props {
  hints: FooterHintItem[]
  quitPending?: boolean
}

function pressMouseUp(handler: () => void) {
  return (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    handler()
  }
}

/** Return type narrowed: OpenTUI JSX + React 19 (TS2786). */
export function FooterHints({ hints, quitPending }: Props): ReactElement {
  return (
    <box
      border={true}
      borderStyle='rounded'
      borderColor={BORDER_MUTED}
      padding={1}
      flexDirection='row'
      flexShrink={0}
      flexWrap='wrap'
      gap={4}
    >
      {hints.map((h) => (
        <box
          key={h.id}
          flexShrink={0}
          flexDirection='row'
          gap={0}
          onMouseUp={h.onPress ? pressMouseUp(h.onPress) : undefined}
        >
          <text fg={ACCENT} attributes={tuiAttrs({ bold: true })}>
            {h.keys}
          </text>
          {h.label ? (
            <>
              <text> </text>
              <text>{h.label}</text>
            </>
          ) : null}
          {h.alt ? <text attributes={tuiAttrs({ dim: true })}> ({h.alt})</text> : null}
        </box>
      ))}
      {quitPending && (
        <box flexShrink={0}>
          <text fg={SEM_AMBER}>Waiting for active sessions to finish...</text>
        </box>
      )}
    </box>
  ) as ReactElement
}
