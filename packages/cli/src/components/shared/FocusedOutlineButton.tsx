import type { ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { clickHandler } from './clickHandler.js'
import { ACCENT, BORDER_MUTED, FG_LABEL, FG_LABEL_STRONG } from './tuiTheme.js'

export interface FocusedOutlineButtonProps {
  label: string
  /** Accent border and emphasized label when this control has modal / list focus. */
  focused?: boolean
  accentColor?: string
  idleBorderColor?: string
  focusedLabelColor?: string
  idleLabelColor?: string
  onPress: () => void
}

/** Rounded bordered text button; border and label reflect keyboard focus (e.g. modal footer actions). */
export function FocusedOutlineButton({
  label,
  focused = false,
  accentColor = ACCENT,
  idleBorderColor = BORDER_MUTED,
  focusedLabelColor = FG_LABEL_STRONG,
  idleLabelColor = FG_LABEL,
  onPress
}: FocusedOutlineButtonProps): ReactElement {
  const borderColor = focused ? accentColor : idleBorderColor
  return (
    <box
      flexDirection='row'
      justifyContent='center'
      border={true}
      borderStyle='rounded'
      borderColor={borderColor}
      paddingLeft={2}
      paddingRight={2}
      onMouseUp={clickHandler(onPress)}
    >
      <text fg={focused ? focusedLabelColor : idleLabelColor} attributes={tuiAttrs({ bold: focused })}>
        {label}
      </text>
    </box>
  ) as ReactElement
}
