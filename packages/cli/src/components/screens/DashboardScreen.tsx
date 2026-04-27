import { useState, useCallback, useEffect, useMemo, type ReactElement } from 'react'
import type { KeyEvent } from '@opentui/core'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import type { RuntimeState, SessionDetail } from '../../runtime/types.js'
import type { AgentConfig, AgentChatStatus, LogEntry } from '../../types/index.js'
import { DashboardHeader } from '../DashboardHeader.js'
import { SessionListPane } from '../panes/SessionListPane.js'
import { SessionDetailPane } from '../panes/SessionDetailPane.js'
import { ChatComposer } from '../ChatComposer.js'
import { ContextSidebar } from '../ContextSidebar.js'
import { LogsDock } from '../LogsDock.js'
import { StatusBar, type StatusBarHint } from '../StatusBar.js'
import pkg from '../../../package.json' with { type: 'json' }

// ── Constants ───────────────────────────────────────────────────────────────

/** Below this width, stack sessions vs detail and hide context sidebar. */
const NARROW_BREAKPOINT = 120

/** Below this width, hide the context sidebar even in wide mode. */
const SIDEBAR_BREAKPOINT = 150

const CLI_VERSION = pkg.version

type FocusedPane = 'list' | 'detail' | 'composer' | 'logs'

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  state: RuntimeState
  config: AgentConfig
  sessionDetails: Map<string, SessionDetail>
  agentLogs: LogEntry[]
  chatStatuses: Map<string, AgentChatStatus | string>
  onQuitRequest: () => void
  onLoadMessages: (chatId: string, before?: string) => void
  onSendMessage: (chatId: string, content: string) => void
  onAbortChat: (chatId: string) => void
  onSubscribeSession: (chatId: string) => void
  onUnsubscribeSession: (chatId: string) => void
  onLoadMoreSessions?: () => void
  hasMoreSessions?: boolean
  /** When true (e.g. quit dialog open), ignore keys so the overlay handles them. */
  suspendKeyboard?: boolean
}

// ── Component ───────────────────────────────────────────────────────────────

export function DashboardScreen({
  state,
  config,
  sessionDetails,
  agentLogs,
  chatStatuses,
  onQuitRequest,
  onLoadMessages,
  onSendMessage,
  onAbortChat,
  onSubscribeSession,
  onUnsubscribeSession,
  onLoadMoreSessions,
  hasMoreSessions = false,
  suspendKeyboard = false,
}: Props): ReactElement {
  // ── Dimensions ──────────────────────────────────────────────────────────────

  const { width: columns, height: rows } = useTerminalDimensions()
  const isNarrow = columns < NARROW_BREAKPOINT
  const showContextSidebar = columns >= SIDEBAR_BREAKPOINT

  const contentWidth = isNarrow
    ? Math.max(20, columns - 10)
    : showContextSidebar
      ? Math.max(20, columns - 71) // list(32) + sidebar(30) + border(2) + pad(2) + scrollbar(1) + innerPad(2) + gap(2)
      : Math.max(20, columns - 41)
  const listFluidTextWidth = Math.max(16, columns - 10)
  const logBlockHeight = Math.min(28, Math.max(8, rows - 10))

  // ── Focus & selection state ─────────────────────────────────────────────────

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [focusedPane, setFocusedPane] = useState<FocusedPane>('list')
  const [showLogs, setShowLogs] = useState(false)
  const [narrowShowsDetail, setNarrowShowsDetail] = useState(false)

  // ── Derived values ──────────────────────────────────────────────────────────

  const clampedIndex = Math.min(selectedIndex, Math.max(0, state.sessions.length - 1))
  const selectedSession = state.sessions[clampedIndex]
  const selectedDetail = selectedSession ? (sessionDetails.get(selectedSession.chatId) ?? null) : null
  const selectedChatStatus = selectedSession ? (chatStatuses.get(selectedSession.chatId) ?? null) : null

  const showListPane = !isNarrow || !selectedDetail || !narrowShowsDetail
  const showDetailPane = !isNarrow || Boolean(selectedDetail && narrowShowsDetail)
  const showComposer = showDetailPane && selectedDetail !== null
  const hasSessions = state.sessions.length > 0

  const activeCount = state.sessions.filter((s) => !['done', 'failed', 'aborted'].includes(s.status)).length

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Auto-show detail in narrow mode when a session is first selected.
  // Also kick focus out of composer if the session goes away.
  useEffect(() => {
    if (!selectedDetail) {
      setNarrowShowsDetail(false)
      setFocusedPane((fp) => (fp === 'composer' ? 'detail' : fp))
      return
    }
    setNarrowShowsDetail(true)
  }, [selectedDetail?.chatId])

  // Subscribe to chat events when a session is selected; unsubscribe on change.
  useEffect(() => {
    if (!selectedSession) return
    const chatId = selectedSession.chatId
    onSubscribeSession(chatId)
    return () => onUnsubscribeSession(chatId)
  }, [selectedSession?.chatId, onSubscribeSession, onUnsubscribeSession])

  // Load messages when a new session is highlighted.
  useEffect(() => {
    if (selectedSession) onLoadMessages(selectedSession.chatId)
  }, [selectedSession?.chatId])

  // ── Focus helpers ───────────────────────────────────────────────────────────

  const focusNext = useCallback(() => {
    const panes: FocusedPane[] = showComposer
      ? showLogs
        ? ['list', 'detail', 'composer', 'logs']
        : ['list', 'detail', 'composer']
      : showLogs
        ? ['list', 'detail', 'logs']
        : ['list', 'detail']
    const idx = panes.indexOf(focusedPane)
    const next = panes[(idx + 1) % panes.length]!
    if (isNarrow && selectedDetail) {
      setNarrowShowsDetail(next !== 'list')
    }
    setFocusedPane(next)
  }, [focusedPane, showLogs, showComposer, isNarrow, selectedDetail])

  const toggleLogs = useCallback(() => {
    setShowLogs((show) => {
      if (show) {
        setFocusedPane((fp) => (fp === 'logs' ? 'list' : fp))
      } else {
        setFocusedPane('logs')
      }
      return !show
    })
  }, [])

  const toggleNarrowStack = useCallback(() => {
    if (!isNarrow || !selectedDetail) return
    setNarrowShowsDetail((show) => {
      const next = !show
      setFocusedPane((fp) => (fp === 'logs' ? fp : next ? 'detail' : 'list'))
      return next
    })
  }, [isNarrow, selectedDetail])

  // ── Keyboard ────────────────────────────────────────────────────────────────

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (suspendKeyboard) return
        const { name } = key

        // ── Global shortcuts ──────────────────────────────────────────────

        if (name === 'tab') {
          focusNext()
          key.stopPropagation()
          return
        }

        if ((name === 'v' || name === 'V') && isNarrow && selectedDetail) {
          toggleNarrowStack()
          key.stopPropagation()
          return
        }

        // Escape: context-sensitive back navigation (works in all panes incl. composer).
        if (name === 'escape') {
          if (focusedPane === 'composer') {
            setFocusedPane('detail')
          } else {
            if (isNarrow && selectedDetail) setNarrowShowsDetail(false)
            setFocusedPane('list')
          }
          key.stopPropagation()
          return
        }

        // Don't steal single-char keys while typing in the composer.
        if (focusedPane === 'composer') return

        if (name === 'l' || name === 'L') {
          toggleLogs()
          key.stopPropagation()
          return
        }

        if (name === 'i') {
          if (showComposer) {
            if (isNarrow) setNarrowShowsDetail(true)
            setFocusedPane('composer')
          }
          key.stopPropagation()
          return
        }

        // ── Pane-local shortcuts ──────────────────────────────────────────

        if (focusedPane === 'list') {
          if (name === 'up') {
            setSelectedIndex((i) => Math.max(0, i - 1))
            key.stopPropagation()
          } else if (name === 'down') {
            setSelectedIndex((i) => Math.min(state.sessions.length - 1, i + 1))
            key.stopPropagation()
          } else if (name === 'return' && selectedDetail) {
            if (isNarrow) setNarrowShowsDetail(true)
            setFocusedPane('detail')
            key.stopPropagation()
          }
        }

        if (name === 'q' || name === 'Q') {
          onQuitRequest()
          key.stopPropagation()
        }
      },
      [
        suspendKeyboard,
        focusedPane,
        focusNext,
        state.sessions.length,
        selectedDetail,
        showComposer,
        onQuitRequest,
        showLogs,
        toggleLogs,
        isNarrow,
        toggleNarrowStack,
      ],
    ),
  )

  // ── Status bar hints ────────────────────────────────────────────────────────

  const hints = useMemo((): StatusBarHint[] => {
    const base: StatusBarHint[] = [{ id: 'tab', keys: 'tab', label: 'navigate' }]

    switch (focusedPane) {
      case 'list':
        base.push({ id: 'nav', keys: '↑↓', label: 'select' }, { id: 'enter', keys: '↵', label: 'open' })
        break
      case 'detail':
        base.push({ id: 'scroll', keys: '↑↓', label: 'scroll' }, { id: 'page', keys: 'PgUp/Dn', label: 'page' })
        break
      case 'composer':
        base.push({ id: 'send', keys: '↵', label: 'send' }, { id: 'esc', keys: 'Esc', label: 'back' })
        break
      case 'logs':
        base.push({ id: 'scroll', keys: '↑↓', label: 'scroll' })
        break
    }

    if (showComposer && focusedPane !== 'composer') {
      base.push({ id: 'compose', keys: 'i', label: 'compose' })
    }

    if (isNarrow && selectedDetail) {
      base.push({
        id: 'stack',
        keys: 'v',
        label: narrowShowsDetail ? 'sessions' : 'detail',
        onPress: toggleNarrowStack,
      })
    }

    base.push(
      { id: 'logs', keys: 'l', label: showLogs ? 'hide logs' : 'logs', onPress: toggleLogs },
      { id: 'quit', keys: 'q', label: 'quit', onPress: onQuitRequest },
    )

    return base
  }, [
    focusedPane,
    showComposer,
    showLogs,
    isNarrow,
    selectedDetail,
    narrowShowsDetail,
    toggleNarrowStack,
    toggleLogs,
    onQuitRequest,
  ])

  // Resolve display names for sidebar
  const workspaceLabel =
    state.workspaceDisplayName?.trim() ||
    config.workspaceDisplayName?.trim() ||
    (config.workspace ? config.workspace.slice(-8) : '')
  const projectLabel =
    state.projectDisplayName?.trim() ||
    config.projectDisplayName?.trim() ||
    (config.project ? config.project.slice(-8) : '')

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <box flexDirection='column' height={rows} gap={0}>
      {/* Header - slim single line */}
      <DashboardHeader state={state} config={config} isNarrow={isNarrow} />

      {/* Main content: sidebar + detail + context */}
      <box flexDirection='row' flexGrow={1} gap={showListPane && showDetailPane ? 1 : 0}>
        {showListPane && (
          <SessionListPane
            sessions={state.sessions}
            selectedIndex={clampedIndex}
            isFocused={focusedPane === 'list'}
            layout={isNarrow ? 'fluid' : 'sidebar'}
            fluidTextWidth={listFluidTextWidth}
            onSelectSession={(index) => {
              setSelectedIndex(index)
              setFocusedPane('list')
            }}
            hasMore={hasMoreSessions}
            onLoadMore={onLoadMoreSessions}
          />
        )}

        {showDetailPane && (
          <box flexDirection='column' flexGrow={1}>
            <SessionDetailPane
              session={selectedDetail}
              contentWidth={contentWidth}
              isFocused={focusedPane === 'detail'}
              hasSessions={hasSessions}
              onRequestFocus={() => setFocusedPane('detail')}
              onRequestLoadMore={() =>
                selectedDetail?.messages[0]?.id &&
                onLoadMessages(selectedSession?.chatId ?? '', selectedDetail.messages[0].id)
              }
            />
            {showComposer && (
              <ChatComposer
                chatId={selectedSession?.chatId ?? null}
                chatStatus={selectedChatStatus}
                isFocused={focusedPane === 'composer'}
                width={contentWidth}
                onSend={onSendMessage}
                onAbort={onAbortChat}
                onRequestFocus={() => setFocusedPane('composer')}
                onEscape={() => setFocusedPane('detail')}
              />
            )}
          </box>
        )}

        {/* Context sidebar - right panel (wide screens only) */}
        {showContextSidebar && showDetailPane && (
          <ContextSidebar
            session={selectedDetail}
            chatStatus={selectedChatStatus}
            workspace={workspaceLabel || undefined}
            project={projectLabel || undefined}
            rateLimitState={state.rateLimitState}
            activeCount={activeCount}
            resolvedCount={state.resolvedCount}
            isFocused={false}
          />
        )}
      </box>

      {/* Logs dock (toggleable) */}
      {showLogs && (
        <LogsDock
          logs={agentLogs}
          height={logBlockHeight}
          isFocused={focusedPane === 'logs'}
          onRequestFocus={() => setFocusedPane('logs')}
        />
      )}

      {/* Status bar - clean single line at bottom */}
      <StatusBar hints={hints} version={CLI_VERSION} />
    </box>
  ) as ReactElement
}
