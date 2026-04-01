import type { RuntimeState, SessionSummary, ConnectionState } from './types.js'

export const initialRuntimeState = (maxConcurrent = 2): RuntimeState => ({
  connection: 'idle',
  sessions: [],
  resolvedCount: 0,
  rateLimitState: { active: 0, limit: maxConcurrent },
})

export const addSession = (state: RuntimeState, session: SessionSummary): RuntimeState => ({
  ...state,
  sessions: [...state.sessions, session],
})

export const upsertSession = (
  state: RuntimeState,
  update: Partial<SessionSummary> & { chatId: string },
): RuntimeState => {
  const idx = state.sessions.findIndex((s) => s.chatId === update.chatId)
  if (idx === -1) return state
  const sessions = [...state.sessions]
  sessions[idx] = { ...sessions[idx]!, ...update }
  return { ...state, sessions }
}

export const setConnection = (
  state: RuntimeState,
  connection: ConnectionState,
  error?: string,
): RuntimeState => ({
  ...state,
  connection,
  connectionError: error,
})

export const incrementResolved = (state: RuntimeState): RuntimeState => ({
  ...state,
  resolvedCount: state.resolvedCount + 1,
})

export const setRateLimitActive = (state: RuntimeState, active: number): RuntimeState => ({
  ...state,
  rateLimitState: { ...state.rateLimitState, active },
})
