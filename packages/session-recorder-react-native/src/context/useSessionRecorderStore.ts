import { SessionType } from "@multiplayer-app/session-recorder-common"
import { SessionState } from "../types"
import { useStoreSelector } from "./useStoreSelector"
import { type SessionRecorderState, sessionRecorderStore } from "./SessionRecorderStore"

export function useSessionRecorderStore<TSlice>(
  selector: (s: SessionRecorderState) => TSlice,
  equalityFn?: (a: TSlice, b: TSlice) => boolean
): TSlice {
  return useStoreSelector<SessionRecorderState, TSlice>(sessionRecorderStore, selector, equalityFn)
}

export function useSessionRecordingState() {
  return useSessionRecorderStore<SessionState | null>((s) => s.sessionState)
}

export function useSessionType() {
  return useSessionRecorderStore<SessionType | null>((s) => s.sessionType)
}

export function useIsInitialized() {
  return useSessionRecorderStore<boolean>((s) => s.isInitialized)
}

export function useWidgetModalVisible() {
  return useSessionRecorderStore<boolean>((s) => s.isWidgetModalVisible)
}