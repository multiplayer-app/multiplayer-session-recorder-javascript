import { BoxProps } from '@opentui/react'
import { ReactElement } from 'react'

export function Divider(props?: BoxProps) {
  return (
    <box height={1} paddingLeft={1} paddingRight={1} {...(props ?? {})}>
      <text fg='#21262d'>{'─'.repeat(999)}</text>
    </box>
  ) as ReactElement
}
