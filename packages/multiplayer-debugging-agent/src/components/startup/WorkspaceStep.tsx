import React from 'react'
import { Box, Text, useInput } from 'ink'
import type { AgentConfig } from '../../types/index.js'

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

export const WorkspaceStep: React.FC<Props> = ({ config, onComplete }) => {
  useInput((_, key) => {
    if (key.return) {
      onComplete({})
    }
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>Confirm detected workspace/project before proceeding.</Text>
      <Box flexDirection="column" gap={0} marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Box gap={2}>
          <Text dimColor>Workspace:</Text>
          <Text color="cyan">{config.workspace ?? '—'}</Text>
        </Box>
        <Box gap={2}>
          <Text dimColor>Project:  </Text>
          <Text color="cyan">{config.project ?? '—'}</Text>
        </Box>
        <Box gap={2}>
          <Text dimColor>URL:      </Text>
          <Text>{config.url}</Text>
        </Box>
      </Box>
      <Text dimColor>Press Enter to accept</Text>
    </Box>
  )
}
