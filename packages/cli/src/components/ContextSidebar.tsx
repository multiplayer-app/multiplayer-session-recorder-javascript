import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { openUrl } from '../lib/openUrl.js'
import { clickHandler } from './shared/clickHandler.js'
import { FocusedOutlineButton } from './shared/FocusedOutlineButton.js'
import type { SessionDetail, SessionStatus, RateLimitState } from '../runtime/types.js'
import type { AgentChatStatus } from '../types/index.js'
import type { GitSettings } from '../cli/profile.js'
import {
  ACCENT,
  BORDER_MUTED,
  BRAND_MARK_PRIMARY,
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

const SIDEBAR_SCROLL_STYLE = {
  wrapperOptions: { flexGrow: 1 },
  viewportOptions: { flexGrow: 1 },
  scrollbarOptions: {
    showArrows: false,
    trackOptions: {
      foregroundColor: ACCENT,
      backgroundColor: BORDER_MUTED
    }
  }
} as const

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
  workspaceId?: string
  projectId?: string
  rateLimitState: RateLimitState
  activeCount: number
  resolvedCount: number
  gitSettings?: GitSettings
  isFocused: boolean
  onOpenSettings?: () => void
}

const GIT_FIELD_LABELS: { key: keyof GitSettings; label: string }[] = [
  { key: 'commit', label: 'Commit' },
  { key: 'branch_create', label: 'Branch' },
  { key: 'pr_create', label: 'PR' },
  { key: 'push', label: 'Push' },
  { key: 'use_worktree', label: 'Worktree' }
]

function GitSection({ git }: { git: GitSettings }): ReactElement {
  return (
    <box flexDirection='column' gap={0}>
      <SectionTitle title='Git' />
      {GIT_FIELD_LABELS.map(({ key, label }) => {
        const on = git[key] ?? true
        return (
          <box key={key} flexDirection='row' justifyContent='space-between'>
            <text fg={FG_DIM}>{label}</text>
            <text fg={on ? SEM_GREEN : FG_DIM}>{on ? 'on' : 'off'}</text>
          </box>
        )
      })}
    </box>
  ) as ReactElement
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

const getBrowserUrl = (workspaceId?: string, projectId?: string, session?: SessionDetail | null): string | null => {
  if (!workspaceId || !projectId) return null
  let url = `https://go.multiplayer.app/project/${workspaceId}/${projectId}/default/agents`
  if (session) {
    url += `/session/${session.id}`
  }
  return url
}

function ContextSidebarImpl({
  session,
  chatStatus,
  workspace,
  project,
  workspaceId,
  projectId,
  rateLimitState,
  activeCount,
  resolvedCount,
  gitSettings,
  isFocused,
  onOpenSettings
}: Props): ReactElement {
  const borderColor = isFocused ? SEM_INDIGO : BORDER_MUTED
  const browserUrl = getBrowserUrl(workspaceId, projectId, session)

  const actionButtons = (
    <box flexDirection='column' gap={0} marginTop={1} flexShrink={0}>
      {browserUrl && (
        <FocusedOutlineButton
          label='Open in browser'
          idleBorderColor={BRAND_MARK_PRIMARY}
          onPress={() => openUrl(browserUrl)}
        />
      )}
      {onOpenSettings && <FocusedOutlineButton label='Settings' onPress={onOpenSettings} />}
    </box>
  )

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
        paddingBottom={0}
        gap={1}
      >
        <scrollbox flexGrow={1} flexShrink={1} minHeight={0} scrollY focused={false} style={SIDEBAR_SCROLL_STYLE}>
          <box flexDirection='column' flexShrink={0} width='100%' gap={2}>
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

            {gitSettings && <GitSection git={gitSettings} />}
          </box>
        </scrollbox>

        {actionButtons}
      </box>
    ) as ReactElement
  }

  const status = STATUS_LABEL[session.status]
  const symbol = STATUS_SYMBOL[session.status]

  // Chat activity indicator
  const chatActivity = (() => {
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
      paddingBottom={0}
      gap={1}
    >
      <scrollbox flexGrow={1} flexShrink={1} minHeight={0} scrollY focused={false} style={SIDEBAR_SCROLL_STYLE}>
        <box flexDirection='column' flexShrink={0} width='100%' gap={2}>
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

          {gitSettings && <GitSection git={gitSettings} />}
        </box>
      </scrollbox>
      {actionButtons}
    </box>
  ) as ReactElement
}

export const ContextSidebar = ContextSidebarImpl as (props: Props) => ReactElement
