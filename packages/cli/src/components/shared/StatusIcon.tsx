import type { ReactElement } from 'react'

type StatusType = 'loading' | 'success' | 'error' | 'idle'

const STATUS_MAP: Record<StatusType, { symbol: string; color: string }> = {
  loading: { symbol: '◌', color: '#f59e0b' },
  success: { symbol: '✓', color: '#10b981' },
  error: { symbol: '✕', color: '#ef4444' },
  idle: { symbol: '·', color: '#6b7280' }
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
