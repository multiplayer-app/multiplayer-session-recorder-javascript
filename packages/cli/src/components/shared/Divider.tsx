import { BoxProps } from '@opentui/react'
import { ReactElement } from 'react'

import { BG_SURFACE_ROW_HOVER } from './tuiTheme.js'

export function Divider(props?: BoxProps) {
  return (
    <box height={1} paddingLeft={1} paddingRight={1} {...(props ?? {})}>
      <text fg={BG_SURFACE_ROW_HOVER}>{'─'.repeat(999)}</text>
    </box>
  ) as ReactElement
}
