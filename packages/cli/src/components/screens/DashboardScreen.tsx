import { useState, useCallback, useEffect, useMemo, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { KeyEvent, MouseEvent } from '@opentui/core'
import { MouseButton } from '@opentui/core'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import type { RuntimeState, SessionDetail } from '../../runtime/types.js'
import type { AgentConfig, LogEntry } from '../../types/index.js'
import { LogOutput } from '../LogOutput.js'
import { SessionListPane } from '../panes/SessionListPane.js'
import { SessionDetailPane } from '../panes/SessionDetailPane.js'
import { FooterHints, type FooterHintItem } from '../panes/FooterHints.js'

type ConnectionState = RuntimeState['connection']

/** Below this width, stack sessions vs detail and use a multi-line header. */
const NARROW_COLUMNS = 120

const CONNECTION_BADGE: Record<ConnectionState, { symbol: string; color: string }> = {
  idle: { symbol: '○', color: '#6b7280' },
  connecting: { symbol: '◌', color: '#f59e0b' },
  connected: { symbol: '●', color: '#10b981' },
  disconnected: { symbol: '○', color: '#6b7280' },
  error: { symbol: '✕', color: '#ef4444' },
}

interface Props {
  state: RuntimeState
  config: AgentConfig
  sessionDetails: Map<string, SessionDetail>
  agentLogs: LogEntry[]
  onQuitRequest: () => void
  onLoadMessages: (chatId: string, before?: string) => void
  /** When true (e.g. quit dialog open), ignore keys so the overlay handles them. */
  suspendKeyboard?: boolean
}

export function DashboardScreen({
  state,
  config,
  sessionDetails,
  agentLogs,
  onQuitRequest,
  onLoadMessages,
  suspendKeyboard = false,
}: Props): ReactElement {
  const { width: columns, height: rows } = useTerminalDimensions()
  const isNarrow = columns < NARROW_COLUMNS

  // Wide: sidebar(32) + borders/padding ≈ 37. Narrow: single pane — borders/padding only.
  const contentWidth = isNarrow
    ? Math.max(20, columns - 8)
    : Math.max(20, columns - 37)
  const listFluidTextWidth = Math.max(16, columns - 10)

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [focusedPane, setFocusedPane] = useState<'list' | 'detail' | 'logs'>('list')
  const [showAgentLogs, setShowAgentLogs] = useState(false)
  /** Narrow layout: when detail is loaded, true = detail pane, false = session list. */
  const [narrowShowsDetail, setNarrowShowsDetail] = useState(false)

  const toggleAgentLogs = useCallback(() => {
    setShowAgentLogs((show) => {
      if (show) {
        setFocusedPane((fp) => (fp === 'logs' ? 'list' : fp))
      } else {
        setFocusedPane('logs')
      }
      return !show
    })
  }, [])

  const logBlockHeight = Math.min(28, Math.max(8, rows - 10))

  const clampedIndex = Math.min(selectedIndex, Math.max(0, state.sessions.length - 1))
  const selectedSession = state.sessions[clampedIndex]
  const selectedDetail = selectedSession ? (sessionDetails.get(selectedSession.chatId) ?? null) : null

  const showListPane = !isNarrow || !selectedDetail || !narrowShowsDetail
  const showDetailPane = !isNarrow || Boolean(selectedDetail && narrowShowsDetail)

  useEffect(() => {
    if (!selectedDetail) {
      setNarrowShowsDetail(false)
      return
    }
    setNarrowShowsDetail(true)
  }, [selectedDetail?.chatId])

  const toggleNarrowStack = useCallback(() => {
    if (!isNarrow || !selectedDetail) return
    setNarrowShowsDetail((show) => {
      const next = !show
      setFocusedPane((fp) => (fp === 'logs' ? fp : next ? 'detail' : 'list'))
      return next
    })
  }, [isNarrow, selectedDetail])

  const stackToggleHint = useMemo((): FooterHintItem | null => {
    if (!isNarrow || !selectedDetail) return null
    return {
      id: 'stack',
      keys: 'v',
      label: narrowShowsDetail ? 'Sessions' : 'Detail',
      onPress: toggleNarrowStack,
    }
  }, [isNarrow, selectedDetail?.chatId, narrowShowsDetail, toggleNarrowStack])

  const listHints = useMemo((): FooterHintItem[] => {
    const scrollListHints: FooterHintItem[] =
      state.sessions.length > 0
        ? [
          { id: 'list-page', keys: 'PgUp/Dn', label: 'Scroll list' },
          { id: 'list-ends', keys: 'Hm/End', label: 'List ends' },
        ]
        : []
    return [
      { id: 'nav', keys: '↑↓', label: 'Move' },
      ...scrollListHints,
      { id: 'detail', keys: 'Tab/↵', label: 'Detail' },
      ...(stackToggleHint ? [stackToggleHint] : []),
      {
        id: 'logs',
        keys: 'l',
        label: showAgentLogs ? 'Hide logs' : 'Show logs',
        onPress: toggleAgentLogs,
      },
      {
        id: 'quit',
        keys: 'q',
        label: 'Quit',
        alt: 'q / Ctrl+C',
        onPress: () => onQuitRequest(),
      },
    ]
  }, [
    showAgentLogs,
    onQuitRequest,
    state.sessions.length,
    toggleAgentLogs,
    stackToggleHint,
  ])

  const detailHints = useMemo((): FooterHintItem[] => {
    return [
      { id: 'scroll', keys: '↑↓·jk·wheel', label: 'Scroll' },
      { id: 'page', keys: 'PgUp/Dn', label: 'Page' },
      { id: 'ends', keys: 'Hm/End', label: 'Ends' },
      {
        id: 'sessions',
        keys: 'Tab/Esc',
        label: showAgentLogs ? 'List · logs' : 'List',
      },
      ...(stackToggleHint ? [stackToggleHint] : []),
      {
        id: 'logs',
        keys: 'l',
        label: showAgentLogs ? 'Hide logs' : 'Show logs',
        onPress: toggleAgentLogs,
      },
      {
        id: 'quit',
        keys: 'q',
        label: 'Quit',
        alt: 'q / Ctrl+C',
        onPress: () => onQuitRequest(),
      },
    ]
  }, [showAgentLogs, onQuitRequest, toggleAgentLogs, stackToggleHint])

  const logsHints = useMemo((): FooterHintItem[] => {
    return [
      { id: 'scroll', keys: '↑↓·jk·wheel', label: 'Scroll logs' },
      { id: 'page', keys: 'PgUp/Dn', label: 'Page' },
      { id: 'ends', keys: 'Hm/End', label: 'Ends' },
      {
        id: 'focus',
        keys: 'Tab',
        label: showAgentLogs ? 'List · detail · logs' : 'List · detail',
      },
      { id: 'back', keys: 'Esc', label: 'List' },
      ...(stackToggleHint ? [stackToggleHint] : []),
      {
        id: 'logs',
        keys: 'l',
        label: 'Hide logs',
        onPress: toggleAgentLogs,
      },
      {
        id: 'quit',
        keys: 'q',
        label: 'Quit',
        alt: 'q / Ctrl+C',
        onPress: () => onQuitRequest(),
      },
    ]
  }, [showAgentLogs, onQuitRequest, toggleAgentLogs, stackToggleHint])

  useEffect(() => {
    const session = state.sessions[clampedIndex]
    if (session) onLoadMessages(session.chatId)
  }, [clampedIndex])

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (suspendKeyboard) return
        const { name } = key
        if (name === 'tab') {
          if (showAgentLogs) {
            const next =
              focusedPane === 'list' ? 'detail' : focusedPane === 'detail' ? 'logs' : 'list'
            if (isNarrow && selectedDetail) {
              if (next === 'detail') setNarrowShowsDetail(true)
              if (next === 'list') setNarrowShowsDetail(false)
            }
            setFocusedPane(next)
          } else if (isNarrow && selectedDetail) {
            setNarrowShowsDetail((show) => {
              const next = !show
              setFocusedPane(next ? 'detail' : 'list')
              return next
            })
          } else if (!isNarrow) {
            setFocusedPane((p) => (p === 'list' ? 'detail' : 'list'))
          }
          key.stopPropagation()
          return
        }

        if (name === 'v' || name === 'V') {
          if (isNarrow && selectedDetail) {
            toggleNarrowStack()
            key.stopPropagation()
          }
          return
        }

        if (name === 'l' || name === 'L') {
          toggleAgentLogs()
          key.stopPropagation()
          return
        }

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
        } else if (name === 'escape') {
          if (isNarrow && selectedDetail) setNarrowShowsDetail(false)
          setFocusedPane('list')
          key.stopPropagation()
        }
        // Detail / logs: focused <scrollbox> handles ↑↓ j/k PgUp/Dn Home/End + wheel

        if (name === 'q' || name === 'Q') {
          onQuitRequest()
          key.stopPropagation()
        }
      },
      [
        suspendKeyboard,
        focusedPane,
        state.sessions.length,
        selectedDetail,
        onQuitRequest,
        showAgentLogs,
        toggleAgentLogs,
        isNarrow,
        toggleNarrowStack,
      ],
    ),
  )

  const handleLogDockMouseUp = useCallback((e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    setFocusedPane('logs')
  }, [])

  const { symbol, color } = CONNECTION_BADGE[state.connection]
  const activeCount = state.sessions.filter((s) => !['done', 'failed', 'aborted'].includes(s.status)).length

  const headerWorkspaceLabel =
    state.workspaceDisplayName?.trim() ||
    config.workspaceDisplayName?.trim() ||
    (config.workspace ? config.workspace.slice(-8) : '')
  const headerProjectLabel =
    state.projectDisplayName?.trim() ||
    config.projectDisplayName?.trim() ||
    (config.project ? config.project.slice(-8) : '')

  const headerWide = (
    <box
      border={true}
      borderStyle='rounded'
      borderColor='#374151'
      padding={1}
      flexDirection='row'
      flexShrink={0}
      gap={2}
    >
      <text fg='#6366f1' attributes={tuiAttrs({ bold: true })}>
        ◆ MULTIPLAYER
      </text>
      <text attributes={tuiAttrs({ dim: true })}>│</text>
      <text fg={color}>
        {symbol} {state.connection}
      </text>
      {state.connectionError && <text fg='#ef4444'>{state.connectionError}</text>}
      {config.workspace && (
        <>
          <text attributes={tuiAttrs({ dim: true })}>│ workspace:</text>
          <text>{headerWorkspaceLabel}</text>
        </>
      )}
      {config.project && (
        <>
          <text attributes={tuiAttrs({ dim: true })}>project:</text>
          <text>{headerProjectLabel}</text>
        </>
      )}
      <text attributes={tuiAttrs({ dim: true })}>│ model:</text>
      <text>{config.model}</text>
      <text attributes={tuiAttrs({ dim: true })}>│</text>
      {activeCount > 0 && (
        <>
          <text fg='#f59e0b'>{activeCount} active</text>
          <text attributes={tuiAttrs({ dim: true })}>│</text>
        </>
      )}
      <text fg='#10b981'>{state.resolvedCount} resolved</text>
    </box>
  )

  const headerNarrow = (
    <box
      border={true}
      borderStyle='rounded'
      borderColor='#374151'
      padding={1}
      flexDirection='column'
      flexShrink={0}
      gap={1}
    >
      <box flexDirection='row' flexWrap='wrap' gap={2}>
        <text fg='#6366f1' attributes={tuiAttrs({ bold: true })}>
          ◆ MULTIPLAYER
        </text>
        <text attributes={tuiAttrs({ dim: true })}>│</text>
        <text fg={color}>
          {symbol} {state.connection}
        </text>
        {state.connectionError ? <text fg='#ef4444'>{state.connectionError}</text> : null}
      </box>
      {(config.workspace || config.project) && (
        <box flexDirection='row' flexWrap='wrap' gap={2}>
          {config.workspace ? (
            <>
              <text attributes={tuiAttrs({ dim: true })}>workspace:</text>
              <text>{headerWorkspaceLabel}</text>
            </>
          ) : null}
          {config.workspace && config.project ? <text attributes={tuiAttrs({ dim: true })}>│</text> : null}
          {config.project ? (
            <>
              <text attributes={tuiAttrs({ dim: true })}>project:</text>
              <text>{headerProjectLabel}</text>
            </>
          ) : null}
        </box>
      )}
      <box flexDirection='row' flexWrap='wrap' gap={2}>
        <text attributes={tuiAttrs({ dim: true })}>model:</text>
        <text>{config.model}</text>
        {activeCount > 0 ? (
          <>
            <text attributes={tuiAttrs({ dim: true })}>│</text>
            <text fg='#f59e0b'>{activeCount} active</text>
          </>
        ) : null}
        <text attributes={tuiAttrs({ dim: true })}>│</text>
        <text fg='#10b981'>{state.resolvedCount} resolved</text>
      </box>
    </box>
  )

  return (
    <box flexDirection='column' height={rows} gap={0}>
      {isNarrow ? headerNarrow : headerWide}

      <box
        flexDirection='row'
        flexGrow={1}
        gap={showListPane && showDetailPane ? 1 : 0}
      >
        {showListPane ? (
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
        ) : null}
        {showDetailPane ? (
          <SessionDetailPane
            session={selectedDetail}
            contentWidth={contentWidth}
            isFocused={focusedPane === 'detail'}
            onRequestFocus={() => setFocusedPane('detail')}
            onRequestLoadMore={() =>
              selectedDetail?.messages[0]?.id &&
              onLoadMessages(selectedSession?.chatId ?? '', selectedDetail?.messages[0]?.id)
            }
          />
        ) : null}
      </box>

      {/* Runtime logs (TUI only — headless still uses JSON lines on stdout/stderr) */}
      {showAgentLogs && (
        <box
          border={true}
          borderStyle='rounded'
          borderColor='#374151'
          padding={1}
          flexShrink={0}
          flexDirection='column'
          gap={1}
          height={logBlockHeight}
          onMouseUp={handleLogDockMouseUp}
        >
          <text flexShrink={0} attributes={tuiAttrs({ dim: true, bold: true })}>
            Logs
          </text>
          <scrollbox
            flexGrow={1}
            scrollY
            focused={focusedPane === 'logs'}
            stickyScroll
            stickyStart='bottom'
            onMouseUp={handleLogDockMouseUp}
            style={{
              wrapperOptions: { flexGrow: 1 },
              viewportOptions: { flexGrow: 1 },
              scrollbarOptions: {
                showArrows: true,
                trackOptions: {
                  foregroundColor: '#a78bfa',
                  backgroundColor: '#374151',
                },
              },
            }}
          >
            <LogOutput logs={agentLogs} showTitle={false} />
          </scrollbox>
        </box>
      )}

      {/* Footer */}
      <FooterHints
        hints={focusedPane === 'list' ? listHints : focusedPane === 'detail' ? detailHints : logsHints}
      />
    </box>
  ) as ReactElement
}
