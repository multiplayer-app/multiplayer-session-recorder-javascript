/**
 * OpenTUI's jsx-namespace uses `JSX.Element = ReactNode`; React 19's ReactNode includes
 * Promise<ReactNode>, which breaks TS2786 for components. Narrow element type for checks.
 */
import type { ReactElement } from 'react'

export {}

declare global {
  namespace JSX {
    type Element = ReactElement
  }
}
