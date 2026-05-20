/**
 * Central color and backdrop tokens for CLI OpenTUI surfaces.
 */
import { RGBA } from '@opentui/core'

// ── Brand ───────────────────────────────────────────────────────────────────
export const BRAND_LOGO_PRIMARY = '#473cfb'
export const BRAND_LOGO_ACCENT = '#00eaf6'

/** Dashboard wordmark / highlights (indigo). */
export const BRAND_MARK_PRIMARY = '#6366f1'

// ── Interactive ───────────────────────────────────────────────────────────────
export const ACCENT = '#22d3ee'

// ── Surfaces ──────────────────────────────────────────────────────────────────
export const BORDER_MUTED = '#374151'
export const BORDER_SUBTLE = '#30363d'
export const BG_SURFACE_DEEP = '#161b22'
export const BG_SURFACE_ROW_HOVER = '#21262d'
export const BG_MODAL = '#262626'
export const BG_PANEL = '#27272a'

export const MODAL_BACKDROP_RGBA = RGBA.fromInts(10, 10, 12, 150)

// ── Foreground ────────────────────────────────────────────────────────────────
export const FG_DIM = '#9ca3af'
export const FG_MUTED = '#a1a1aa'
export const FG_LABEL = '#d4d4d8'
export const FG_LABEL_STRONG = '#fafafa'
export const FG_HINT = '#a1a1aa'
export const FG_TITLE = '#e5e5e5'
export const FG_VALUE = '#e5e7eb'
export const FG_BODY = '#f8fafc'
export const FG_BODY_EMPHASIS = '#e6edf3'
export const FG_SELECTION_LABEL = '#c9d1d9'
export const FG_ERROR_SOFT = '#fca5a5'
export const FG_VERSION = '#71717a'
export const FG_META = '#71717a'
export const FG_TIMESTAMP = '#a1a1aa'
export const FG_FOOTER_HINT = '#71717a'
export const FG_SLATE_DETAIL = '#94a3b8'
export const FG_STONE_DIM = '#a8a29e'
export const LINK_SUBTLE = '#818cf8'

// ── Semantic chroma ───────────────────────────────────────────────────────────
export const SEM_AMBER = '#f59e0b'
export const SEM_INDIGO = '#6366f1'
export const SEM_GREEN = '#10b981'
export const SEM_RED = '#ef4444'
export const SEM_PURPLE = '#8b5cf6'
export const SEM_SLATE = '#94a3b8'
export const SEM_YELLOW = '#eab308'
export const SEM_GREEN_BRIGHT = '#4ade80'
export const SEM_GREEN_MUTED = '#86efac'
export const SEM_GREEN_LIGHT = '#d1fae5'
export const SEM_GREEN_DARK = '#15803d'
export const SEM_CODE_BORDER = '#22c55e'
export const SEM_CODE_FG = '#fef9c3'
export const SEM_VIOLET_SOFT = '#a78bfa'

/** Chat composer send button background. */
export const BG_SEND_ACTIVE = '#064e3b'

/** Scrollbar track colors (OpenTUI scrollbox style). */
export const SCROLLBAR_TRACK_STYLE = {
  foregroundColor: ACCENT,
  backgroundColor: BORDER_MUTED,
} as const

/** Session list / sidebar status indicator colors. */
export const SESSION_STATUS_COLORS = {
  pending: FG_DIM,
  analyzing: SEM_AMBER,
  pushing: SEM_INDIGO,
  done: SEM_GREEN,
  failed: SEM_RED,
  aborted: FG_DIM,
} as const

/** Dashboard header connection badge colors. */
export const CONNECTION_STATUS_COLORS = {
  idle: { symbol: '○', color: FG_DIM, label: 'idle' },
  connecting: { symbol: '◌', color: SEM_AMBER, label: 'connecting' },
  connected: { symbol: '●', color: SEM_GREEN, label: 'connected' },
  disconnected: { symbol: '○', color: FG_DIM, label: 'disconnected' },
  error: { symbol: '✕', color: SEM_RED, label: 'error' },
} as const

/** Generic status icon colors (startup wizards, inline indicators). */
export const STATUS_ICON_COLORS = {
  loading: SEM_AMBER,
  success: SEM_GREEN,
  error: SEM_RED,
  idle: FG_DIM,
} as const

/** Active issue card status labels (legacy list view). */
export const ISSUE_STATUS_COLORS = {
  pending: FG_DIM,
  analyzing: ACCENT,
  applying: SEM_AMBER,
  pushing: SEM_AMBER,
  done: SEM_GREEN,
  failed: SEM_RED,
} as const

/** Log output level colors. */
export const LOG_LEVEL_COLORS = {
  info: FG_BODY,
  error: SEM_RED,
  debug: FG_DIM,
} as const

/** User transcript bubble / attachments (session detail). */
export const USER_TRANSCRIPT_COLORS = {
  background: BG_PANEL,
  bar: SEM_GREEN_DARK,
  accent: SEM_GREEN_BRIGHT,
  body: SEM_GREEN_LIGHT,
  bodyMuted: SEM_GREEN_MUTED,
  codeBorder: SEM_CODE_BORDER,
  codeFg: SEM_CODE_FG,
  attachment: SEM_GREEN_MUTED,
} as const

/** Activity segment colors on assistant lines. */
export const ACTIVITY_LABEL_ACCENTS: Record<string, string> = {
  git: SEM_INDIGO,
  analyzing: SEM_AMBER,
}

export function activityLabelAccent(activity: string): string {
  return ACTIVITY_LABEL_ACCENTS[activity] ?? SEM_SLATE
}

/** SDK setup wizard stack status headers. */
export const SDK_STACK_STATUS_COLORS = {
  'needs-setup': SEM_AMBER,
  installed: SEM_GREEN,
  covered: SEM_PURPLE,
  'not-needed': FG_DIM,
} as const
