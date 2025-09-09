import { IResourceAttributes } from '../types'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

export interface PlatformInfo {
  isExpo: boolean
  isReactNative: boolean
  platform: 'ios' | 'android' | 'web' | 'unknown'
  platformVersion?: string
  expoVersion?: string
  deviceType: string
}

export function detectPlatform(): PlatformInfo {
  try {
    // Check if we're in an Expo environment
    const isExpo = !!Constants.default?.expoVersion || !!Constants.expoVersion

    if (isExpo) {
      const expoVersion = Constants.default?.expoVersion || Constants.expoVersion
      const platform = Constants.default?.platform || Constants.platform

      return {
        isExpo: true,
        isReactNative: true,
        platform: platform?.ios ? 'ios' : platform?.android ? 'android' : 'unknown',
        expoVersion,
        deviceType: 'expo',
      }
    }

    // Fallback to React Native detection
    return {
      isExpo: false,
      isReactNative: true,
      platform: Platform.OS as 'ios' | 'android' | 'web' | 'unknown',
      platformVersion: Platform.Version?.toString(),
      deviceType: Platform.OS,
    }
  } catch (error) {
    // Fallback for web or other environments
    return {
      isExpo: false,
      isReactNative: false,
      platform: 'unknown',
      deviceType: 'unknown',
    }
  }
}

export function getPlatformAttributes(): Record<string, any> {
  const platformInfo = detectPlatform()

  const attributes: Record<string, any> = {
    'platform': platformInfo.isExpo ? 'expo' : 'react-native',
    'device.type': platformInfo.deviceType,
  }

  if (platformInfo.platformVersion) {
    attributes['platform.version'] = platformInfo.platformVersion
  }

  if (platformInfo.expoVersion) {
    attributes['expo.version'] = platformInfo.expoVersion
  }

  return attributes
}

export function isExpoEnvironment(): boolean {
  return detectPlatform().isExpo
}

export function isReactNativeEnvironment(): boolean {
  return detectPlatform().isReactNative
}


export const getNavigatorInfo = (): IResourceAttributes => {
  return {
    platform: 'react-native',
    userAgent: 'React Native',
    language: 'en',
    timestamp: new Date().toISOString(),
    ...getPlatformAttributes(),
  }
}