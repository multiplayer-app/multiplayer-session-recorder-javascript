import { createStore, Store } from '../utils/createStore'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { SessionState } from '../types'

export type SessionRecorderState = {
  isInitialized: boolean
  sessionType: SessionType | null
  sessionState: SessionState | null
  isWidgetModalVisible: boolean
}

export const sessionRecorderStore: Store<SessionRecorderState> = createStore<SessionRecorderState>({
  isInitialized: false,
  sessionType: null,
  sessionState: null,
  isWidgetModalVisible: false,
})
