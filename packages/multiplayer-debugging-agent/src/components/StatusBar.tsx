import React from 'react'
import { Box, Text } from 'ink'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface Props {
  connectionState: ConnectionState
  workspace?: string
  project?: string
  resolvedCount: number
  activeCount: number
}

const stateLabel: Record<ConnectionState, { symbol: string; color: string }> = {
  connecting: { symbol: '○', color: 'yellow' },
  connected:  { symbol: '●', color: 'green' },
  disconnected: { symbol: '○', color: 'gray' },
  error:      { symbol: '✕', color: 'red' },
}

export const StatusBar: React.FC<Props> = ({
  connectionState,
  workspace,
  project,
  resolvedCount,
  activeCount,
}) => {
  const { symbol, color } = stateLabel[connectionState]

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      flexDirection="row"
      gap={2}
    >
      <Text color={color as any}>{symbol} {connectionState}</Text>
      {workspace && (
        <>
          <Text dimColor>|</Text>
          <Text dimColor>workspace: </Text>
          <Text>{workspace.slice(-8)}</Text>
        </>
      )}
      {project && (
        <>
          <Text dimColor>project: </Text>
          <Text>{project.slice(-8)}</Text>
        </>
      )}
      <Text dimColor>|</Text>
      {activeCount > 0 && (
        <>
          <Text color="yellow">{activeCount} fixing</Text>
          <Text dimColor>|</Text>
        </>
      )}
      <Text color="green">{resolvedCount} resolved</Text>
    </Box>
  )
}
