import { SessionType } from '@multiplayer-app/session-recorder-common'

export interface NavigationRecorderConfig {
  enabled: boolean
  application?: string
  environment?: string
  version?: string
}

export interface NavigationSessionContext {
  sessionId?: string | null
  sessionType?: SessionType
}

export type NavigationDirection = 'push' | 'replace' | 'pop' | 'back' | 'forward' | 'initial' | 'reload' | 'unknown'

export interface NavigationSignal {
  path?: string
  routeName?: string
  title?: string
  url?: string
  params?: Record<string, any>
  state?: unknown
  navigationType?: NavigationDirection | string
  framework?: string
  source?: string
  metadata?: Record<string, any>
  timestamp?: number
}

export interface NavigationRecorderPublicApi {
  record(signal: NavigationSignal): void
  reset(): void
  getCurrentRoute(): string | null
  getStack(): string[]
}
