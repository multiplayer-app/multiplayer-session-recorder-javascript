/**
 * Collapse newlines and repeated whitespace for single-line TUI labels.
 * Issue titles from APIs sometimes include literal `\n`, which breaks narrow panes.
 */
export function collapseForSingleLine(text: string): string {
  if (!text) return ''
  return text
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Compact byte size for attachment labels in the transcript. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10_240 ? 1 : 0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Strip model/tool boilerplate from displayed tool output (e.g. Claude system reminders). */
export function stripAgentDisplayNoise(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
