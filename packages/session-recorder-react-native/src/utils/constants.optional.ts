// Non-Expo fallback: export undefined to avoid bundling expo-constants in non-Expo apps
// Define a lightweight type that includes only the members we read.
export type OptionalExpoConstants = {
  expoVersion?: string
  platform?: { ios?: unknown; android?: unknown }
  expoConfig?: {
    name?: string
    version?: string
    ios?: { buildNumber?: string | number; bundleIdentifier?: string }
    android?: { versionCode?: string | number; package?: string }
  }
} | undefined

const OptionalConstants: OptionalExpoConstants = undefined

export default OptionalConstants
