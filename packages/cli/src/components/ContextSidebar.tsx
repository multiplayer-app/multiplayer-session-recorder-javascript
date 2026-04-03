import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import type { SessionDetail, SessionStatus, RateLimitState } from '../runtime/types.js'
import type { AgentChatStatus } from '../types/index.js'

const SIDEBAR_WIDTH = 30

const STATUS_LABEL: Record<SessionStatus, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: '#6b7280' },
  analyzing: { label: 'Analyzing', color: '#f59e0b' },
  pushing:   { label: 'Pushing',   color: '#6366f1' },
  done:      { label: 'Done',      color: '#10b981' },
  failed:    { label: 'Failed',    color: '#ef4444' },
  aborted:   { label: 'Aborted',   color: '#6b7280' },
}

const STATUS_SYMBOL: Record<SessionStatus, string> = {
  pending:   '○',
  analyzing: '◐',
  pushing:   '◑',
  done:      '●',
  failed:    '✕',
  aborted:   '◌',
}

interface Props {
  session: SessionDetail | null
  chatStatus: AgentChatStatus | string | null
  workspace?: string
  project?: string
  rateLimitState: RateLimitState
  activeCount: number
  resolvedCount: number
  isFocused: boolean
}

function SectionTitle({ title }: { title: string }): ReactElement {
  return (
    <text fg='#9ca3af' attributes={tuiAttrs({ bold: true })}>
      {title}
    </text>
  ) as ReactElement
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }): ReactElement {
  return (
    <box flexDirection='column'>
      <text fg='#6b7280'>{label}</text>
      <text fg={valueColor ?? '#e5e7eb'}>{value}</text>
    </box>
  ) as ReactElement
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function ContextSidebarImpl({
  session,
  chatStatus,
  workspace,
  project,
  rateLimitState,
  activeCount,
  resolvedCount,
  isFocused,
}: Props): ReactElement {
  const borderColor = isFocused ? '#6366f1' : '#374151'

  if (!session) {
    return (
      <box
        width={SIDEBAR_WIDTH}
        flexShrink={0}
        flexDirection='column'
        border={true}
        borderStyle='rounded'
        borderColor={borderColor}
        padding={1}
        gap={2}
      >
        {/* Stats section */}
        <box flexDirection='column' gap={1}>
          <SectionTitle title='Stats' />
          {workspace && <InfoRow label='Workspace' value={workspace} />}
          {project && <InfoRow label='Project' value={project} />}
          <InfoRow label='Active:' value={String(activeCount)} valueColor='#f59e0b' />
          <InfoRow label='Resolved:' value={String(resolvedCount)} valueColor='#10b981' />
        </box>

        {/* Rate Limit */}
        <box flexDirection='column' gap={1}>
          <SectionTitle title='Rate Limit' />
          <box flexDirection='row' gap={1}>
            <text fg='#6b7280'>Slots:</text>
            <text fg={rateLimitState.active >= rateLimitState.limit ? '#ef4444' : '#e5e7eb'}>
              {rateLimitState.active} / {rateLimitState.limit}
            </text>
          </box>
        </box>
      </box>
    ) as ReactElement
  }

  const status = STATUS_LABEL[session.status]
  const symbol = STATUS_SYMBOL[session.status]

  // Chat activity indicator
  const chatActivity = (() => {
    if (!chatStatus) return null
    if (chatStatus === 'processing' || chatStatus === 'streaming') {
      return (
        <box flexDirection='row' gap={1}>
          <text fg='#f59e0b' attributes={tuiAttrs({ bold: true })}>●</text>
          <text fg='#f59e0b'>generating...</text>
        </box>
      )
    }
    if (chatStatus === 'error') {
      return (
        <box flexDirection='row' gap={1}>
          <text fg='#ef4444'>✕</text>
          <text fg='#ef4444'>error</text>
        </box>
      )
    }
    if (chatStatus === 'waitingForUserAction') {
      return (
        <box flexDirection='row' gap={1}>
          <text fg='#22d3ee'>◆</text>
          <text fg='#22d3ee'>awaiting input</text>
        </box>
      )
    }
    return null
  })()

  return (
    <box
      width={SIDEBAR_WIDTH}
      flexShrink={0}
      flexDirection='column'
      border={true}
      borderStyle='rounded'
      borderColor={borderColor}
      padding={1}
      gap={2}
    >
      {/* Status section */}
      <box flexDirection='column' gap={1}>
        <SectionTitle title='Status' />
        <box flexDirection='row' gap={1}>
          <text fg={status.color}>{symbol}</text>
          <text fg={status.color} attributes={tuiAttrs({ bold: true })}>{status.label}</text>
        </box>
        {chatActivity}
        <text fg='#4b5563' attributes={tuiAttrs({ dim: true })}>
          {timeAgo(session.startedAt)}
        </text>
      </box>

      {/* Session section */}
      <box flexDirection='column' gap={1}>
        <SectionTitle title='Session' />
        {workspace && <InfoRow label='Workspace' value={workspace} />}
        {project && <InfoRow label='Project' value={project} />}
        <InfoRow label='Service:' value={session.issueService} />
        {session.branchName && (
          <box flexDirection='column'>
            <text fg='#6b7280'>Branch:</text>
            <text fg='#818cf8'>{session.branchName}</text>
          </box>
        )}
        {session.prUrl && (
          <box flexDirection='column'>
            <text fg='#6b7280'>PR:</text>
            <text fg='#818cf8' attributes={tuiAttrs({ underline: true })}>
              {session.prUrl.length > SIDEBAR_WIDTH - 6
                ? session.prUrl.slice(0, SIDEBAR_WIDTH - 9) + '...'
                : session.prUrl}
            </text>
          </box>
        )}
        {session.error && (
          <box flexDirection='column'>
            <text fg='#ef4444'>Error:</text>
            <text fg='#fca5a5' attributes={tuiAttrs({ dim: true })}>
              {session.error.slice(0, 60)}
            </text>
          </box>
        )}
      </box>

      {/* Context section */}
      <box flexDirection='column' gap={1}>
        <SectionTitle title='Context' />
        <InfoRow label='Messages:' value={String(session.messages.length)} />
        <InfoRow label='Active:' value={String(activeCount)} valueColor='#f59e0b' />
        <InfoRow label='Resolved:' value={String(resolvedCount)} valueColor='#10b981' />
        <box flexDirection='row' gap={1}>
          <text fg='#6b7280'>Slots:</text>
          <text fg={rateLimitState.active >= rateLimitState.limit ? '#ef4444' : '#e5e7eb'}>
            {rateLimitState.active} / {rateLimitState.limit}
          </text>
        </box>
      </box>
    </box>
  ) as ReactElement
}

export const ContextSidebar = ContextSidebarImpl as (props: Props) => ReactElement
