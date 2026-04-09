import { ReactElement } from 'react'

export function Divider() {
  return (
    <box height={1} paddingLeft={1} paddingRight={1}>
      <text fg='#21262d'>{'─'.repeat(999)}</text>
    </box>
  ) as ReactElement
}
