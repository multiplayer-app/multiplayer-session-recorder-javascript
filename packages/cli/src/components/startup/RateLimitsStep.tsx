import { useState, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard } from '@opentui/react'
import type { AgentConfig } from '../../types/index.js'
import { FooterHints, SelectionList, type SelectionItem } from '../shared/index.js'

interface ConcurrencyOption {
  value: number
  label: string
  description: string
}

const OPTIONS: ConcurrencyOption[] = [
  { value: 1, label: '1 — Sequential', description: 'Safest, lowest API usage' },
  { value: 2, label: '2 — Balanced', description: 'Recommended default' },
  { value: 3, label: '3 — Faster', description: 'Faster throughput' },
  { value: 4, label: '4 — High throughput', description: 'High API usage' },
  { value: 5, label: '5 — Aggressive', description: 'Maximum parallelism, high API usage' }
]

const DEFAULT_VALUE = 2

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

export function RateLimitsStep({ config, onComplete }: Props): ReactElement {
  const configured = config.maxConcurrentIssues ?? DEFAULT_VALUE
  const initialIdx = OPTIONS.findIndex((o) => o.value === configured)
  const [selectedIndex, setSelectedIndex] = useState(initialIdx >= 0 ? initialIdx : 1)

  const confirm = (index: number) => {
    const opt = OPTIONS[index]
    if (opt) onComplete({ maxConcurrentIssues: opt.value })
  }

  useKeyboard(({ name }) => {
    if (name === 'up') {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (name === 'down') {
      setSelectedIndex((i) => Math.min(OPTIONS.length - 1, i + 1))
    } else if (name === 'return') {
      confirm(selectedIndex)
    }
  })

  const items: SelectionItem[] = OPTIONS.map((opt) => ({
    key: String(opt.value),
    icon: '◆',
    iconColor: '#22d3ee',
    label: opt.label,
    labelColor: '#c9d1d9',
    description: opt.description
  }))

  return (
    <box flexDirection='column' flexGrow={1}>
      <text attributes={tuiAttrs({ dim: true })} marginLeft={1}>
        Maximum number of issues to resolve in parallel. Higher values use more AI credits but resolve faster.
      </text>
      <box marginTop={1} flexGrow={1}>
        <SelectionList items={items} selectedIndex={selectedIndex} onSelect={confirm} flexGrow={1} />
      </box>
      <FooterHints hints='↑↓ navigate · Enter select · Click to select · Esc back' paddingLeft={1} marginTop={1} />
    </box>
  ) as ReactElement
}
