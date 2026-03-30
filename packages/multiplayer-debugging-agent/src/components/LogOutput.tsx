import React from 'react'
import { Box, Text } from 'ink'
import { LogEntry } from '../types/index.js'

interface Props {
  logs: LogEntry[]
  maxLines?: number
}

const levelColor: Record<string, string> = {
  info: 'white',
  error: 'red',
  debug: 'gray',
}

export const LogOutput: React.FC<Props> = ({ logs, maxLines = 10 }) => {
  const visible = logs.slice(-maxLines)

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor bold>── Logs ──────────────────────────────────────</Text>
      {visible.length === 0 && (
        <Text dimColor>  (no logs yet)</Text>
      )}
      {visible.map((entry, i) => {
        const ts = entry.timestamp.toTimeString().slice(0, 8)
        const color = levelColor[entry.level] ?? 'white'
        return (
          <Box key={i} flexDirection="row" gap={1}>
            <Text dimColor>{ts}</Text>
            <Text color={color as any}>[{entry.level.toUpperCase()}]</Text>
            <Text color={color as any}>{entry.message}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
