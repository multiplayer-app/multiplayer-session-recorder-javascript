import type { AgentMessage } from '../types/index.js'

export const stripTerminalEscapes = (text: string): string =>
  text
    // OSC: ESC ] ... (BEL or ESC \)
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, '')
    // CSI: ESC [ ... command
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    // 2-char ESC sequences
    .replace(/\x1B[@-Z\\-_]/g, '')

export const normalizeStreamContent = (text: string): string =>
  stripTerminalEscapes(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\t/g, '  ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

export const sanitizePaths = (text: string, dirs: string[]): string => {
  let result = normalizeStreamContent(text)
  for (const dir of dirs) {
    if (!dir) continue
    const prefix = dir.endsWith('/') ? dir : dir + '/'
    result = result.replaceAll(prefix, '')
    result = result.replaceAll(dir, '.')
  }
  return result
}

export const sanitizeValue = (value: unknown, dirs: string[]): unknown => {
  if (typeof value === 'string') return sanitizePaths(value, dirs)
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, dirs))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeValue(v, dirs)]),
    )
  }
  return value
}

export const sanitizeMessage = (msg: AgentMessage, dirs: string[]): AgentMessage => {
  const active = dirs.filter(Boolean)
  if (active.length === 0) {
    return { ...msg, content: normalizeStreamContent(msg.content) }
  }
  return {
    ...msg,
    content: sanitizePaths(msg.content, active),
    toolCalls: msg.toolCalls?.map((tc) => ({
      ...tc,
      input: sanitizeValue(tc.input, active) as Record<string, unknown>,
      output: tc.output ? (sanitizeValue(tc.output, active) as Record<string, unknown>) : undefined,
    })),
  }
}
