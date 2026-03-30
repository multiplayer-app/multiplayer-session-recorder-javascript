import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
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

export const RateLimitsStep: React.FC<Props> = ({ config, onComplete }) => {
  const configured = config.maxConcurrentIssues
  const defaultVal: ConcurrencyOption =
    configured && OPTIONS.includes(configured as ConcurrencyOption)
      ? (configured as ConcurrencyOption)
      : 2
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, OPTIONS.indexOf(defaultVal))
  )
  const selectedOption: ConcurrencyOption = OPTIONS[selectedIndex] ?? 2

  useInput((_, key) => {
    if (key.upArrow || key.leftArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.downArrow || key.rightArrow) {
      setSelectedIndex((i) => Math.min(OPTIONS.length - 1, i + 1))
    } else if (key.return) {
      onComplete({ maxConcurrentIssues: selectedOption })
    }
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>
        Maximum number of issues to resolve in parallel. Higher values use more
        AI credits but resolve issues faster.
      </Text>
      <Box flexDirection="row" gap={2} marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        {OPTIONS.map((n, i) => {
          const isActive = i === selectedIndex
          return (
            <Box key={n}>
              <Text
                color={isActive ? 'cyan' : undefined}
                bold={isActive}
              >
                {isActive ? `[${n}]` : ` ${n} `}
              </Text>
            </Box>
          )
        })}
      </Box>
      <Text color="cyan">Selected: {selectedOption} · {CONCURRENCY_HINT[selectedOption]}</Text>
      <Text dimColor>← → select · Enter confirm · Esc back</Text>
    </Box>
  )
}
