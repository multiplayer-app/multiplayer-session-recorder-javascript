import type { ReactElement } from 'react'
import { tuiAttrs } from '../lib/tuiAttrs.js'
import { LogEntry } from '../types/index.js'

interface Props {
  logs: LogEntry[]
  /** When set, only the last N lines are shown; otherwise all entries (for scroll containers). */
  maxLines?: number
  /** When false, omit the banner (use inside a titled panel). */
  showTitle?: boolean
}

const levelColor: Record<string, string> = {
  info: '#f8fafc',
  error: '#ef4444',
  debug: '#6b7280',
}

/** Return narrowed to ReactElement — OpenTUI JSX is typed as ReactNode (TS2786 under React 19). */
export function LogOutput({ logs, maxLines, showTitle = true }: Props): ReactElement {
  const visible = maxLines != null ? logs.slice(-maxLines) : logs

  return (
    <box flexDirection="column" gap={0}>
      {showTitle && (
        <text attributes={tuiAttrs({ dim: true, bold: true })}>── Logs ──────────────────────────────────────</text>
      )}
      {visible.length === 0 && (
        <text attributes={tuiAttrs({ dim: true })}>{showTitle ? '  (no logs yet)' : '(no activity yet)'}</text>
      )}
      {visible.map((entry, i) => {
        const ts = entry.timestamp.toTimeString().slice(0, 8)
        const color = levelColor[entry.level] ?? '#f8fafc'
        return (
          <box key={`${entry.timestamp.getTime()}-${i}`} flexDirection="row" gap={1}>
            <text attributes={tuiAttrs({ dim: true })}>{ts}</text>
            <text fg={color}>[{entry.level.toUpperCase()}]</text>
            <text fg={color}>{entry.message}</text>
          </box>
        )
      })}
    </box>
  ) as ReactElement
}
