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
export const FG_DIM = '#6b7280'
export const FG_MUTED = '#9ca3af'
export const FG_LABEL = '#d4d4d8'
export const FG_LABEL_STRONG = '#fafafa'
export const FG_HINT = '#a1a1aa'
export const FG_TITLE = '#e5e5e5'
export const FG_VALUE = '#e5e7eb'
export const FG_BODY_EMPHASIS = '#e6edf3'
export const FG_SELECTION_LABEL = '#c9d1d9'
export const FG_ERROR_SOFT = '#fca5a5'
export const FG_VERSION = '#4b5563'
export const FG_META = '#4b5563'
export const FG_FOOTER_HINT = '#484f58'
export const FG_SLATE_DETAIL = '#64748b'
export const FG_STONE_DIM = '#78716c'
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
