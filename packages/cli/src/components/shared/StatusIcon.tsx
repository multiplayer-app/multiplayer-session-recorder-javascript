import type { ReactElement } from 'react'
import { STATUS_ICON_COLORS } from './tuiTheme.js'

type StatusType = 'loading' | 'success' | 'error' | 'idle'

const STATUS_MAP: Record<StatusType, { symbol: string; color: string }> = {
  loading: { symbol: '◌', color: STATUS_ICON_COLORS.loading },
  success: { symbol: '✓', color: STATUS_ICON_COLORS.success },
  error: { symbol: '✕', color: STATUS_ICON_COLORS.error },
  idle: { symbol: '·', color: STATUS_ICON_COLORS.idle }
}

interface StatusIconProps {
  status: StatusType
}

/**
 * Renders a colored status symbol: ◌ loading, ✓ success, ✕ error, · idle.
 */
export function StatusIcon({ status }: StatusIconProps): ReactElement {
  const { symbol, color } = STATUS_MAP[status]
  return (<text fg={color}>{symbol}</text>) as ReactElement
}
