import { createTextAttributes } from '@opentui/core'

/** Core typings expose `attributes` as `number` only; React JSX uses style objects — convert at the boundary. */
export function tuiAttrs(
  opts: NonNullable<Parameters<typeof createTextAttributes>[0]>,
): number {
  return createTextAttributes(opts)
}
