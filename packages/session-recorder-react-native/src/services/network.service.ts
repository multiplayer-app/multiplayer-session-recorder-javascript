import { Platform } from 'react-native';
import { logger } from '../utils';
import { sessionRecorderStore } from '../context/SessionRecorderStore';

// Safe import for NetInfo with web fallback
let NetInfo: any = null;
const isWeb = Platform.OS === 'web';

if (!isWeb) {
  try {
    NetInfo = require('@react-native-community/netinfo').default;
  } catch (error) {
    console.warn('NetInfo not available:', error);
  }
} else {
  // Web fallback using navigator.onLine
  NetInfo = {
    fetch: () =>
      Promise.resolve({
        isConnected: true, // Default to connected for web
        type: 'unknown',
        isInternetReachable: true,
      }),
    addEventListener: (_callback: (state: any) => void) => {
      // Return a no-op function for web
      return () => {};
    },
  };
}

export interface NetworkState {
  isConnected: boolean;
  type: string | null;
  isInternetReachable: boolean | null;
}

export type NetworkStateChangeCallback = (state: NetworkState) => void;

export class NetworkService {
  private static instance: NetworkService | null = null;
  private _isOnline = true;
  private unsubscribe: (() => void) | null = null;
  private callbacks: NetworkStateChangeCallback[] = [];

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  /**
   * Initialize network monitoring
   */
  async init(): Promise<void> {
    try {
      // Get initial network state
      const initialState = await NetInfo.fetch();
      this._isOnline = initialState.isConnected ?? true;

      // Update store with initial state
      sessionRecorderStore.setState({ isOnline: this._isOnline });

      // Notify callbacks
      this.notifyCallbacks({
        isConnected: this._isOnline,
        type: initialState.type,
        isInternetReachable: initialState.isInternetReachable,
      });

      // Listen for network state changes
      this.unsubscribe = NetInfo.addEventListener((state: any) => {
        const wasOnline = this._isOnline;
        this._isOnline = state.isConnected ?? true;

        // Update store
        sessionRecorderStore.setState({ isOnline: this._isOnline });

        // Notify callbacks
        this.notifyCallbacks({
          isConnected: this._isOnline,
          type: state.type,
          isInternetReachable: state.isInternetReachable,
        });

        // Log state changes
        if (wasOnline && !this._isOnline) {
          logger.info('NetworkService', 'Network went offline');
        } else if (!wasOnline && this._isOnline) {
          logger.info('NetworkService', 'Network came back online');
        }
      });

      logger.info('NetworkService', 'Network monitoring initialized');
    } catch (error) {
      logger.error(
        'NetworkService',
        'Failed to initialize network monitoring',
        error
      );
    }
  }

  /**
   * Get current network state
   */
  getCurrentState(): NetworkState {
    return {
      isConnected: this._isOnline,
      type: null, // We don't store this in the service
      isInternetReachable: null, // We don't store this in the service
    };
  }

  /**
   * Check if device is online
   */
  isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Add callback for network state changes
   */
  addCallback(callback: NetworkStateChangeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove callback for network state changes
   */
  removeCallback(callback: NetworkStateChangeCallback): void {
    this.callbacks = this.callbacks.filter((cb) => cb !== callback);
  }

  /**
   * Notify all callbacks of network state change
   */
  private notifyCallbacks(state: NetworkState): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        logger.error(
          'NetworkService',
          'Error in network state callback',
          error
        );
      }
    });
  }

  /**
   * Cleanup network monitoring
   */
  cleanup(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.callbacks = [];
    logger.info('NetworkService', 'Network monitoring cleaned up');
  }

  /**
   * Force refresh network state
   */
  async refresh(): Promise<NetworkState> {
    try {
      const state = await NetInfo.fetch();
      this._isOnline = state.isConnected ?? true;
      sessionRecorderStore.setState({ isOnline: this._isOnline });

      const networkState: NetworkState = {
        isConnected: this._isOnline,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      };

      this.notifyCallbacks(networkState);
      return networkState;
    } catch (error) {
      logger.error('NetworkService', 'Failed to refresh network state', error);
      throw error;
    }
  }
}
