import { useMemo, type ReactElement, type ReactNode } from 'react'
import type { MouseEvent } from '@opentui/core'
import { MouseButton } from '@opentui/core'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { collapseForSingleLine, formatBytes, stripAgentDisplayNoise } from '../../lib/formatDisplay.js'
import type { SessionDetail, SessionMessage, SessionStatus } from '../../runtime/types.js'
import type { AgentToolCall } from '../../types/index.js'
import { EmptyDetailPane } from '../EmptyDetailPane.js'

const STATUS_LABEL: Record<SessionStatus, { label: string; color: string }> = {
  pending: { label: 'pending', color: '#6b7280' },
  analyzing: { label: 'analyzing', color: '#f59e0b' },
  pushing: { label: 'pushing', color: '#6366f1' },
  done: { label: 'done', color: '#10b981' },
  failed: { label: 'failed', color: '#ef4444' },
  aborted: { label: 'aborted', color: '#6b7280' }
}

const TOOL_STATUS_COLOR: Record<AgentToolCall['status'], string> = {
  pending: '#f59e0b',
  running: '#f59e0b',
  succeeded: '#10b981',
  failed: '#ef4444'
}

const getToolStatusColor = (status: AgentToolCall['status'] | undefined): string =>
  TOOL_STATUS_COLOR[status ?? 'pending'] ?? '#f59e0b'

function getToolDetail(tc: AgentToolCall): string | null {
  const input = tc.input
  switch (tc.name) {
    case 'Read':
    case 'Edit':
    case 'Write': {
      if (typeof input.file_path === 'string') {
        const parts = (input.file_path as string).split('/')
        return parts.slice(-2).join('/')
      }
      return null
    }
    case 'Glob':
      return typeof input.pattern === 'string' ? (input.pattern as string) : null
    case 'Grep': {
      if (typeof input.pattern === 'string') {
        const p = input.pattern as string
        return p.length > 35 ? p.slice(0, 33) + '…' : p
      }
      return null
    }
    case 'Bash': {
      if (typeof input.command === 'string') {
        const cmd = (input.command as string).replace(/\n/g, ' ').trim()
        return cmd.length > 50 ? cmd.slice(0, 48) + '…' : cmd
      }
      return null
    }
    case 'Agent':
      if (typeof input.description === 'string') {
        const d = input.description as string
        return d.length > 40 ? d.slice(0, 38) + '…' : d
      }
      if (typeof input.subagent_type === 'string') return input.subagent_type as string
      return null
    case 'ToolSearch': {
      const q = input.query
      if (typeof q !== 'string') return null
      return q.length > 42 ? q.slice(0, 40) + '…' : q
    }
    default:
      return null
  }
}

const TOOL_OUTPUT_MAX_LINES = 5
const TOOL_OUTPUT_MAX_CHARS = 2800
const TOOL_DETAIL_CONT_COLOR = '#64748b'

/** Transcript styling for `role: user` (accent bar + green-tinted text). */
const USER_MSG = {
  background: '#27272a',
  bar: '#15803d',
  accent: '#4ade80',
  body: '#d1fae5',
  bodyMuted: '#86efac',
  codeBorder: '#22c55e',
  codeFg: '#fef9c3',
  attachment: '#86efac'
} as const

function toolOutputPreviewText(tc: AgentToolCall): string | null {
  const out = tc.output
  if (!out || typeof out !== 'object') return null
  const raw = out.content
  if (typeof raw !== 'string' || !raw.trim()) return null
  let t = stripAgentDisplayNoise(raw)
  if (!t) return null
  if (t.length > TOOL_OUTPUT_MAX_CHARS) t = t.slice(0, TOOL_OUTPUT_MAX_CHARS) + '\n…'
  return t
}

const ACTIVITY_ACCENT: Record<string, string> = {
  git: '#6366f1',
  analyzing: '#f59e0b'
}

function activityAccent(activity: string): string {
  return ACTIVITY_ACCENT[activity] ?? '#94a3b8'
}

/** Role / activity label before message body (similar to Kilocode’s part boundaries). */
function getContentPrefix(msg: SessionMessage): { text: string; color: string } | null {
  switch (msg.role) {
    case 'user':
      return { text: 'user', color: '#4ade80' }
    case 'assistant':
      return msg.activity ? { text: `[${msg.activity}]`, color: activityAccent(msg.activity) } : null
    case 'agent':
      return { text: 'issue', color: '#eab308' }
    case 'error':
      return { text: 'error', color: '#ef4444' }
    case 'reasoning':
      return { text: 'reasoning', color: '#a78bfa' }
    case 'system':
      return { text: 'system', color: '#6b7280' }
    case 'tool':
      return { text: 'tool', color: '#94a3b8' }
    default:
      return null
  }
}

// ─── Inline markdown segments ────────────────────────────────────────────────

type Segment = { text: string; bold?: boolean; code?: boolean; dim?: boolean }

function parseInline(text: string): Segment[] {
  const segments: Segment[] = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index) })
    if (m[0].startsWith('**')) segments.push({ text: m[2]!, bold: true })
    else if (m[0].startsWith('`')) segments.push({ text: m[3]!, code: true })
    else segments.push({ text: m[4]!, dim: true })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments
}

// Inline content as span/strong modifiers — must be children of a <text> element
function InlineSegments({ segments, dim }: { segments: Segment[]; dim?: boolean }): ReactElement {
  return (
    <>
      {segments.map((s, i) =>
        s.bold ? (
          <strong key={i}>{s.text}</strong>
        ) : s.code ? (
          <span key={i} fg='#f59e0b'>
            {s.text}
          </span>
        ) : s.dim || dim ? (
          <span key={i} attributes={tuiAttrs({ dim: true })}>
            {s.text}
          </span>
        ) : (
          s.text
        )
      )}
    </>
  ) as ReactElement
}

// Emoji break terminal width math — strip them
const stripEmoji = (text: string): string =>
  text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FEFF}]/gu, '')

const stripTerminalEscapes = (text: string): string =>
  text
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, '')
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1B[@-Z\\-_]/g, '')

const stripControlChars = (text: string): string =>
  stripTerminalEscapes(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\t/g, '  ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

// ─── Block-aware markdown parser ─────────────────────────────────────────────

type Block = { type: 'line'; line: string } | { type: 'code'; lang: string; lines: string[] } | { type: 'spacer' }

const getContentWidth = (): number => Math.max(20, (process.stdout.columns || 120) - 37)

const isStructuralLine = (line: string): boolean =>
  /^#{1,3} /.test(line) ||
  /^(-{3,}|\*{3,})$/.test(line.trim()) ||
  /^(\s*)[-*+] /.test(line) ||
  /^(\s*)\d+\. /.test(line) ||
  line.startsWith('> ')

function wrapParagraph(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text]

  const hardSplit = (t: string): string[] => {
    if (t.length <= maxWidth) return [t]
    const out: string[] = []
    for (let i = 0; i < t.length; i += maxWidth) out.push(t.slice(i, i + maxWidth))
    return out.length ? out : [t]
  }

  const splitPoints: number[] = []
  let inCode = false
  let boldCount = 0

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '`') {
      inCode = !inCode
    } else if (ch === '*' && text[i + 1] === '*') {
      boldCount++
      i++
    } else if (ch === ' ' && !inCode && boldCount % 2 === 0) {
      splitPoints.push(i)
    }
  }

  if (splitPoints.length === 0) return hardSplit(text)

  const lines: string[] = []
  let start = 0

  while (start < text.length) {
    const remaining = text.slice(start)
    if (remaining.length <= maxWidth) {
      lines.push(remaining)
      break
    }
    const limit = start + maxWidth
    let splitAt = -1
    for (const sp of splitPoints) {
      if (sp <= start) continue
      if (sp <= limit) splitAt = sp
      else break
    }
    if (splitAt === -1) {
      const next = splitPoints.find((sp) => sp > limit)
      if (next !== undefined) {
        lines.push(text.slice(start, next))
        start = next + 1
      } else {
        lines.push(...hardSplit(text.slice(start)))
        break
      }
    } else {
      lines.push(text.slice(start, splitAt))
      start = splitAt + 1
    }
  }

  return lines.length > 0 ? lines : [text]
}

function parseBlocks(content: string, contentWidth?: number): Block[] {
  const blocks: Block[] = []
  let inCode = false
  let codeLang = ''
  let codeLines: string[] = []
  let lastWasBlank = false
  const width = contentWidth ?? getContentWidth()
  const codeWidth = Math.max(20, width - 3)

  const hardSplitPlain = (t: string, w: number): string[] => {
    if (t.length <= w) return [t]
    const out: string[] = []
    for (let i = 0; i < t.length; i += w) out.push(t.slice(i, i + w))
    return out.length ? out : [t]
  }

  const wrapStructural = (line: string): string[] => {
    if (line.length <= width) return [line]
    const bullet = line.match(/^(\s*[-*+] )(.*)$/)
    if (bullet) {
      const prefix = bullet[1]!
      const chunks = wrapParagraph(bullet[2]!, Math.max(10, width - prefix.length))
      return chunks.map((c, idx) => (idx === 0 ? prefix + c : ' '.repeat(prefix.length) + c))
    }
    const num = line.match(/^(\s*\d+\. )(.*)$/)
    if (num) {
      const prefix = num[1]!
      const chunks = wrapParagraph(num[2]!, Math.max(10, width - prefix.length))
      return chunks.map((c, idx) => (idx === 0 ? prefix + c : ' '.repeat(prefix.length) + c))
    }
    if (line.startsWith('> ')) {
      const chunks = wrapParagraph(line.slice(2), Math.max(10, width - 2))
      return chunks.map((c, idx) => (idx === 0 ? '> ' + c : '  ' + c))
    }
    return hardSplitPlain(line, width)
  }

  const normalized = stripControlChars(content)
  for (const raw of normalized.split('\n')) {
    const line = stripEmoji(raw)
    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true
        codeLang = line.slice(3).trim()
        codeLines = []
      } else {
        const wrapped: string[] = []
        for (const cl of codeLines) wrapped.push(...hardSplitPlain(cl, codeWidth))
        blocks.push({ type: 'code', lang: codeLang, lines: wrapped })
        inCode = false
      }
      lastWasBlank = false
    } else if (inCode) {
      codeLines.push(line)
    } else if (line.trim().length === 0) {
      if (!lastWasBlank && blocks.length > 0) blocks.push({ type: 'spacer' })
      lastWasBlank = true
    } else {
      lastWasBlank = false
      if (isStructuralLine(line)) {
        for (const chunk of wrapStructural(line)) blocks.push({ type: 'line', line: chunk })
      } else {
        for (const chunk of wrapParagraph(line, width)) blocks.push({ type: 'line', line: chunk })
      }
    }
  }
  if (inCode && codeLines.length > 0) {
    const wrapped: string[] = []
    for (const cl of codeLines) wrapped.push(...hardSplitPlain(cl, codeWidth))
    blocks.push({ type: 'code', lang: codeLang, lines: wrapped })
  }
  return blocks
}

// ─── Markdown line renderer ───────────────────────────────────────────────────

type MarkdownVariant = 'default' | 'user'

function MarkdownLine({
  line,
  muted = false,
  variant = 'default'
}: {
  line: string
  muted?: boolean
  variant?: MarkdownVariant
}): ReactElement {
  const u = variant === 'user'
  const ax = u ? USER_MSG.accent : '#22d3ee'
  const dimBody = u ? false : muted
  const dimSoft = u ? true : muted

  if (/^# /.test(line)) {
    return (
      <text fg={ax} attributes={tuiAttrs({ bold: true, dim: dimSoft })}>
        {line.slice(2)}
      </text>
    ) as ReactElement
  }
  if (/^## /.test(line)) {
    return (
      <text fg={ax} attributes={tuiAttrs({ bold: true, dim: dimSoft })}>
        ▌ {line.slice(3)}
      </text>
    ) as ReactElement
  }
  if (/^### /.test(line)) {
    return (
      <text fg={ax} attributes={tuiAttrs({ bold: true, dim: true })}>
        {line.slice(4)}
      </text>
    ) as ReactElement
  }
  if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
    return (
      <text fg={u ? USER_MSG.bodyMuted : undefined} attributes={tuiAttrs({ dim: true })}>
        {'─'.repeat(50)}
      </text>
    ) as ReactElement
  }

  const bulletMatch = line.match(/^(\s*)[-*+] (.*)$/)
  if (bulletMatch) {
    const indent = bulletMatch[1]!.length
    return (
      <box flexDirection='row'>
        <text fg={ax} attributes={tuiAttrs({ dim: dimSoft })}>
          {' '.repeat(indent)}
          {'›'}{' '}
        </text>
        <box flexGrow={1}>
          <text fg={u ? USER_MSG.body : undefined} attributes={tuiAttrs({ dim: dimBody })}>
            <InlineSegments segments={parseInline(bulletMatch[2]!)} dim={dimBody} />
          </text>
        </box>
      </box>
    ) as ReactElement
  }

  const numMatch = line.match(/^(\s*)(\d+)\. (.*)$/)
  if (numMatch) {
    const indent = numMatch[1]!.length
    return (
      <box flexDirection='row'>
        <text fg={ax} attributes={tuiAttrs({ dim: dimSoft })}>
          {' '.repeat(indent)}
          {numMatch[2]}
          {'. '}
        </text>
        <box flexGrow={1}>
          <text fg={u ? USER_MSG.body : undefined} attributes={tuiAttrs({ dim: dimBody })}>
            <InlineSegments segments={parseInline(numMatch[3]!)} dim={dimBody} />
          </text>
        </box>
      </box>
    ) as ReactElement
  }

  if (line.startsWith('> ')) {
    return (
      <box flexDirection='row'>
        <text fg={ax} attributes={tuiAttrs({ dim: true })}>
          {'▎ '}
        </text>
        <box flexGrow={1}>
          <text fg={u ? USER_MSG.bodyMuted : undefined} attributes={tuiAttrs({ dim: true })}>
            <InlineSegments segments={parseInline(line.slice(2))} />
          </text>
        </box>
      </box>
    ) as ReactElement
  }

  return (
    <text fg={u ? USER_MSG.body : undefined} attributes={tuiAttrs({ dim: dimBody })}>
      <InlineSegments segments={parseInline(line)} dim={dimBody} />
    </text>
  ) as ReactElement
}

function UserAccentRow({ rowKey, children }: { rowKey: string; children: ReactNode }): ReactElement {
  return (
    <box key={rowKey} flexDirection='row' flexShrink={0} width='100%' backgroundColor={USER_MSG.background}>
      <text fg={USER_MSG.bar} attributes={tuiAttrs({ dim: true })}>
        ┃{' '}
      </text>
      <box flexGrow={1} backgroundColor={USER_MSG.background}>
        {children}
      </box>
    </box>
  ) as ReactElement
}

// ─── Row model ───────────────────────────────────────────────────────────────

type DetailRow =
  | { key: string; type: 'toolLine'; roleColor: string; text: string }
  | { key: string; type: 'prefix'; roleColor: string; prefix: string; userHighlight?: boolean }
  | { key: string; type: 'attachmentLine'; text: string; fromUser?: boolean }
  | { key: string; type: 'toolOutputLine'; text: string }
  | { key: string; type: 'line'; line: string; fromUser?: boolean }
  | { key: string; type: 'codeStart'; lang: string; fromUser?: boolean }
  | { key: string; type: 'codeLine'; line: string; fromUser?: boolean }
  | { key: string; type: 'codeEnd'; fromUser?: boolean }
  | { key: string; type: 'spacer'; fromUser?: boolean }
  | { key: string; type: 'messageGap' }

const buildMessageRows = (msg: SessionMessage, contentWidth?: number): DetailRow[] => {
  const toolCalls = msg.toolCalls ?? []
  const attachments = msg.attachments ?? []
  const hasContent = Boolean(msg.content?.trim())
  const hasAttachments = attachments.length > 0
  const rows: DetailRow[] = []
  const width = contentWidth ?? getContentWidth()

  if (!hasContent && !hasAttachments && toolCalls.length === 0) {
    return rows
  }

  let prefixInfo = getContentPrefix(msg)
  if (!prefixInfo && msg.role === 'assistant' && hasAttachments && !hasContent && toolCalls.length === 0) {
    prefixInfo = { text: 'assistant', color: '#22d3ee' }
  }
  const fromUser = msg.role === 'user'

  if (prefixInfo) {
    rows.push({
      key: `prefix-${msg.id}`,
      type: 'prefix',
      roleColor: prefixInfo.color,
      prefix: prefixInfo.text,
      userHighlight: fromUser
    })
  }

  for (const att of attachments) {
    const sizePart = att.size != null && att.size >= 0 ? ` (${formatBytes(att.size)})` : ''
    rows.push({
      key: `att-${msg.id}-${att.type}-${att.name}`,
      type: 'attachmentLine',
      text: `[${att.type}] ${att.name}${sizePart}`,
      fromUser
    })
  }

  if (hasContent) {
    const body = msg.role === 'user' ? msg.content : stripAgentDisplayNoise(msg.content) || msg.content
    for (const [i, b] of parseBlocks(body, contentWidth).entries()) {
      if (b.type === 'spacer') {
        rows.push({ key: `spacer-${msg.id}-${i}`, type: 'spacer', fromUser })
      } else if (b.type === 'line') {
        rows.push({ key: `line-${msg.id}-${i}`, type: 'line', line: b.line, fromUser })
      } else {
        rows.push({
          key: `code-start-${msg.id}-${i}`,
          type: 'codeStart',
          lang: b.lang || 'text',
          fromUser
        })
        for (const [j, line] of b.lines.entries()) {
          rows.push({ key: `code-line-${msg.id}-${i}-${j}`, type: 'codeLine', line, fromUser })
        }
        rows.push({ key: `code-end-${msg.id}-${i}`, type: 'codeEnd', fromUser })
      }
    }
  }

  for (const tc of toolCalls) {
    // One role/activity prefix row per message; tool lines stay compact (cf. Kilocode tool blocks).
    const base = `[${tc.name}]`
    const detail = getToolDetail(tc)
    if (!detail) {
      rows.push({
        key: `tool-${msg.id}-${tc.id}-0`,
        type: 'toolLine',
        roleColor: getToolStatusColor(tc.status),
        text: base
      })
    } else {
      const available = Math.max(10, width - base.length - 1)
      const chunks = wrapParagraph(detail, available)
      rows.push({
        key: `tool-${msg.id}-${tc.id}-0`,
        type: 'toolLine',
        roleColor: getToolStatusColor(tc.status),
        text: `${base} ${chunks[0] ?? ''}`.trimEnd()
      })
      const indent = ' '.repeat(base.length + 1)
      for (let i = 1; i < chunks.length; i++) {
        rows.push({
          key: `tool-${msg.id}-${tc.id}-wrap-${i}`,
          type: 'toolLine',
          roleColor: TOOL_DETAIL_CONT_COLOR,
          text: `${indent}${chunks[i]}`
        })
      }
    }

    const preview = tc.status === 'succeeded' ? toolOutputPreviewText(tc) : null
    if (preview) {
      const lines = preview.split('\n').slice(0, TOOL_OUTPUT_MAX_LINES)
      let oi = 0
      for (const pl of lines) {
        const prefixed = `  ${pl}`
        for (const chunk of wrapParagraph(prefixed, Math.max(16, width))) {
          rows.push({
            key: `tool-out-${msg.id}-${tc.id}-${oi++}`,
            type: 'toolOutputLine',
            text: chunk
          })
        }
      }
    }
  }

  if (rows.length > 0) rows.push({ key: `gap-${msg.id}`, type: 'messageGap' })
  return rows
}

const buildSessionRows = (session: SessionDetail | null, contentWidth?: number): DetailRow[] => {
  if (!session) return []
  return session.messages.flatMap((msg) => buildMessageRows(msg, contentWidth))
}

function renderDetailRow(row: DetailRow): ReactElement | null {
  switch (row.type) {
    case 'toolLine':
      return (
        <text key={row.key} fg={row.roleColor}>
          {row.text}
        </text>
      ) as ReactElement
    case 'toolOutputLine':
      return (
        <text key={row.key} fg='#78716c' attributes={tuiAttrs({ dim: true })}>
          {row.text}
        </text>
      ) as ReactElement
    case 'attachmentLine':
      if (row.fromUser) {
        return (
          <UserAccentRow rowKey={row.key}>
            <text fg={USER_MSG.attachment} attributes={tuiAttrs({ dim: true })}>
              {row.text}
            </text>
          </UserAccentRow>
        ) as ReactElement
      }
      return (
        <text key={row.key} fg='#a78bfa' attributes={tuiAttrs({ dim: true })}>
          {row.text}
        </text>
      ) as ReactElement
    case 'prefix':
      if (row.userHighlight) {
        return (
          <box key={row.key} flexDirection='row' flexShrink={0} width='100%' backgroundColor={USER_MSG.background}>
            <text fg={USER_MSG.bar} attributes={tuiAttrs({ dim: true })}>
              ┃{' '}
            </text>
            <box flexGrow={1} backgroundColor={USER_MSG.background}>
              <text fg={row.roleColor} attributes={tuiAttrs({ bold: true })}>
                ◆ {row.prefix}{' '}
              </text>
            </box>
          </box>
        ) as ReactElement
      }
      return (
        <text key={row.key} fg={row.roleColor} attributes={tuiAttrs({ dim: true })}>
          {row.prefix}{' '}
        </text>
      ) as ReactElement
    case 'line':
      if (row.fromUser) {
        return (
          <UserAccentRow rowKey={row.key}>
            <MarkdownLine line={row.line} muted={false} variant='user' />
          </UserAccentRow>
        ) as ReactElement
      }
      return (<MarkdownLine key={row.key} line={row.line} muted={false} />) as ReactElement
    case 'spacer':
      if (row.fromUser) {
        return (
          <UserAccentRow rowKey={row.key}>
            <text> </text>
          </UserAccentRow>
        ) as ReactElement
      }
      return (<text key={row.key}> </text>) as ReactElement
    case 'messageGap':
      return (<text key={row.key}> </text>) as ReactElement
    case 'codeStart':
      return (
        row.fromUser ? (
          <UserAccentRow rowKey={row.key}>
            <text fg={USER_MSG.codeBorder}>
              {'┌─ '}
              <span attributes={tuiAttrs({ dim: true })}>{row.lang}</span>
            </text>
          </UserAccentRow>
        ) : (
          <text key={row.key} fg='#6b7280'>
            {'┌─ '}
            <span attributes={tuiAttrs({ dim: true })}>{row.lang}</span>
          </text>
        )
      ) as ReactElement
    case 'codeLine':
      return (
        row.fromUser ? (
          <UserAccentRow rowKey={row.key}>
            <text fg={USER_MSG.codeFg}>
              {'│ '}
              {row.line || ' '}
            </text>
          </UserAccentRow>
        ) : (
          <text key={row.key} fg='#f59e0b'>
            {'│ '}
            {row.line || ' '}
          </text>
        )
      ) as ReactElement
    case 'codeEnd':
      return (
        row.fromUser ? (
          <UserAccentRow rowKey={row.key}>
            <text fg={USER_MSG.codeBorder}>└</text>
          </UserAccentRow>
        ) : (
          <text key={row.key} fg='#6b7280'>
            └
          </text>
        )
      ) as ReactElement
    default:
      return null
  }
}

interface Props {
  session: SessionDetail | null
  contentWidth?: number
  isFocused: boolean
  /** Whether sessions exist at all (for empty-state messaging). */
  hasSessions?: boolean
  /** Primary click anywhere in the pane moves dashboard focus here (terminal mouse). */
  onRequestFocus?: () => void
  onRequestLoadMore?: () => void
}

function SessionDetailPaneImpl({
  session,
  contentWidth,
  isFocused,
  hasSessions = true,
  onRequestFocus,
  onRequestLoadMore
}: Props): ReactElement {
  const borderColor = isFocused ? '#22d3ee' : '#374151'

  const handleMouseUpFocus =
    onRequestFocus &&
    ((e: MouseEvent) => {
      if (e.button !== MouseButton.LEFT) return
      e.stopPropagation()
      onRequestFocus()
    })

  const handleMouseUpLoadMore =
    onRequestLoadMore &&
    ((e: MouseEvent) => {
      if (e.button !== MouseButton.LEFT) return
      e.stopPropagation()
      onRequestLoadMore()
    })

  const allRows = useMemo(() => buildSessionRows(session, contentWidth), [session, contentWidth])

  if (!session) {
    return (
      <box
        flexDirection='column'
        border={true}
        borderStyle='rounded'
        borderColor='#374151'
        padding={1}
        flexGrow={1}
        onMouseUp={handleMouseUpFocus || undefined}
      >
        <EmptyDetailPane hasSessions={hasSessions} />
      </box>
    ) as ReactElement
  }

  const { label, color } = STATUS_LABEL[session.status]

  return (
    <box
      flexDirection='column'
      border={true}
      borderStyle='rounded'
      borderColor={borderColor}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
      flexGrow={1}
      overflow='hidden'
      onMouseUp={handleMouseUpFocus || undefined}
    >
      {/* Session header (fixed above scroll area) */}
      <box
        flexDirection='column'
        marginBottom={1}
        flexShrink={0}
        borderStyle='single'
        border={true}
        borderColor='#374151'
        paddingLeft={1}
        paddingRight={1}
        paddingTop={0}
        paddingBottom={0}
      >
        <box flexDirection='row'>
          <box flexGrow={1}>
            <text attributes={tuiAttrs({ bold: true })}>{collapseForSingleLine(session.issueTitle)}</text>
          </box>
          <text fg={color}> {label}</text>
        </box>
        <box flexDirection='row' gap={1}>
          {session.issueService ? (
            <text attributes={tuiAttrs({ dim: true })}>{collapseForSingleLine(session.issueService)}</text>
          ) : null}
          {session.branchName && (
            <>
              {session.issueService ? <text attributes={tuiAttrs({ dim: true })}>·</text> : null}
              <text fg='#6366f1'>{session.branchName}</text>
            </>
          )}
          {session.prUrl && (
            <>
              <text attributes={tuiAttrs({ dim: true })}>·</text>
              <text fg='#22d3ee'>{session.prUrl}</text>
            </>
          )}
        </box>
        {session.error && <text fg='#ef4444'>✗ {session.error}</text>}
      </box>

      <scrollbox
        flexGrow={1}
        scrollY
        focused={isFocused}
        stickyScroll
        stickyStart='bottom'
        onMouseUp={handleMouseUpFocus || undefined}
        style={{
          wrapperOptions: { flexGrow: 1 },
          viewportOptions: { flexGrow: 1 },
          scrollbarOptions: {
            showArrows: true,
            trackOptions: {
              foregroundColor: '#22d3ee',
              backgroundColor: '#374151'
            }
          }
        }}
      >
        {allRows.length > 0 && session.hasMore && (
          <box
            flexDirection='row'
            flexShrink={0}
            width='100%'
            marginBottom={1}
            paddingLeft={1}
            paddingRight={1}
            paddingTop={0}
            paddingBottom={0}
            border={true}
            borderStyle='rounded'
            borderColor='#374151'
            justifyContent='center'
            alignItems='center'
            onMouseUp={handleMouseUpLoadMore}
          >
            <text fg='#22d3ee' attributes={tuiAttrs({ bold: true })}>
              Load more messages
            </text>
          </box>
        )}
        <box flexDirection='column' flexShrink={0} width='100%' paddingRight={2}>
          {allRows.length === 0 ? (
            <text attributes={tuiAttrs({ dim: true })}>No messages yet...</text>
          ) : (
            allRows.map((row) => renderDetailRow(row))
          )}
        </box>
      </scrollbox>
    </box>
  ) as ReactElement
}

/** Fixed call signature for OpenTUI JSX + React 19 (avoids TS2786). */
export const SessionDetailPane = SessionDetailPaneImpl as (props: Props) => ReactElement
