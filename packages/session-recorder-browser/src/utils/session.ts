import { eventWithTime, EventType } from 'rrweb'
import { DEBUG_SESSION_MAX_DURATION_SECONDS } from '../config/constants'
import { SessionType } from '@multiplayer-app/session-recorder-common'

/**
 * Session-related utility functions
 */

export const isSessionActive = (session, sessionType: SessionType) => {
  if (!session) return false
  if (sessionType === SessionType.CONTINUOUS) return true
  const startedAt = new Date(session.startedAt)
  const now = new Date()
  const diff = now.getTime() - startedAt.getTime()
  return diff < DEBUG_SESSION_MAX_DURATION_SECONDS * 1000
}

export const isConsoleEvent = (event: eventWithTime) => {
  return event.type === EventType.Plugin && event.data?.plugin === 'rrweb/console@1'
}
