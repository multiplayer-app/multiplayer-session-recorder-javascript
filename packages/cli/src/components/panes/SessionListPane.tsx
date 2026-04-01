import React, { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { KeyEvent, MouseEvent } from '@opentui/core'
import { MouseButton, ScrollBoxRenderable } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { collapseForSingleLine } from '../../lib/formatDisplay.js'
import type { SessionSummary, SessionStatus } from '../../runtime/types.js'

const SIDEBAR_WIDTH = 32

const STATUS_SYMBOL: Record<SessionStatus, { symbol: string; color: string }> = {
  pending:   { symbol: '○', color: '#6b7280' },
  analyzing: { symbol: '◐', color: '#f59e0b' },
  pushing:   { symbol: '◑', color: '#6366f1' },
  done:      { symbol: '●', color: '#10b981' },
  failed:    { symbol: '✕', color: '#ef4444' },
  aborted:   { symbol: '◌', color: '#6b7280' },
}

interface Props {
  sessions: SessionSummary[]
  selectedIndex: number
  isFocused: boolean
  /** Primary click on a row selects that session (terminal mouse reporting). */
  onSelectSession?: (index: number) => void
  /** Fixed sidebar (default) vs full-width row for stacked / narrow layouts. */
  layout?: 'sidebar' | 'fluid'
  /** Inner text width for session titles when `layout="fluid"` (parent supplies terminal-derived value). */
  fluidTextWidth?: number
}

const SCROLLBAR_STYLE = {
  wrapperOptions: { flexGrow: 1 },
  viewportOptions: { flexGrow: 1 },
  scrollbarOptions: {
    showArrows: true,
    trackOptions: {
      foregroundColor: '#22d3ee',
      backgroundColor: '#374151',
    },
  },
} as const

function SessionListPaneImpl({
  sessions,
  selectedIndex,
  isFocused,
  onSelectSession,
  layout = 'sidebar',
  fluidTextWidth
}: Props): ReactElement {
  const borderColor = isFocused ? '#22d3ee' : '#374151'
  const sidebarInner = SIDEBAR_WIDTH - 4 // border(2) + padding(2)
  const contentWidth = layout === 'fluid' ? Math.max(16, fluidTextWidth ?? sidebarInner) : sidebarInner
  const rowTextWidth = Math.max(12, contentWidth - 5) // arrow + status + gaps
  const listScrollRef = useRef<ScrollBoxRenderable | null>(null)

  const title = sessions.length > 0
    ? `Sessions (${sessions.length})`
    : 'Sessions'

  useLayoutEffect(() => {
    const s = sessions[selectedIndex]
    if (!s) return
    listScrollRef.current?.scrollChildIntoView(`session-list-${s.chatId}`)
  }, [selectedIndex, sessions])

  /** PgUp / PgDn / Home / End scroll the list; ↑↓ stay with Dashboard for selection (scrollbox stays unfocused). */
  useKeyboard((key: KeyEvent) => {
    if (!isFocused || sessions.length === 0) return
    const sb = listScrollRef.current
    if (!sb) return
    const { name } = key
    if (name === 'pageup') {
      sb.scrollBy(-0.5, 'viewport')
      key.stopPropagation()
    } else if (name === 'pagedown') {
      sb.scrollBy(0.5, 'viewport')
      key.stopPropagation()
    } else if (name === 'home') {
      sb.scrollBy(-1, 'content')
      key.stopPropagation()
    } else if (name === 'end') {
      sb.scrollBy(1, 'content')
      key.stopPropagation()
    }
  })

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor={borderColor}
      padding={1}
      {...(layout === 'fluid'
        ? { flexGrow: 1, flexShrink: 1, minWidth: 24, overflow: 'hidden' as const }
        : { width: SIDEBAR_WIDTH, flexShrink: 0, overflow: 'hidden' as const })}
    >
      <box marginBottom={1} flexShrink={0}>
        <text attributes={tuiAttrs({ bold: true, dim: true })}>{title}</text>
      </box>

      {sessions.length === 0 ? (
        <text attributes={tuiAttrs({ dim: true })}>Waiting for issues...</text>
      ) : (
        <scrollbox
          ref={listScrollRef}
          flexGrow={1}
          scrollY
          focused={false}
          style={SCROLLBAR_STYLE}
        >
          <box flexDirection="column" flexShrink={0} width="100%" gap={0}>
            {sessions.map((s, i) => {
              const isSelected = i === selectedIndex
              const { symbol, color } = STATUS_SYMBOL[s.status]
              const titleOneLine = collapseForSingleLine(s.issueTitle).slice(0, rowTextWidth)
              const serviceOneLine = collapseForSingleLine(s.issueService).slice(0, rowTextWidth)
              return (
                <box
                  key={s.chatId}
                  id={`session-list-${s.chatId}`}
                  flexDirection="column"
                  marginBottom={i < sessions.length - 1 ? 1 : 0}
                  onMouseUp={
                    onSelectSession
                      ? (e: MouseEvent) => {
                          if (e.button !== MouseButton.LEFT) return
                          e.stopPropagation()
                          onSelectSession(i)
                        }
                      : undefined
                  }
                >
                  <box flexDirection="row" gap={1}>
                    <text fg={isSelected ? '#22d3ee' : undefined}>
                      {isSelected ? '▶' : ' '}
                    </text>
                    <text fg={color}>{symbol}</text>
                    <box flexDirection="column" width={rowTextWidth}>
                      <text fg={isSelected ? '#f8fafc' : undefined} attributes={tuiAttrs({ bold: isSelected })}>
                        {titleOneLine}
                      </text>
                      <text>{serviceOneLine}</text>
                    </box>
                  </box>
                </box>
              )
            })}
          </box>
        </scrollbox>
      )}
    </box>
  ) as ReactElement
}

/** Fixed call signature for OpenTUI JSX + React 19 (avoids TS2786). */
export const SessionListPane = SessionListPaneImpl as (props: Props) => ReactElement
