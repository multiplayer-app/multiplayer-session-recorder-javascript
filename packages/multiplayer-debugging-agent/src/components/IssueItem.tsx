import React from 'react'
import { Box, Text } from 'ink'
import { ActiveIssue } from '../types/index.js'

interface Props {
  activeIssue: ActiveIssue
}

const statusLabel: Record<string, { label: string; color: string }> = {
  pending:   { label: 'PENDING',   color: 'gray' },
  analyzing: { label: 'ANALYZING', color: 'cyan' },
  applying:  { label: 'APPLYING',  color: 'yellow' },
  pushing:   { label: 'PUSHING',   color: 'yellow' },
  done:      { label: 'DONE',      color: 'green' },
  failed:    { label: 'FAILED',    color: 'red' },
}

export const IssueItem: React.FC<Props> = ({ activeIssue }) => {
  const { issue, status, branchName, error } = activeIssue
  const { label, color } = statusLabel[status] ?? { label: status.toUpperCase(), color: 'white' }

  const elapsed = Math.round((Date.now() - activeIssue.startedAt.getTime()) / 1000)

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={color as any}
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="row" gap={1}>
        <Text bold color={color as any}>[{label}]</Text>
        <Text bold>{issue.title}</Text>
      </Box>
      <Box flexDirection="row" gap={2}>
        <Text dimColor>category: {issue.category}</Text>
        <Text dimColor>service: {issue.service.serviceName}</Text>
        {issue.metadata.filename && (
          <Text dimColor>file: {issue.metadata.filename}</Text>
        )}
        <Text dimColor>{elapsed}s</Text>
      </Box>
      {branchName && (
        <Box>
          <Text color="green">branch: {branchName}</Text>
        </Box>
      )}
      {error && (
        <Box>
          <Text color="red">error: {error}</Text>
        </Box>
      )}
    </Box>
  )
}
