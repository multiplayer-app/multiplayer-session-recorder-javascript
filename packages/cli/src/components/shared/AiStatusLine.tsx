import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'

interface AiStatusLineProps {
  title: string
  status?: string
  color?: string
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// Playful action words rotated while we're waiting on the model.
const FALLBACK_PHRASES = [
  'Pondering',
  'Scheming',
  'Noodling',
  'Cogitating',
  'Deliberating',
  'Ruminating',
  'Marinating',
  'Untangling',
  'Divining',
  'Percolating',
  'Conjuring',
  'Synthesizing',
  'Calibrating',
  'Wrangling',
  'Spelunking',
  'Assembling',
  'Orchestrating',
  'Mulling'
]

const DOT_CYCLE = ['', '.', '..', '...']

function pickShuffled<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Title + spinner, with a single live status line below. No progress bar. */
export function AiStatusLine({ title, status, color = '#22d3ee' }: AiStatusLineProps): ReactElement {
  const [frameIndex, setFrameIndex] = useState(0)
  // Shuffle once per mount so each invocation gets its own random order.
  const phrases = useMemo(() => pickShuffled(FALLBACK_PHRASES), [])

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((i) => (i + 1) % 1200)
    }, 90)
    return () => clearInterval(timer)
  }, [])

  const spinner = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length] ?? SPINNER_FRAMES[0]
  const liveStatus = status?.trim()
  // Swap phrase every ~2.4s (27 ticks), dots every ~360ms (4 ticks).
  const phrase = phrases[Math.floor(frameIndex / 27) % phrases.length] ?? phrases[0]!
  const dots = DOT_CYCLE[Math.floor(frameIndex / 4) % DOT_CYCLE.length] ?? ''
  const line = liveStatus ?? `${phrase}${dots}`

  return (
    <box flexDirection='column' gap={1}>
      <box gap={1} flexDirection='row' alignItems='center'>
        <text fg={color}>{spinner}</text>
        <text fg='#e6edf3' attributes={tuiAttrs({ bold: true })}>
          {title}
        </text>
      </box>
      <box flexGrow={1} flexShrink={1}>
        <text attributes={tuiAttrs({ dim: true })}>{line}</text>
      </box>
    </box>
  ) as ReactElement
}
