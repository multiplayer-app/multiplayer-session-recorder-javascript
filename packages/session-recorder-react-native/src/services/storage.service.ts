import AsyncStorage from '@react-native-async-storage/async-storage'
import { SessionType } from '@multiplayer-app/session-recorder-common'
import { ISession, SessionState } from '../types'

interface CacheData {
  sessionId: string | null
  sessionType: SessionType | null
  sessionState: SessionState | null
  sessionObject: ISession | null
}

export class StorageService {
  private static readonly SESSION_ID_KEY = 'session_id'
  private static readonly SESSION_TYPE_KEY = 'session_type'
  private static readonly SESSION_STATE_KEY = 'session_state'
  private static readonly SESSION_OBJECT_KEY = 'session_object'

  private static cache: CacheData = {
    sessionId: null,
    sessionType: null,
    sessionState: null,
    sessionObject: null,
  }

  private static cacheInitialized = false

  constructor() {
    StorageService.initialize()
  }

  private static async initializeCache(): Promise<void> {
    if (StorageService.cacheInitialized) return

    try {
      const [sessionId, sessionType, sessionState, sessionObject] = await Promise.all([
        AsyncStorage.getItem(StorageService.SESSION_ID_KEY),
        AsyncStorage.getItem(StorageService.SESSION_TYPE_KEY),
        AsyncStorage.getItem(StorageService.SESSION_STATE_KEY),
        AsyncStorage.getItem(StorageService.SESSION_OBJECT_KEY),
      ])

      StorageService.cache = {
        sessionId,
        sessionType: sessionType as SessionType | null,
        sessionState: sessionState as SessionState | null,
        sessionObject: sessionObject ? JSON.parse(sessionObject) : null,
      }
      StorageService.cacheInitialized = true
    } catch (error) {
      // Failed to initialize cache - silently continue
      StorageService.cacheInitialized = true // Mark as initialized to prevent retries
    }
  }

  saveSessionId(sessionId: string): void {
    try {
      StorageService.cache.sessionId = sessionId
      AsyncStorage.setItem(StorageService.SESSION_ID_KEY, sessionId).catch(error => {
        // Failed to persist session ID - silently continue
      })
    } catch (error) {
      // Failed to save session ID - silently continue
      throw error
    }
  }

  getSessionId(): string | null {
    return StorageService.cache.sessionId
  }

  saveSessionType(sessionType: SessionType): void {
    try {
      StorageService.cache.sessionType = sessionType
      AsyncStorage.setItem(StorageService.SESSION_TYPE_KEY, sessionType).catch(error => {
        // Failed to persist session type - silently continue
      })
    } catch (error) {
      // Failed to save session type - silently continue
      throw error
    }
  }

  getSessionType(): SessionType | null {
    return StorageService.cache.sessionType
  }

  saveSessionState(state: SessionState): void {
    try {
      StorageService.cache.sessionState = state

      AsyncStorage.setItem(StorageService.SESSION_STATE_KEY, state).catch(error => {
        // Failed to persist session state - silently continue
      })
    } catch (error) {
      // Failed to save session state - silently continue
      throw error
    }
  }

  getSessionState(): SessionState | null {
    return StorageService.cache.sessionState
  }

  saveSessionObject(session: ISession): void {
    try {
      StorageService.cache.sessionObject = session
      AsyncStorage.setItem(StorageService.SESSION_OBJECT_KEY, JSON.stringify(session)).catch(error => {
        // Failed to persist session object - silently continue
      })
    } catch (error) {
      // Failed to save session object - silently continue
      throw error
    }
  }

  getSessionObject(): ISession | null {
    return StorageService.cache.sessionObject
  }

  clearSessionData(): void {
    try {
      // Clear cache immediately
      StorageService.cache = {
        sessionId: null,
        sessionType: null,
        sessionState: null,
        sessionObject: null,
      }

      // Clear persistent storage asynchronously
      AsyncStorage.multiRemove([
        StorageService.SESSION_ID_KEY,
        StorageService.SESSION_TYPE_KEY,
        StorageService.SESSION_STATE_KEY,
        StorageService.SESSION_OBJECT_KEY,
      ]).catch(error => {
        // Failed to clear session data from storage - silently continue
      })
    } catch (error) {
      // Failed to clear session data - silently continue
      throw error
    }
  }

  getAllSessionData(): CacheData {
    return {
      sessionId: StorageService.cache.sessionId,
      sessionType: StorageService.cache.sessionType,
      sessionState: StorageService.cache.sessionState,
      sessionObject: StorageService.cache.sessionObject,
    }
  }

  // Initialize cache on first use - call this method when the service is first used
  static async initialize(): Promise<void> {
    await StorageService.initializeCache()
  }
}
