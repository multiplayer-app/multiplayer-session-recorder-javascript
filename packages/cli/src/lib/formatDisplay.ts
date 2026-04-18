/**
 * Collapse newlines and repeated whitespace for single-line TUI labels.
 * Issue titles from APIs sometimes include literal `\n`, which breaks narrow panes.
 */
export function collapseForSingleLine(text: string): string {
  if (!text) return ''
  return text.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Wrap text by words and clamp to a maximum number of lines.
 * If content overflows, the last line is suffixed with an ellipsis.
 */
export function clampTextLines(text: string, maxWidth: number, maxLines: number): string[] {
  if (maxLines <= 0 || maxWidth <= 0) return []
  const normalized = collapseForSingleLine(text)
  if (!normalized) return ['']

  const words = normalized.split(' ')
  const lines: string[] = []
  let current = ''

  const pushCurrent = () => {
    if (current.length > 0) {
      lines.push(current)
      current = ''
    }
  }

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxWidth) {
      current = candidate
      continue
    }

    if (current) pushCurrent()

    let remaining = word
    while (remaining.length > maxWidth) {
      lines.push(remaining.slice(0, maxWidth))
      remaining = remaining.slice(maxWidth)
      if (lines.length >= maxLines) {
        const truncated = lines.slice(0, maxLines)
        const last = truncated[maxLines - 1] ?? ''
        truncated[maxLines - 1] = last.length >= maxWidth ? `${last.slice(0, Math.max(0, maxWidth - 1))}…` : `${last}…`
        return truncated
      }
    }
    current = remaining

    if (lines.length >= maxLines) break
  }

  pushCurrent()

  if (lines.length <= maxLines) return lines

  const truncated = lines.slice(0, maxLines)
  const last = truncated[maxLines - 1] ?? ''
  truncated[maxLines - 1] = last.length >= maxWidth ? `${last.slice(0, Math.max(0, maxWidth - 1))}…` : `${last}…`
  return truncated
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
