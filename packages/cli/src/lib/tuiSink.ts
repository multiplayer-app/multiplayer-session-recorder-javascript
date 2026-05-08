/**
 * Module-level log sink for routing runtime errors and info from non-React
 * code (lib helpers, click handlers, async callbacks) into the Logs dock.
 *
 * App.tsx registers the sink after the dashboard mounts. If nothing is
 * registered (e.g. during startup), messages are dropped — better than
 * corrupting the alt-screen TTY with stray stderr writes.
 */

export type TuiLogLevel = 'info' | 'error' | 'debug'
export type TuiSink = (level: TuiLogLevel, message: string) => void

let sink: TuiSink | null = null

export function setTuiSink(next: TuiSink | null): void {
  sink = next
}

export function logToTui(level: TuiLogLevel, message: string): void {
  sink?.(level, message)
}
