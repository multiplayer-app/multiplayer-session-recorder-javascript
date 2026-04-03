import { useState, useCallback, useRef, useEffect, type ReactElement } from 'react'
import type { TextareaRenderable } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import type { AgentChatStatus } from '../types/index.js'

/** Chat statuses that indicate the agent is actively working. */
const ACTIVE_STATUSES = new Set<AgentChatStatus | string>([
  'processing',
  'streaming',
])

/** Chat statuses that allow the user to send a message. */
const SENDABLE_STATUSES = new Set<AgentChatStatus | string>([
  'finished',
  'aborted',
  'error',
  'waitingForUserAction',
])

export interface ChatComposerProps {
  /** Current chat session ID, or null when no session is selected. */
  chatId: string | null
  /** Current status of the selected chat session. */
  chatStatus: AgentChatStatus | string | null
  /** Whether the composer is focused (accepts keyboard input). */
  isFocused: boolean
  /** Available width for the composer. */
  width: number
  /** Called when the user sends a message. */
  onSend: (chatId: string, content: string) => void
  /** Called when the user requests to abort the current generation. */
  onAbort: (chatId: string) => void
  /** Called when the user requests to focus the composer. */
  onRequestFocus: () => void
  /** Called when the user presses Escape. */
  onEscape: () => void
}

export function ChatComposer({
  chatId,
  chatStatus,
  isFocused,
  width,
  onSend,
  onAbort,
  onRequestFocus,
  onEscape,
}: ChatComposerProps): ReactElement {
  const textareaRef = useRef<TextareaRenderable | null>(null)
  const [hasContent, setHasContent] = useState(false)
  const [sending, setSending] = useState(false)

  const isActive = ACTIVE_STATUSES.has(chatStatus ?? '')
  const canSend = chatId !== null && SENDABLE_STATUSES.has(chatStatus ?? '') && hasContent && !sending
  const canAbort = chatId !== null && isActive

  const handleSend = useCallback(() => {
    if (!chatId || !canSend) return
    const text = textareaRef.current?.plainText?.trim()
    if (!text) return

    setSending(true)
    onSend(chatId, text)

    // Clear the textarea
    textareaRef.current?.clear()
    setHasContent(false)
    setSending(false)
  }, [chatId, canSend, onSend])

  const handleAbort = useCallback(() => {
    if (!chatId || !canAbort) return
    onAbort(chatId)
  }, [chatId, canAbort, onAbort])

  // Track content changes
  const handleContentChange = useCallback(() => {
    const text = textareaRef.current?.plainText ?? ''
    setHasContent(text.trim().length > 0)
  }, [])

  // Ctrl+Enter to send, Escape to blur
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (!isFocused) return

        if (key.name === 'escape') {
          onEscape()
          key.stopPropagation()
          return
        }

        // Ctrl+Enter or Cmd+Enter to send
        if (key.name === 'return' && (key.ctrl || key.meta)) {
          if (canSend) {
            handleSend()
          } else if (canAbort) {
            handleAbort()
          }
          key.stopPropagation()
          return
        }
      },
      [isFocused, canSend, canAbort, handleSend, handleAbort, onEscape],
    ),
  )

  // Reset state when chat changes
  useEffect(() => {
    textareaRef.current?.clear()
    setHasContent(false)
    setSending(false)
  }, [chatId])

  const textareaWidth = Math.max(10, width - 14)
  const disabled = !chatId

  // Status indicator
  const statusIndicator = (() => {
    if (!chatId || !chatStatus) return null
    if (isActive) {
      return (
        <box flexDirection='row' gap={1} flexShrink={0}>
          <text fg='#f59e0b' attributes={tuiAttrs({ bold: true })}>
            ● generating...
          </text>
        </box>
      )
    }
    if (chatStatus === 'error') {
      return (
        <text fg='#ef4444' attributes={tuiAttrs({ dim: true })}>
          ✕ error
        </text>
      )
    }
    return null
  })()

  // Action button
  const actionButton = (() => {
    if (canAbort) {
      return (
        <text fg='#ef4444' attributes={tuiAttrs({ bold: true })}>
          {' ■ Stop '}
        </text>
      )
    }
    if (canSend) {
      return (
        <text fg='#10b981' attributes={tuiAttrs({ bold: true })}>
          {' ↵ Send '}
        </text>
      )
    }
    return (
      <text fg='#4b5563' attributes={tuiAttrs({ dim: true })}>
        {' ↵ Send '}
      </text>
    )
  })()

  const borderColor = isFocused ? '#6366f1' : '#374151'

  return (
    <box
      flexDirection='column'
      flexShrink={0}
      gap={0}
    >
      <box
        border={true}
        borderStyle='rounded'
        borderColor={borderColor}
        flexDirection='column'
        gap={0}
        onMouseUp={(e) => {
          e.stopPropagation()
          onRequestFocus()
        }}
      >
        {/* Textarea row */}
        <box flexDirection='row' gap={1} padding={1}>
          <text fg={isFocused ? '#6366f1' : '#6b7280'}>
            {isFocused ? '❯' : ' '}
          </text>
          <textarea
            ref={textareaRef}
            width={textareaWidth}
            height={3}
            focused={isFocused && !disabled}
            placeholder={disabled ? 'Select a session...' : isActive ? 'Agent is working...' : 'Type a message... (Ctrl+Enter to send)'}
            placeholderColor='#6b7280'
            wrapMode='word'
            backgroundColor='transparent'
            focusedBackgroundColor='transparent'
            textColor={disabled ? '#6b7280' : '#e5e7eb'}
            focusedTextColor='#f3f4f6'
            onContentChange={handleContentChange}
            onSubmit={handleSend}
          />
        </box>

        {/* Bottom bar: status + action button */}
        <box
          flexDirection='row'
          justifyContent='space-between'
          paddingLeft={1}
          paddingRight={1}
          paddingBottom={1}
        >
          <box flexDirection='row' gap={2}>
            {statusIndicator}
            <text fg='#4b5563' attributes={tuiAttrs({ dim: true })}>
              {isFocused ? 'Ctrl+↵ send · Esc back' : 'i to compose'}
            </text>
          </box>
          {actionButton}
        </box>
      </box>
    </box>
  ) as ReactElement
}
