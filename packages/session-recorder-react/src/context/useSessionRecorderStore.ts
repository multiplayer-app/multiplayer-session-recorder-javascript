import { SessionState, SessionType } from '@multiplayer-app/session-recorder-browser';

import {
  type SessionRecorderState,
  sessionRecorderStore,
} from './SessionRecorderStore';
import { useStoreSelector } from './useStoreSelector';

/**
 * Select a derived slice from the shared Session Recorder store.
 * Works in both React (web) and React Native since the store shape is identical.
 *
 * @param selector - Function that maps the full store state to the slice you need
 * @param equalityFn - Optional comparator to avoid unnecessary re-renders
 * @returns The selected slice of state
 */
export function useSessionRecorderStore<TSlice>(
  selector: (s: SessionRecorderState) => TSlice,
  equalityFn?: (a: TSlice, b: TSlice) => boolean
): TSlice {
  return useStoreSelector<SessionRecorderState, TSlice>(
    sessionRecorderStore,
    selector,
    equalityFn
  );
}

/**
 * Read the current session recording state (started, paused, stopped).
 */
export function useSessionRecordingState() {
  return useSessionRecorderStore<SessionState | null>((s) => s.sessionState);
}

/**
 * Read the current session type (MANUAL/CONTINUOUS).
 */
export function useSessionType() {
  return useSessionRecorderStore<SessionType | null>((s) => s.sessionType);
}

/**
 * Check whether the Session Recorder has been initialized.
 */
export function useIsInitialized() {
  return useSessionRecorderStore<boolean>((s) => s.isInitialized);
}
