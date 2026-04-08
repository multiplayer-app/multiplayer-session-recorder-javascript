import React, { useState, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { MouseEvent } from '@opentui/core'
import { MouseButton } from '@opentui/core'
import type { AgentConfig } from '../../types/index.js'

const OPTIONS = [1, 2, 3, 4, 5] as const
type ConcurrencyOption = typeof OPTIONS[number]

const CONCURRENCY_HINT: Record<ConcurrencyOption, string> = {
  1: 'Safest, lowest API usage',
  2: 'Balanced default',
  3: 'Faster throughput',
  4: 'High throughput',
  5: 'Aggressive (high API usage)',
}

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

function clickHandler(handler: () => void) {
  return (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    handler()
  }
}

export function RateLimitsStep({ config, onComplete }: Props): ReactElement {
  const configured = config.maxConcurrentIssues
  const defaultVal: ConcurrencyOption =
    configured && OPTIONS.includes(configured as ConcurrencyOption)
      ? (configured as ConcurrencyOption)
      : 2
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, OPTIONS.indexOf(defaultVal)))
  const selectedOption: ConcurrencyOption = OPTIONS[selectedIndex] ?? 2

  useKeyboard(({ name }) => {
    if (name === 'up' || name === 'left') {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (name === 'down' || name === 'right') {
      setSelectedIndex((i) => Math.min(OPTIONS.length - 1, i + 1))
    } else if (name === 'return') {
      onComplete({ maxConcurrentIssues: selectedOption })
    }
  })

  return (
    <box flexDirection="column" gap={1}>
      <text attributes={tuiAttrs({ dim: true })}>
        Maximum number of issues to resolve in parallel. Higher values use more AI credits but resolve issues faster.
      </text>
      <box
        flexDirection="row"
        gap={2}
        marginTop={1}
        border={true}
        borderStyle="rounded"
        borderColor="#374151"
        padding={1}
      >
        {OPTIONS.map((n, i) => {
          const isActive = i === selectedIndex
          return (
            <box
              key={n}
              onMouseUp={clickHandler(() => {
                setSelectedIndex(i)
                if (isActive) onComplete({ maxConcurrentIssues: n })
              })}
            >
              <text fg={isActive ? '#22d3ee' : undefined} attributes={tuiAttrs({ bold: isActive })}>
                {isActive ? `[${n}]` : ` ${n} `}
              </text>
            </box>
          )
        })}
      </box>
      <text fg="#22d3ee">Selected: {selectedOption} · {CONCURRENCY_HINT[selectedOption]}</text>
      <text attributes={tuiAttrs({ dim: true })}>← → select · Enter confirm · Esc back</text>
    </box>
  ) as ReactElement
}
