import { useEffect, useState, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'

interface AnimatedLoadingProps {
  title: string
  subtitle?: string
  color?: string
}

/**
 * Animated loading spinner with a bouncing progress bar.
 * Shows a braille spinner, bold title, optional subtitle, and a sliding bar.
 */
export function AnimatedLoading({ title, subtitle, color = '#22d3ee' }: AnimatedLoadingProps): ReactElement {
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const pulseFrames = ['Preparing workspace', 'Preparing workspace.', 'Preparing workspace..', 'Preparing workspace...']
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((i) => (i + 1) % 120)
    }, 90)
    return () => clearInterval(timer)
  }, [])

  const spinner = spinnerFrames[frameIndex % spinnerFrames.length] ?? spinnerFrames[0]
  const pulseText = pulseFrames[Math.floor(frameIndex / 2) % pulseFrames.length] ?? pulseFrames[0]

  const BAR_WIDTH = 28
  const SEGMENT = 6
  const travel = BAR_WIDTH - SEGMENT
  const raw = frameIndex % (travel * 2)
  const pos = raw < travel ? raw : travel * 2 - raw
  const before = pos
  const after = BAR_WIDTH - SEGMENT - (pos || 1)

  return (
    <box flexDirection='column' gap={1}>
      <box gap={1} flexDirection='row' alignItems='center'>
        <text fg={color}>{spinner}</text>
        <text fg='#e6edf3' attributes={tuiAttrs({ bold: true })}>
          {title}
        </text>
      </box>
      <text attributes={tuiAttrs({ dim: true })}>{subtitle ?? pulseText}</text>
      <box flexDirection='row'>
        <text fg='#30363d'>{'─'.repeat(before)}</text>
        <text fg={color}>{'━'.repeat(SEGMENT)}</text>
        <text fg='#30363d'>{'─'.repeat(after)}</text>
      </box>
    </box>
  ) as ReactElement
}
