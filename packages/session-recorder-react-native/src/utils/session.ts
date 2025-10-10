import { SessionType } from '@multiplayer-app/session-recorder-common';
import { DEBUG_SESSION_MAX_DURATION_SECONDS } from '../config/constants';

/**
 * Session-related utility functions for React Native
 */

export const isSessionActive = (
  session: any,
  sessionType: SessionType | null
): boolean => {
  if (!session) return false;
  if (sessionType === SessionType.CONTINUOUS) return true;
  const startedAt = new Date(session.startedAt || session.createdAt);
  const now = new Date();
  const diff = now.getTime() - startedAt.getTime();
  return diff < DEBUG_SESSION_MAX_DURATION_SECONDS * 1000;
};

export const isConsoleEvent = (event: any): boolean => {
  return event.type === 'Plugin' && event.data?.plugin === 'rrweb/console@1';
};
