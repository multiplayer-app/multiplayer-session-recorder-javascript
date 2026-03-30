import React from 'react'
import { Box, Text } from 'ink'

interface Hint {
  key: string
  label: string
}

interface Props {
  hints: Hint[]
  quitPending?: boolean
}

export const FooterHints: React.FC<Props> = ({ hints, quitPending }) => (
  <Box
    borderStyle="single"
    borderColor="gray"
    paddingX={1}
    flexDirection="row"
    flexShrink={0}
    gap={2}
  >
    {hints.map((h) => (
      <Box key={h.key} gap={1} flexShrink={0}>
        <Text bold color="cyan">{h.key}</Text>
        <Text dimColor>{h.label}</Text>
      </Box>
    ))}
    {quitPending && (
      <Box flexShrink={0}>
        <Text color="yellow">Waiting for active sessions to finish...</Text>
      </Box>
    )}
  </Box>
)
