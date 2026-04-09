import { type ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { useTerminalDimensions } from '@opentui/react'

/** multiplayer.app brand (logo / CTAs) */
const BRAND_PRIMARY = '#473cfb'
const BRAND_ACCENT = '#00eaf6'

// Fallback compact wordmark for narrow terminals
const WORDMARK_COMPACT = [
  '█   █ █   █ █     █████ █████ ████  █      ███  █   █ █████ ████ ',
  '██ ██ █   █ █       █     █   █   █ █     █   █ █   █ █     █   █',
  '█ █ █ █   █ █       █     █   █   █ █     █   █  █ █  █     █   █',
  '█   █ █   █ █       █     █   ████  █     █████   █   ████  ████ ',
  '█   █ █   █ █       █     █   █     █     █   █   █   █     █ █  ',
  '█   █ █   █ █       █     █   █     █     █   █   █   █     █  █ ',
  '█   █  ███  █████   █   █████ █     █████ █   █   █   █████ █   █',
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
        <ascii-font font='block' color={BRAND_PRIMARY} text='MULTIPLAYER' />
        <text fg={BRAND_ACCENT} attributes={tuiAttrs({ dim: true })}>
          {center('Automated issue triage, patching, and PR workflow', Math.min(width - 4, 80))}
        </text>
      </box>
    ) as ReactElement
  }

  const maxWidth = Math.max(48, width - 8)
  return (
    <box flexDirection='column' alignItems='center' marginTop={1} marginBottom={1} flexShrink={0}>
      {WORDMARK_COMPACT.map((line, i) => (
        <text key={i} fg={BRAND_PRIMARY}>
          {center(line, maxWidth)}
        </text>
      ))}
      <text fg={BRAND_ACCENT} attributes={tuiAttrs({ dim: true })}>
        {center('Automated issue triage, patching, and PR workflow', maxWidth)}
      </text>
    </box>
  ) as ReactElement
}
