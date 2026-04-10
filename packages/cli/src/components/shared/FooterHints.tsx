import type { ReactElement } from 'react'

interface FooterHintsProps {
  hints: string
  marginTop?: number
  paddingLeft?: number
}

/**
 * Renders a dimmed footer hint bar, e.g. "↑↓ navigate · Enter confirm · Esc back".
 */
export function FooterHints({ hints, marginTop, paddingLeft }: FooterHintsProps): ReactElement {
  return (
    <box flexDirection='row' flexShrink={0} marginTop={marginTop} paddingLeft={paddingLeft}>
      <text fg='#484f58'>{hints}</text>
    </box>
  ) as ReactElement
}
