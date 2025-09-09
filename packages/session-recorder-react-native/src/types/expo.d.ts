import { SessionRecorderOptions, PlatformInfo } from './index'

declare module '@multiplayer-app/session-recorder-react-native' {
  export interface ExpoSessionRecorderOptions extends SessionRecorderOptions {
    platform: 'expo'
    expoVersion?: string
  }

  export interface ExpoPlatformInfo {
    isExpo: true
    isReactNative: true
    platform: 'ios' | 'android' | 'web'
    expoVersion: string
    deviceType: 'expo'
  }

  export function isExpoEnvironment(): boolean
  export function getPlatformAttributes(): Record<string, any>
  export function detectPlatform(): PlatformInfo | ExpoPlatformInfo
}

// Expo-specific exports
export * from './index'
