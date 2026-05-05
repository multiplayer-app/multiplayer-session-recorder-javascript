import type { ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { clickHandler } from './clickHandler.js'
import { ACCENT, BORDER_SUBTLE, BG_SURFACE_DEEP, FG_BODY_EMPHASIS } from './tuiTheme.js'

interface ActionButtonProps {
  label: string
  icon: string
  iconColor?: string
  labelColor?: string
  borderColor?: string
  backgroundColor?: string
  onClick: () => void
}

/**
 * A bordered clickable button with an icon and label.
 * Used for primary actions like "Use this directory", "Skip", "Continue", etc.
 */
export function ActionButton({
  label,
  icon,
  iconColor = ACCENT,
  labelColor = FG_BODY_EMPHASIS,
  borderColor = BORDER_SUBTLE,
  backgroundColor = BG_SURFACE_DEEP,
  onClick
}: ActionButtonProps): ReactElement {
  return (
    <box
      border={true}
      flexShrink={0}
      flexDirection='column'
      borderStyle='rounded'
      borderColor={borderColor}
      overflow={'hidden' as const}
      onMouseUp={clickHandler(onClick)}
    >
      <box flexDirection='row' paddingLeft={1} paddingRight={1} backgroundColor={backgroundColor}>
        <box width={3} flexShrink={0}>
          <text fg={iconColor}>{icon}</text>
        </box>
        <box flexGrow={1}>
          <text fg={labelColor} attributes={tuiAttrs({ bold: true })}>
            {label}
          </text>
        </box>
      </box>
    </box>
  ) as ReactElement
}
