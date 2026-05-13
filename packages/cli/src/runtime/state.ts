import type { RuntimeState, SessionSummary, ConnectionState } from './types.js'

/** Keep session list newest-first everywhere `RuntimeState.sessions` is consumed. */
function sortSessionsNewestFirst(sessions: SessionSummary[]): SessionSummary[] {
  return [...sessions].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
}

export const initialRuntimeState = (maxConcurrent = 2): RuntimeState => ({
  connection: 'idle',
  sessions: [],
  resolvedCount: 0,
  rateLimitState: { active: 0, limit: maxConcurrent }
})

export const addSession = (state: RuntimeState, session: SessionSummary): RuntimeState => ({
  ...state,
  sessions: sortSessionsNewestFirst([...state.sessions, session])
})

export const upsertSession = (
  state: RuntimeState,
  update: Partial<SessionSummary> & { chatId: string }
): RuntimeState => {
  const idx = state.sessions.findIndex((s) => s.chatId === update.chatId)
  if (idx === -1) return state
  const sessions = [...state.sessions]
  sessions[idx] = { ...sessions[idx]!, ...update }
  return { ...state, sessions: sortSessionsNewestFirst(sessions) }
}

export const setConnection = (state: RuntimeState, connection: ConnectionState, error?: string): RuntimeState => ({
  ...state,
  connection,
  connectionError: error
})

export const incrementResolved = (state: RuntimeState): RuntimeState => ({
  ...state,
  resolvedCount: state.resolvedCount + 1
})

export const removeSessions = (state: RuntimeState, chatIds: string[]): RuntimeState => {
  const idSet = new Set(chatIds)
  return {
    ...state,
    sessions: sortSessionsNewestFirst(state.sessions.filter((s) => !idSet.has(s.chatId)))
  }
}

export const setRateLimitActive = (state: RuntimeState, active: number): RuntimeState => ({
  ...state,
  rateLimitState: { ...state.rateLimitState, active }
})
