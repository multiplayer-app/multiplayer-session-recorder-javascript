import { Platform } from 'react-native';
import { SessionType, type ISession } from '@multiplayer-app/session-recorder-common';
import { logger } from '../utils';
import type { SessionState } from '../types';

// Safe import for AsyncStorage with web fallback
let AsyncStorage: any = null;
const isWeb = Platform.OS === 'web';

if (!isWeb) {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch (error) {
    console.warn('AsyncStorage not available:', error);
  }
} else {
  // Web fallback using localStorage
  AsyncStorage = {
    getItem: (_key: string) => Promise.resolve(null), // Simplified for web
    setItem: (_key: string, _value: string) => Promise.resolve(undefined),
    removeItem: (_key: string) => Promise.resolve(undefined),
    multiRemove: (_keys: string[]) => Promise.resolve(undefined),
  };
}

interface CacheData {
  sessionId: string | null;
  sessionType: SessionType | null;
  sessionState: SessionState | null;
  sessionObject: ISession | null;
  floatingButtonPosition: { x: number; y: number } | null;
}

export class StorageService {
  private static readonly SESSION_ID_KEY = 'session_id';
  private static readonly SESSION_TYPE_KEY = 'session_type';
  private static readonly SESSION_STATE_KEY = 'session_state';
  private static readonly SESSION_OBJECT_KEY = 'session_object';
  private static readonly FLOATING_BUTTON_POSITION_KEY =
    'floating_button_position';

  private static cache: CacheData = {
    sessionId: null,
    sessionType: null,
    sessionState: null,
    sessionObject: null,
    floatingButtonPosition: null,
  };

  private static cacheInitialized = false;
  private static instance: StorageService | null = null;
  private static positionSaveTimeout: any | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
      StorageService.initialize();
    }
    return StorageService.instance;
  }

  private static async initializeCache(): Promise<void> {
    if (StorageService.cacheInitialized) return;

    try {
      const [
        sessionId,
        sessionType,
        sessionState,
        sessionObject,
        floatingButtonPosition,
      ] = await Promise.all([
        AsyncStorage.getItem(StorageService.SESSION_ID_KEY),
        AsyncStorage.getItem(StorageService.SESSION_TYPE_KEY),
        AsyncStorage.getItem(StorageService.SESSION_STATE_KEY),
        AsyncStorage.getItem(StorageService.SESSION_OBJECT_KEY),
        AsyncStorage.getItem(StorageService.FLOATING_BUTTON_POSITION_KEY),
      ]);

      StorageService.cache = {
        sessionId,
        sessionType: sessionType as SessionType | null,
        sessionState: sessionState as SessionState | null,
        sessionObject: sessionObject ? JSON.parse(sessionObject) : null,
        floatingButtonPosition: floatingButtonPosition
          ? JSON.parse(floatingButtonPosition)
          : null,
      };
      StorageService.cacheInitialized = true;
    } catch (error) {
      // Failed to initialize cache - silently continue
      StorageService.cacheInitialized = true; // Mark as initialized to prevent retries
    }
  }

  saveSessionId(sessionId: string): void {
    try {
      StorageService.cache.sessionId = sessionId;
      AsyncStorage.setItem(StorageService.SESSION_ID_KEY, sessionId).catch(
        (_error: any) => {
          // Failed to persist session ID - silently continue
        }
      );
    } catch (error) {
      // Failed to save session ID - silently continue
      throw error;
    }
  }

  getSessionId(): string | null {
    return StorageService.cache.sessionId;
  }

  saveSessionType(sessionType: SessionType): void {
    try {
      StorageService.cache.sessionType = sessionType;
      AsyncStorage.setItem(StorageService.SESSION_TYPE_KEY, sessionType).catch(
        (_error: any) => {
          // Failed to persist session type - silently continue
        }
      );
    } catch (error) {
      // Failed to save session type - silently continue
      throw error;
    }
  }

  getSessionType(): SessionType | null {
    return StorageService.cache.sessionType;
  }

  saveSessionState(state: SessionState): void {
    try {
      StorageService.cache.sessionState = state;

      AsyncStorage.setItem(StorageService.SESSION_STATE_KEY, state).catch(
        (_error: any) => {
          // Failed to persist session state - silently continue
        }
      );
    } catch (error) {
      // Failed to save session state - silently continue
      throw error;
    }
  }

  getSessionState(): SessionState | null {
    return StorageService.cache.sessionState;
  }

  saveSessionObject(session: ISession): void {
    try {
      StorageService.cache.sessionObject = session;
      AsyncStorage.setItem(
        StorageService.SESSION_OBJECT_KEY,
        JSON.stringify(session)
      ).catch((_error: any) => {
        // Failed to persist session object - silently continue
      });
    } catch (error) {
      // Failed to save session object - silently continue
      throw error;
    }
  }

  getSessionObject(): ISession | null {
    return StorageService.cache.sessionObject;
  }

  clearSessionData(): void {
    try {
      // Clear cache immediately
      StorageService.cache = {
        ...StorageService.cache,
        sessionId: null,
        sessionType: null,
        sessionState: null,
        sessionObject: null,
      };

      // Clear persistent storage asynchronously
      AsyncStorage.multiRemove([
        StorageService.SESSION_ID_KEY,
        StorageService.SESSION_TYPE_KEY,
        StorageService.SESSION_STATE_KEY,
        StorageService.SESSION_OBJECT_KEY,
      ]).catch((_error: any) => {
        // Failed to clear session data from storage - silently continue
      });
    } catch (error) {
      // Failed to clear session data - silently continue
      throw error;
    }
  }

  getAllSessionData(): Omit<CacheData, 'floatingButtonPosition'> {
    return {
      sessionId: StorageService.cache.sessionId,
      sessionType: StorageService.cache.sessionType,
      sessionState: StorageService.cache.sessionState,
      sessionObject: StorageService.cache.sessionObject,
    };
  }

  saveFloatingButtonPosition(position: { x: number; y: number }): void {
    try {
      StorageService.cache.floatingButtonPosition = position;

      // Debounce AsyncStorage writes to avoid excessive I/O
      if (StorageService.positionSaveTimeout) {
        clearTimeout(StorageService.positionSaveTimeout);
      }

      StorageService.positionSaveTimeout = setTimeout(() => {
        AsyncStorage.setItem(
          StorageService.FLOATING_BUTTON_POSITION_KEY,
          JSON.stringify(position)
        ).catch((error: any) => {
          logger.error(
            'StorageService',
            'Failed to persist floating button position',
            error
          );
        });
      }, 100); // 100ms debounce
    } catch (error) {
      logger.error(
        'StorageService',
        'Failed to save floating button position',
        error
      );
      throw error;
    }
  }

  getFloatingButtonPosition(): { x: number; y: number } | null {
    return StorageService.cache.floatingButtonPosition;
  }

  // Initialize cache on first use - call this method when the service is first used
  static async initialize(): Promise<void> {
    await StorageService.initializeCache();
  }
}
