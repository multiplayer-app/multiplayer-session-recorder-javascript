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

const CONNECTION_BADGE: Record<ConnectionState, { symbol: string; color: string }> = {
  idle: { symbol: '○', color: '#6b7280' },
  connecting: { symbol: '◌', color: '#f59e0b' },
  connected: { symbol: '●', color: '#10b981' },
  disconnected: { symbol: '○', color: '#6b7280' },
  error: { symbol: '✕', color: '#ef4444' }
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
  suspendKeyboard = false
}: Props): ReactElement {
  const { width: columns, height: rows } = useTerminalDimensions()

  // sidebar(32) + its border(1) + pane border(1) + pane padding(1+1) + pane border(1) = 37
  const contentWidth = Math.max(20, columns - 37)

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [focusedPane, setFocusedPane] = useState<'list' | 'detail' | 'logs'>('list')
  const [showAgentLogs, setShowAgentLogs] = useState(false)

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

  const listHints = useMemo((): FooterHintItem[] => {
    const scrollListHints: FooterHintItem[] =
      state.sessions.length > 0
        ? [
            { id: 'list-page', keys: 'PgUp/Dn', label: 'Scroll list' },
            { id: 'list-ends', keys: 'Hm/End', label: 'List ends' }
          ]
        : []
    return [
      { id: 'nav', keys: '↑↓', label: 'Move' },
      ...scrollListHints,
      { id: 'detail', keys: 'Tab/↵', label: 'Detail' },
      {
        id: 'logs',
        keys: 'l',
        label: showAgentLogs ? 'Hide logs' : 'Show logs',
        onPress: toggleAgentLogs
      },
      {
        id: 'quit',
        keys: 'q',
        label: 'Quit',
        alt: 'q / Ctrl+C',
        onPress: () => onQuitRequest()
      }
    ]
  }, [showAgentLogs, onQuitRequest, state.sessions.length, toggleAgentLogs])

  const detailHints = useMemo((): FooterHintItem[] => {
    return [
      { id: 'scroll', keys: '↑↓·jk·wheel', label: 'Scroll' },
      { id: 'page', keys: 'PgUp/Dn', label: 'Page' },
      { id: 'ends', keys: 'Hm/End', label: 'Ends' },
      {
        id: 'sessions',
        keys: 'Tab/Esc',
        label: showAgentLogs ? 'List · logs' : 'List'
      },
      {
        id: 'logs',
        keys: 'l',
        label: showAgentLogs ? 'Hide logs' : 'Show logs',
        onPress: toggleAgentLogs
      },
      {
        id: 'quit',
        keys: 'q',
        label: 'Quit',
        alt: 'q / Ctrl+C',
        onPress: () => onQuitRequest()
      }
    ]
  }, [showAgentLogs, onQuitRequest, toggleAgentLogs])

  const logsHints = useMemo((): FooterHintItem[] => {
    return [
      { id: 'scroll', keys: '↑↓·jk·wheel', label: 'Scroll logs' },
      { id: 'page', keys: 'PgUp/Dn', label: 'Page' },
      { id: 'ends', keys: 'Hm/End', label: 'Ends' },
      {
        id: 'focus',
        keys: 'Tab',
        label: showAgentLogs ? 'List · detail · logs' : 'List · detail'
      },
      { id: 'back', keys: 'Esc', label: 'List' },
      {
        id: 'logs',
        keys: 'l',
        label: 'Hide logs',
        onPress: toggleAgentLogs
      },
      {
        id: 'quit',
        keys: 'q',
        label: 'Quit',
        alt: 'q / Ctrl+C',
        onPress: () => onQuitRequest()
      }
    ]
  }, [showAgentLogs, onQuitRequest, toggleAgentLogs])

  useEffect(() => {
    const session = state.sessions[clampedIndex]
    if (session) onLoadMessages(session.chatId)
  }, [clampedIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (suspendKeyboard) return
        const { name } = key
        if (name === 'tab') {
          setFocusedPane((p) => {
            if (!showAgentLogs) {
              return p === 'list' ? 'detail' : 'list'
            }
            if (p === 'list') return 'detail'
            if (p === 'detail') return 'logs'
            return 'list'
          })
          key.stopPropagation()
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
            setFocusedPane('detail')
            key.stopPropagation()
          }
        } else if (name === 'escape') {
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
        toggleAgentLogs
      ]
    )
  )

  const handleLogDockMouseUp = useCallback((e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    setFocusedPane('logs')
  }, [])

  const { symbol, color } = CONNECTION_BADGE[state.connection]
  const activeCount = state.sessions.filter((s) => !['done', 'failed', 'aborted'].includes(s.status)).length

  return (
    <box flexDirection='column' height={rows} gap={0}>
      {/* Header */}
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
            <text>{config.workspace.slice(-8)}</text>
          </>
        )}
        {config.project && (
          <>
            <text attributes={tuiAttrs({ dim: true })}>project:</text>
            <text>{config.project.slice(-8)}</text>
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

      {/* Body: two panes side by side */}
      <box flexDirection='row' flexGrow={1} gap={1}>
        <SessionListPane
          sessions={state.sessions}
          selectedIndex={clampedIndex}
          isFocused={focusedPane === 'list'}
          onSelectSession={(index) => {
            setSelectedIndex(index)
            setFocusedPane('list')
          }}
        />
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
                  backgroundColor: '#374151'
                }
              }
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
