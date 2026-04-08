import React from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { collapseForSingleLine } from '../lib/formatDisplay.js'
import { ActiveIssue } from '../types/index.js'

interface Props {
  activeIssue: ActiveIssue
}

const statusLabel: Record<string, { label: string; color: string }> = {
  pending: { label: 'PENDING', color: '#6b7280' },
  analyzing: { label: 'ANALYZING', color: '#22d3ee' },
  applying: { label: 'APPLYING', color: '#f59e0b' },
  pushing: { label: 'PUSHING', color: '#f59e0b' },
  done: { label: 'DONE', color: '#10b981' },
  failed: { label: 'FAILED', color: '#ef4444' },
}

export const IssueItem: React.FC<Props> = ({ activeIssue }) => {
  const { issue, status, branchName, error } = activeIssue
  const { label, color } = statusLabel[status] ?? { label: status.toUpperCase(), color: '#f8fafc' }

  const elapsed = Math.round((Date.now() - activeIssue.startedAt.getTime()) / 1000)

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor={color}
      padding={1}
      marginBottom={1}
    >
      <box flexDirection="row" gap={1}>
        <text fg={color} attributes={tuiAttrs({ bold: true })}>[{label}]</text>
        <text attributes={tuiAttrs({ bold: true })}>{collapseForSingleLine(issue.title)}</text>
      </box>
      <box flexDirection="row" gap={2}>
        <text attributes={tuiAttrs({ dim: true })}>category: {issue.category}</text>
        <text attributes={tuiAttrs({ dim: true })}>service: {issue.service.serviceName}</text>
        {issue.metadata.filename && (
          <text attributes={tuiAttrs({ dim: true })}>file: {issue.metadata.filename}</text>
        )}
        <text attributes={tuiAttrs({ dim: true })}>{elapsed}s</text>
      </box>
      {branchName && (
        <box>
          <text fg="#10b981">branch: {branchName}</text>
        </box>
      )}
      {error && (
        <box>
          <text fg="#ef4444">error: {error}</text>
        </box>
      )}
    </box>
  )
}
