import React from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { collapseForSingleLine } from '../lib/formatDisplay.js'
import { ActiveIssue } from '../types/index.js'
import { FG_BODY, ISSUE_STATUS_COLORS, SEM_GREEN, SEM_RED } from './shared/tuiTheme.js'

interface Props {
  activeIssue: ActiveIssue
}

const statusLabel: Record<string, { label: string; color: string }> = {
  pending: { label: 'PENDING', color: ISSUE_STATUS_COLORS.pending },
  analyzing: { label: 'ANALYZING', color: ISSUE_STATUS_COLORS.analyzing },
  applying: { label: 'APPLYING', color: ISSUE_STATUS_COLORS.applying },
  pushing: { label: 'PUSHING', color: ISSUE_STATUS_COLORS.pushing },
  done: { label: 'DONE', color: ISSUE_STATUS_COLORS.done },
  failed: { label: 'FAILED', color: ISSUE_STATUS_COLORS.failed }
}

export const IssueItem: React.FC<Props> = ({ activeIssue }) => {
  const { issue, status, branchName, error } = activeIssue
  const { label, color } = statusLabel[status] ?? { label: status.toUpperCase(), color: FG_BODY }

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
          <text fg={SEM_GREEN}>branch: {branchName}</text>
        </box>
      )}
      {error && (
        <box>
          <text fg={SEM_RED}>error: {error}</text>
        </box>
      )}
    </box>
  )
}
