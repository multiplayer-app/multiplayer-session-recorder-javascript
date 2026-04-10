import type { ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { clickHandler } from './clickHandler.js'

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
  iconColor = '#22d3ee',
  labelColor = '#e6edf3',
  borderColor = '#30363d',
  backgroundColor = '#161b22',
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
