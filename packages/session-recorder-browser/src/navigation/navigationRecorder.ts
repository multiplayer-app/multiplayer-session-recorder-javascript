import { trace, SpanStatusCode } from '@opentelemetry/api'
import { SessionType } from '@multiplayer-app/session-recorder-common'

import {
  NavigationRecorderConfig,
  NavigationRecorderPublicApi,
  NavigationSessionContext,
  NavigationSignal,
} from './types'

const DEFAULT_CONFIG: NavigationRecorderConfig = {
  enabled: true,
}

const DEFAULT_FRAMEWORK = 'web'
const DEFAULT_SOURCE = 'router'

export class NavigationRecorder {
  private config: NavigationRecorderConfig = { ...DEFAULT_CONFIG }
  private isRecording = false
  private currentRoute: string | null = null
  private stack: string[] = []
  private navigationStartTime = 0
  private sessionContext: Required<NavigationSessionContext> = {
    sessionId: null,
    sessionType: SessionType.MANUAL,
  }

  public readonly api: NavigationRecorderPublicApi = {
    record: (signal: NavigationSignal) => this.record(signal),
    reset: () => this.reset(),
    getCurrentRoute: () => this.currentRoute,
    getStack: () => [...this.stack],
  }

  init(config?: Partial<NavigationRecorderConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  start(context?: NavigationSessionContext): void {
    if (!this.config.enabled) {
      return
    }

    this.sessionContext = {
      sessionId: context?.sessionId ?? null,
      sessionType: context?.sessionType ?? SessionType.MANUAL,
    }

    this.isRecording = true
    this.navigationStartTime = Date.now()
  }

  pause(): void {
    this.isRecording = false
  }

  resume(): void {
    if (!this.config.enabled) {
      return
    }
    this.isRecording = true
    this.navigationStartTime = Date.now()
  }

  stop(): void {
    this.isRecording = false
    this.reset()
  }

  record(signal: NavigationSignal): void {
    if (!this.config.enabled || !this.isRecording) {
      return
    }

    const timestamp = signal.timestamp ?? Date.now()
    const routeKey = this.resolveRouteKey(signal)
    const previousRoute = this.currentRoute

    if (routeKey) {
      this.updateNavigationStack(routeKey, signal.navigationType)
      this.currentRoute = routeKey
    }

    const metadata: Record<string, any> = {
      ...(signal.metadata || {}),
      framework: signal.framework || DEFAULT_FRAMEWORK,
      source: signal.source || DEFAULT_SOURCE,
      navigationType: signal.navigationType || (previousRoute ? 'push' : 'initial'),
      navigationDuration: timestamp - this.navigationStartTime,
      stackDepth: this.stack.length,
    }

    if (previousRoute) {
      metadata.previousRoute = previousRoute
    }

    if (signal.path) {
      metadata.path = signal.path
    }

    if (signal.title) {
      metadata.documentTitle = signal.title
    }

    if (signal.url) {
      metadata.url = signal.url
    }

    if (signal.state !== undefined) {
      metadata.state = this.stringifySafe(signal.state)
    }

    const paramsString = signal.params ? this.stringifySafe(signal.params) : undefined
    this.recordSpan({
      timestamp,
      routeName: signal.routeName || routeKey,
      paramsString,
      metadata,
    })

    this.navigationStartTime = timestamp
  }

  private recordSpan(payload: {
    timestamp: number
    routeName?: string | null
    paramsString?: string
    metadata: Record<string, any>
  }): void {
    try {
      const span = trace.getTracer('navigation').startSpan('Navigation.navigate', {
        startTime: payload.timestamp,
        attributes: {
          'navigation.system': 'router',
          'navigation.operation': 'navigate',
          'navigation.type': 'navigate',
          'navigation.platform': 'web',
          'navigation.session_id': this.sessionContext.sessionId ?? undefined,
          'navigation.session_type': this.sessionContext.sessionType,
          'navigation.application': this.config.application,
          'navigation.environment': this.config.environment,
          'navigation.version': this.config.version,
        },
      })

      if (payload.routeName) {
        span.setAttribute('navigation.route_name', payload.routeName)
      }

      if (payload.paramsString) {
        span.setAttribute('navigation.params', payload.paramsString)
      }

      Object.entries(payload.metadata).forEach(([key, value]) => {
        const normalizedValue =
          typeof value === 'string' ? value : this.stringifySafe(value)
        span.setAttribute(`navigation.metadata.${key}`, normalizedValue)
      })

      span.setStatus({ code: SpanStatusCode.OK })
      span.end(payload.timestamp)
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[SessionRecorder][NavigationRecorder] Failed to record navigation span', error)
      }
    }
  }

  private updateNavigationStack(routeName: string, navigationType?: string): void {
    const normalized = (navigationType || '').toLowerCase()

    if (normalized === 'replace') {
      if (this.stack.length) {
        this.stack[this.stack.length - 1] = routeName
      } else {
        this.stack.push(routeName)
      }
      return
    }

    if (normalized === 'pop' || normalized === 'back' || normalized === 'goback') {
      const index = this.stack.lastIndexOf(routeName)
      if (index >= 0) {
        this.stack = this.stack.slice(0, index + 1)
      } else if (this.stack.length) {
        this.stack.pop()
      }
      return
    }

    if (!this.stack.length || this.stack[this.stack.length - 1] !== routeName) {
      this.stack.push(routeName)
    }
  }

  private resolveRouteKey(signal: NavigationSignal): string {
    if (signal.routeName && typeof signal.routeName === 'string') {
      return signal.routeName
    }

    if (signal.path && typeof signal.path === 'string') {
      return signal.path
    }

    if (signal.url && typeof signal.url === 'string') {
      try {
        return new URL(signal.url).pathname || signal.url
      } catch (_error) {
        return signal.url
      }
    }

    if (signal.title && typeof signal.title === 'string') {
      return signal.title
    }

    return 'unknown'
  }

  private stringifySafe(value: unknown): string {
    try {
      return JSON.stringify(value)
    } catch (_error) {
      return String(value)
    }
  }

  private reset(): void {
    this.stack = []
    this.currentRoute = null
    this.navigationStartTime = Date.now()
  }
}
