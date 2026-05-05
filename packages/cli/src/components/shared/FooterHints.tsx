import type { ReactElement } from 'react'

import { FG_FOOTER_HINT } from './tuiTheme.js'

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
      <text fg={FG_FOOTER_HINT}>{hints}</text>
    </box>
  ) as ReactElement
}
