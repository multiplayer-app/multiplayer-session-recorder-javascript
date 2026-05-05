import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { openUrl } from '../lib/openUrl.js'
import { clickHandler } from './shared/clickHandler.js'
import { FocusedOutlineButton } from './shared/FocusedOutlineButton.js'
import type { SessionDetail, SessionStatus, RateLimitState } from '../runtime/types.js'
import type { AgentChatStatus } from '../types/index.js'
import {
  ACCENT,
  BORDER_MUTED,
  FG_DIM,
  FG_ERROR_SOFT,
  FG_META,
  FG_MUTED,
  FG_VALUE,
  LINK_SUBTLE,
  SEM_AMBER,
  SEM_GREEN,
  SEM_INDIGO,
  SEM_RED
} from './shared/tuiTheme.js'

const SIDEBAR_WIDTH = 30

const STATUS_LABEL: Record<SessionStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: FG_DIM },
  analyzing: { label: 'Analyzing', color: SEM_AMBER },
  pushing: { label: 'Pushing', color: SEM_INDIGO },
  done: { label: 'Done', color: SEM_GREEN },
  failed: { label: 'Failed', color: SEM_RED },
  aborted: { label: 'Aborted', color: FG_DIM }
}

const STATUS_SYMBOL: Record<SessionStatus, string> = {
  pending: '○',
  analyzing: '◐',
  pushing: '◑',
  done: '●',
  failed: '✕',
  aborted: '◌'
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
  onOpenAdvancedSettings?: () => void
}

function SectionTitle({ title }: { title: string }): ReactElement {
  return (
    <text fg={FG_MUTED} attributes={tuiAttrs({ bold: true })}>
      {title}
    </text>
  ) as ReactElement
}

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }): ReactElement {
  return (
    <box flexDirection='column'>
      <text fg={FG_DIM}>{label}</text>
      <text fg={valueColor ?? FG_VALUE}>{value}</text>
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
  onOpenAdvancedSettings
}: Props): ReactElement {
  const borderColor = isFocused ? SEM_INDIGO : BORDER_MUTED

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
          <InfoRow label='Active:' value={String(activeCount)} valueColor={SEM_AMBER} />
          <InfoRow label='Resolved:' value={String(resolvedCount)} valueColor={SEM_GREEN} />
        </box>

        {/* Rate Limit */}
        <box flexDirection='column' gap={1}>
          <SectionTitle title='Rate Limit' />
          <box flexDirection='row' gap={1}>
            <text fg={FG_DIM}>Slots:</text>
            <text fg={rateLimitState.active >= rateLimitState.limit ? SEM_RED : FG_VALUE}>
              {rateLimitState.active} / {rateLimitState.limit}
            </text>
          </box>
        </box>

        {onOpenAdvancedSettings && (
          <box flexDirection='column' gap={1} marginTop={1}>
            <FocusedOutlineButton label='Advanced settings' onPress={onOpenAdvancedSettings} />
          </box>
        )}
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
          <text fg={SEM_AMBER} attributes={tuiAttrs({ bold: true })}>
            ●
          </text>
          <text fg={SEM_AMBER}>generating...</text>
        </box>
      )
    }
    if (chatStatus === 'error') {
      return (
        <box flexDirection='row' gap={1}>
          <text fg={SEM_RED}>✕</text>
          <text fg={SEM_RED}>error</text>
        </box>
      )
    }
    if (chatStatus === 'waitingForUserAction') {
      return (
        <box flexDirection='row' gap={1}>
          <text fg={ACCENT}>◆</text>
          <text fg={ACCENT}>awaiting input</text>
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
          <text fg={status.color} attributes={tuiAttrs({ bold: true })}>
            {status.label}
          </text>
        </box>
        {chatActivity}
        <text fg={FG_META} attributes={tuiAttrs({ dim: true })}>
          {timeAgo(session.startedAt)}
        </text>
      </box>

      {/* Session section */}
      <box flexDirection='column' gap={1}>
        <SectionTitle title='Session' />
        {workspace && <InfoRow label='Workspace' value={workspace} />}
        {project && <InfoRow label='Project' value={project} />}
        {session.issueService && <InfoRow label='Service:' value={session.issueService} />}
        {session.agentName && <InfoRow label='Agent:' value={session.agentName} />}
        {session.model && <InfoRow label='Model:' value={session.model} />}
        {session.environmentName && <InfoRow label='Environment:' value={session.environmentName} />}
        {session.releaseVersion && <InfoRow label='Release:' value={session.releaseVersion} />}
        {session.debugSessionId && <InfoRow label='Debug Session:' value={session.debugSessionId.slice(-8)} />}
        {session.branchName && (
          <box flexDirection='column'>
            <text fg={FG_DIM}>Branch:</text>
            <text fg={LINK_SUBTLE}>{session.branchName}</text>
          </box>
        )}
        {session.prUrl && (
          <box flexDirection='column' onMouseUp={clickHandler(() => openUrl(session.prUrl!))}>
            <text fg={FG_DIM}>PR:</text>
            <text fg={LINK_SUBTLE} attributes={tuiAttrs({ underline: true })}>
              {session.prUrl.length > SIDEBAR_WIDTH - 6
                ? session.prUrl.slice(0, SIDEBAR_WIDTH - 9) + '...'
                : session.prUrl}
            </text>
          </box>
        )}
        {session.codeChanges && (
          <box flexDirection='column'>
            <text fg={FG_DIM}>Changes:</text>
            <box flexDirection='row' gap={1}>
              <text fg={SEM_GREEN}>+{session.codeChanges.additions}</text>
              <text fg={SEM_RED}>-{session.codeChanges.deletions}</text>
            </box>
          </box>
        )}
        {session.error && (
          <box flexDirection='column'>
            <text fg={SEM_RED}>Error:</text>
            <text fg={FG_ERROR_SOFT} attributes={tuiAttrs({ dim: true })}>
              {session.error.slice(0, 60)}
            </text>
          </box>
        )}
      </box>

      {/* Context section */}
      <box flexDirection='column' gap={1}>
        <SectionTitle title='Context' />
        <InfoRow label='Messages:' value={String(session.messages.length)} />
        <InfoRow label='Active:' value={String(activeCount)} valueColor={SEM_AMBER} />
        <InfoRow label='Resolved:' value={String(resolvedCount)} valueColor={SEM_GREEN} />
        <box flexDirection='row' gap={1}>
          <text fg={FG_DIM}>Slots:</text>
          <text fg={rateLimitState.active >= rateLimitState.limit ? SEM_RED : FG_VALUE}>
            {rateLimitState.active} / {rateLimitState.limit}
          </text>
        </box>
      </box>

      {onOpenAdvancedSettings && (
        <box flexDirection='column' gap={1} marginTop={1}>
          <FocusedOutlineButton label='Advanced settings' onPress={onOpenAdvancedSettings} />
        </box>
      )}
    </box>
  ) as ReactElement
}

export const ContextSidebar = ContextSidebarImpl as (props: Props) => ReactElement
