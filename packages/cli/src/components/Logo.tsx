import { type ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { useTerminalDimensions } from '@opentui/react'
import { BRAND_LOGO_ACCENT, BRAND_LOGO_PRIMARY } from './shared/tuiTheme.js'

// Fallback compact wordmark for narrow terminals
const WORDMARK_COMPACT = [
  '█   █ █   █ █     █████ █████ ████  █      ███  █   █ █████ ████ ',
  '██ ██ █   █ █       █     █   █   █ █     █   █ █   █ █     █   █',
  '█ █ █ █   █ █       █     █   █   █ █     █   █  █ █  █     █   █',
  '█   █ █   █ █       █     █   ████  █     █████   █   ████  ████ ',
  '█   █ █   █ █       █     █   █     █     █   █   █   █     █ █  ',
  '█   █ █   █ █       █     █   █     █     █   █   █   █     █  █ ',
  '█   █  ███  █████   █   █████ █     █████ █   █   █   █████ █   █'
]

function center(input: string, width: number): string {
  if (input.length >= width) return input
  const padLeft = Math.floor((width - input.length) / 2)
  return `${' '.repeat(padLeft)}${input}`
}

export function Logo(): ReactElement {
  const { width } = useTerminalDimensions()

  // ASCIIFont "multiplayer" — use for wide terminals
  const useAsciiFont = width >= 100

  if (useAsciiFont) {
    return (
      <box flexDirection='column' alignItems='center' marginTop={1} marginBottom={1} flexShrink={0}>
        <ascii-font font='block' color={BRAND_LOGO_PRIMARY} text='MULTIPLAYER' />
        <box width='100%' alignItems='center'>
          <text fg={BRAND_LOGO_ACCENT} attributes={tuiAttrs({ dim: true })}>
            The debugging agent for developers
          </text>
        </box>
      </box>
    ) as ReactElement
  }

  const maxWidth = Math.max(48, width - 8)
  return (
    <box flexDirection='column' alignItems='center' marginTop={1} marginBottom={1} flexShrink={0}>
      {WORDMARK_COMPACT.map((line, i) => (
        <text key={i} fg={BRAND_LOGO_PRIMARY}>
          {center(line, maxWidth)}
        </text>
      ))}
      <text fg={BRAND_LOGO_ACCENT} attributes={tuiAttrs({ dim: true })}>
        {center('The debugging agent for developers', maxWidth)}
      </text>
    </box>
  ) as ReactElement
}
