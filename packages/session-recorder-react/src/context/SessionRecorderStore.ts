import { createStore, type Store } from './createStore';
import { SessionState, SessionType } from '@multiplayer-app/session-recorder-browser';


export type SessionRecorderState = {
  isInitialized: boolean;
  sessionType: SessionType | null;
  sessionState: SessionState | null;
  isOnline: boolean;
  error: string | null;
};

export const sessionRecorderStore: Store<SessionRecorderState> =
  createStore<SessionRecorderState>({
    isInitialized: false,
    sessionType: null,
    sessionState: null,
    isOnline: true,
    error: null,
  });
