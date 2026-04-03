import { useState, useCallback, useEffect, useMemo, type ReactElement } from 'react'
import type { KeyEvent } from '@opentui/core'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import type { RuntimeState, SessionDetail } from '../../runtime/types.js'
import type { AgentConfig, AgentChatStatus, LogEntry } from '../../types/index.js'
import { DashboardHeader } from '../DashboardHeader.js'
import { SessionListPane } from '../panes/SessionListPane.js'
import { SessionDetailPane } from '../panes/SessionDetailPane.js'
import { ChatComposer } from '../ChatComposer.js'
import { LogsDock } from '../LogsDock.js'
import { FooterHints, type FooterHintItem } from '../panes/FooterHints.js'

// ── Constants ───────────────────────────────────────────────────────────────

/** Below this width, stack sessions vs detail and use a multi-line header. */
const NARROW_BREAKPOINT = 120

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
  suspendKeyboard = false,
}: Props): ReactElement {
  // ── Dimensions ──────────────────────────────────────────────────────────────

  const { width: columns, height: rows } = useTerminalDimensions()
  const isNarrow = columns < NARROW_BREAKPOINT

  const contentWidth = isNarrow
    ? Math.max(20, columns - 8)
    : Math.max(20, columns - 37)
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
  const selectedDetail = selectedSession
    ? (sessionDetails.get(selectedSession.chatId) ?? null)
    : null
  const selectedChatStatus = selectedSession
    ? (chatStatuses.get(selectedSession.chatId) ?? null)
    : null

  const showListPane = !isNarrow || !selectedDetail || !narrowShowsDetail
  const showDetailPane = !isNarrow || Boolean(selectedDetail && narrowShowsDetail)
  const showComposer = showDetailPane && selectedDetail !== null
  const hasSessions = state.sessions.length > 0

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

  // Load messages when a new session is highlighted.
  useEffect(() => {
    if (selectedSession) onLoadMessages(selectedSession.chatId)
  }, [clampedIndex])

  // ── Focus helpers ───────────────────────────────────────────────────────────

  const focusNext = useCallback(() => {
    const panes: FocusedPane[] = showComposer
      ? (showLogs ? ['list', 'detail', 'composer', 'logs'] : ['list', 'detail', 'composer'])
      : (showLogs ? ['list', 'detail', 'logs'] : ['list', 'detail'])
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

  // ── Footer hints ────────────────────────────────────────────────────────────

  const stackToggleHint = useMemo((): FooterHintItem | null => {
    if (!isNarrow || !selectedDetail) return null
    return {
      id: 'stack',
      keys: 'v',
      label: narrowShowsDetail ? 'Sessions' : 'Detail',
      onPress: toggleNarrowStack,
    }
  }, [isNarrow, selectedDetail?.chatId, narrowShowsDetail, toggleNarrowStack])

  const commonHints = useMemo((): FooterHintItem[] => [
    ...(stackToggleHint ? [stackToggleHint] : []),
    {
      id: 'logs',
      keys: 'l',
      label: showLogs ? 'Hide logs' : 'Logs',
      onPress: toggleLogs,
    },
    {
      id: 'quit',
      keys: 'q',
      label: 'Quit',
      alt: 'q / Ctrl+C',
      onPress: onQuitRequest,
    },
  ], [stackToggleHint, showLogs, toggleLogs, onQuitRequest])

  const composeHint: FooterHintItem[] = showComposer
    ? [{ id: 'compose', keys: 'i', label: 'Compose' }]
    : []

  const hints = useMemo((): FooterHintItem[] => {
    switch (focusedPane) {
      case 'list': {
        const scrollHints: FooterHintItem[] = hasSessions
          ? [
            { id: 'page', keys: 'PgUp/Dn', label: 'Scroll' },
            { id: 'ends', keys: 'Hm/End', label: 'Ends' },
          ]
          : []
        return [
          { id: 'nav', keys: '↑↓', label: 'Navigate' },
          ...scrollHints,
          { id: 'detail', keys: 'Tab/↵', label: 'Detail' },
          ...composeHint,
          ...commonHints,
        ]
      }
      case 'detail':
        return [
          { id: 'scroll', keys: '↑↓·jk', label: 'Scroll' },
          ...composeHint,
          { id: 'page', keys: 'PgUp/Dn', label: 'Page' },
          { id: 'back', keys: 'Esc', label: 'List' },
          { id: 'focus', keys: 'Tab', label: 'Next' },
          ...commonHints,
        ]
      case 'composer':
        return [
          { id: 'send', keys: 'Ctrl+↵', label: 'Send' },
          { id: 'back', keys: 'Esc', label: 'Detail' },
          { id: 'focus', keys: 'Tab', label: 'Next' },
          ...commonHints.filter((h) => h.id !== 'quit'),
        ]
      case 'logs':
        return [
          { id: 'scroll', keys: '↑↓·jk', label: 'Scroll' },
          { id: 'page', keys: 'PgUp/Dn', label: 'Page' },
          { id: 'back', keys: 'Esc', label: 'List' },
          { id: 'focus', keys: 'Tab', label: 'Next' },
          ...commonHints,
        ]
    }
  }, [focusedPane, hasSessions, showComposer, composeHint, commonHints])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <box flexDirection='column' height={rows} gap={0}>
      {/* Header */}
      <DashboardHeader state={state} config={config} isNarrow={isNarrow} />

      {/* Main content: sidebar + detail column */}
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

      {/* Footer */}
      <FooterHints hints={hints} />
    </box>
  ) as ReactElement
}
