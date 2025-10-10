import { createStore, type Store } from '../utils/createStore'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { SessionState } from '../types'

export type SessionRecorderState = {
  isInitialized: boolean
  sessionType: SessionType | null
  sessionState: SessionState | null
  isWidgetModalVisible: boolean
  isOnline: boolean
  error: string | null
}

export const sessionRecorderStore: Store<SessionRecorderState> = createStore<SessionRecorderState>({
  isInitialized: false,
  sessionType: null,
  sessionState: null,
  isWidgetModalVisible: false,
  isOnline: true,
  error: null,
})
