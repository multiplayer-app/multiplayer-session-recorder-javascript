import type { MouseEvent } from '@opentui/core'
import { MouseButton } from '@opentui/core'

/**
 * Creates a left-click handler that stops propagation.
 * Use on `onMouseUp` props for interactive TUI elements.
 */
export function clickHandler(handler: () => void) {
  return (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    handler()
  }
}
