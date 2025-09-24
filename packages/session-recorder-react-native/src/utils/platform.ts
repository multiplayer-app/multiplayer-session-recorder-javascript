import { IResourceAttributes } from '../types'
import Constants from 'expo-constants'
import { Platform, Dimensions, PixelRatio } from 'react-native'
import { version } from '../version'
import { getAutoDetectedAppMetadata } from './app-metadata'

// Global app metadata configuration for non-Expo apps
let globalAppMetadata: { name?: string; version?: string; bundleId?: string } = {}

// Cache for auto-detected metadata to avoid repeated file reads
let autoDetectedMetadata: { name?: string; version?: string; bundleId?: string } | null = null

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
    platform: platformInfo.isExpo ? 'expo' : 'react-native',
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

/**
 * Configure app metadata for non-Expo React Native apps
 * Call this function in your app initialization to provide app information
 *
 * @example
 * ```typescript
 * import { configureAppMetadata } from '@multiplayer-app/session-recorder-react-native'
 *
 * // In your App.tsx or index.js
 * configureAppMetadata({
 *   name: 'My Awesome App',
 *   version: '1.2.3',
 *   bundleId: 'com.mycompany.myapp',
 *   buildNumber: '123',
 *   displayName: 'My App',
 * })
 * ```
 */
export function configureAppMetadata(metadata: {
  name?: string
  version?: string
  bundleId?: string
  buildNumber?: string
  displayName?: string
}): void {
  globalAppMetadata = { ...globalAppMetadata, ...metadata }
}

/**
 * Get configured app metadata
 */
export function getConfiguredAppMetadata(): { name?: string, version?: string, bundleId?: string, buildNumber?: string, displayName?: string, } {
  return { ...globalAppMetadata }
}

/**
 * Automatically detect app metadata from common configuration files
 * This runs without developer intervention
 */
function autoDetectAppMetadata(): { name?: string; version?: string; bundleId?: string } {
  if (autoDetectedMetadata) {
    return autoDetectedMetadata
  }

  try {
    // Get auto-detected metadata from build-time generated file
    const autoMetadata = getAutoDetectedAppMetadata()

    // Filter out undefined values
    const metadata: { name?: string; version?: string; bundleId?: string } = {}
    if (autoMetadata.name) metadata.name = autoMetadata.name
    if (autoMetadata.version) metadata.version = autoMetadata.version
    if (autoMetadata.bundleId) metadata.bundleId = autoMetadata.bundleId

    autoDetectedMetadata = metadata
    return metadata
  } catch (error) {
    // Silently fail - this is optional auto-detection
    autoDetectedMetadata = {}
    return {}
  }
}

/**
 * Enhanced app metadata detection with automatic fallbacks
 */
export function getAppMetadata(): { name?: string; version?: string; bundleId?: string } {
  // Priority order:
  // 1. Expo config (if available)
  // 2. Manually configured metadata
  // 3. Auto-detected metadata
  // 4. Fallbacks

  const expoMetadata = getExpoMetadata()
  const configuredMetadata = getConfiguredAppMetadata()
  const autoMetadata = autoDetectAppMetadata()

  return {
    name: expoMetadata.name || configuredMetadata.name || autoMetadata.name,
    version: expoMetadata.version || configuredMetadata.version || autoMetadata.version,
    bundleId: expoMetadata.bundleId || configuredMetadata.bundleId || autoMetadata.bundleId,
  }
}

/**
 * Get metadata from Expo config
 */
function getExpoMetadata(): { name?: string; version?: string; bundleId?: string } {
  const expoConfig = Constants.default?.expoConfig || Constants.expoConfig
  if (!expoConfig) return {}

  return {
    name: expoConfig.name,
    version: expoConfig.version,
    bundleId: expoConfig.ios?.bundleIdentifier || expoConfig.android?.package,
  }
}

export const getNavigatorInfo = (): IResourceAttributes => {
  const platformInfo = detectPlatform()
  const screenData = Dimensions.get('window')
  const screenDataScreen = Dimensions.get('screen')
  const pixelRatio = PixelRatio.get()

  // Get device type based on screen dimensions
  const getDeviceType = (): string => {
    const { width, height } = screenData
    const minDimension = Math.min(width, height)
    const maxDimension = Math.max(width, height)

    // Rough device type detection based on screen size
    if (maxDimension >= 1024) {
      return 'Tablet'
    } else if (minDimension >= 600) {
      return 'Large Phone'
    } else {
      return 'Phone'
    }
  }

  // Get orientation
  const getOrientation = (): string => {
    const { width, height } = screenData
    return width > height ? 'Landscape' : 'Portrait'
  }

  // Get OS version details
  const getOSInfo = (): string => {
    if (platformInfo.isExpo) {
      const platform = Constants.default?.platform || Constants.platform
      if (platform?.ios) {
        return `iOS ${Platform.Version}`
      } else if (platform?.android) {
        return `Android ${Platform.Version}`
      }
    }

    if (Platform.OS === 'ios') {
      return `iOS ${Platform.Version}`
    } else if (Platform.OS === 'android') {
      return `Android ${Platform.Version}`
    }

    return `${Platform.OS} ${Platform.Version || 'Unknown'}`
  }

  // Get device info string
  const getDeviceInfo = (): string => {
    const deviceType = getDeviceType()
    const osInfo = getOSInfo()
    return `${deviceType} - ${osInfo}`
  }

  // Get browser/runtime info
  const getBrowserInfo = (): string => {
    if (platformInfo.isExpo) {
      return `Expo ${platformInfo.expoVersion || 'Unknown'} - React Native`
    }
    return 'React Native'
  }

  // Get screen size string
  const getScreenSize = (): string => {
    return `${Math.round(screenData.width)}x${Math.round(screenData.height)}`
  }
  const metadata = getAppMetadata()
  // Get app info with fallbacks for non-Expo apps
  const getAppInfo = (): string => {
    const appName = getAppName()
    const appVersion = getAppVersion()
    return `${appName} v${appVersion}`
  }

  // Get app name with automatic detection
  const getAppName = (): string => {

    if (metadata.name) return metadata.name

    // Try configured display name as fallback
    const configuredMetadata = getConfiguredAppMetadata()
    if (configuredMetadata.displayName) return configuredMetadata.displayName

    // Final fallback
    return 'React Native App'
  }

  // Get app version with automatic detection
  const getAppVersion = (): string => {
    if (metadata.version) return metadata.version

    // Final fallback
    return 'Unknown'
  }

  // Get bundle ID with automatic detection
  const getBundleId = (): string => {
    if (metadata.bundleId) return metadata.bundleId

    // Fallback
    return 'com.reactnative.app'
  }

  // Get build number with multiple fallback strategies
  const getBuildNumber = (): string => {
    // Try Expo config first
    const expoBuildNumber =
      Constants.default?.expoConfig?.ios?.buildNumber ||
      Constants.expoConfig?.ios?.buildNumber ||
      Constants.default?.expoConfig?.android?.versionCode ||
      Constants.expoConfig?.android?.versionCode
    if (expoBuildNumber) return expoBuildNumber.toString()

    // Try configured metadata for non-Expo apps
    const configuredMetadata = getConfiguredAppMetadata()
    if (configuredMetadata.buildNumber) return configuredMetadata.buildNumber

    // Fallback
    return '1'
  }


  // Get hardware info
  const getHardwareInfo = (): string => {
    const pixelRatioInfo = `Pixel Ratio: ${pixelRatio}`
    const screenDensity = PixelRatio.getFontScale()
    return `${pixelRatioInfo}, Font Scale: ${screenDensity}`
  }

  return {
    // Core platform info
    platform: platformInfo.isExpo ? 'expo' : 'react-native',
    userAgent: getBrowserInfo(),
    timestamp: new Date().toISOString(),

    // Device and OS information
    deviceInfo: getDeviceInfo(),
    osInfo: getOSInfo(),
    browserInfo: getBrowserInfo(),

    // Screen information
    screenSize: getScreenSize(),
    pixelRatio: pixelRatio,
    orientation: getOrientation(),
    screenWidth: Math.round(screenData.width),
    screenHeight: Math.round(screenData.height),
    screenScale: pixelRatio,

    // Device capabilities
    hardwareConcurrency: 1, // React Native doesn't expose CPU cores directly
    cookiesEnabled: 'N/A', // Not applicable in React Native

    // App information
    packageVersion: version,
    appInfo: getAppInfo(),
    appName: getAppName(),
    appVersion: getAppVersion(),
    bundleId: getBundleId(),
    buildNumber: getBuildNumber(),

    // Platform specific
    platformType: platformInfo.platform,
    platformVersion: platformInfo.platformVersion,
    expoVersion: platformInfo.expoVersion,
    deviceType: getDeviceType(),

    // Performance and hardware
    hardwareInfo: getHardwareInfo(),

    // Screen details
    screenDensity: PixelRatio.getFontScale(),
    screenScaleFactor: pixelRatio,
    windowWidth: Math.round(screenData.width),
    windowHeight: Math.round(screenData.height),
    fullScreenWidth: Math.round(screenDataScreen.width),
    fullScreenHeight: Math.round(screenDataScreen.height),

    // Environment info
    isExpo: platformInfo.isExpo,
    isReactNative: platformInfo.isReactNative,
    environment: platformInfo.isExpo ? 'expo' : 'react-native',

    // System type identifier (previously in system tags)
    systemType: 'mobile',
    // Additional platform attributes
    // ...getPlatformAttributes(),
  }
}
