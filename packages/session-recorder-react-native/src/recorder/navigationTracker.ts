import { NavigationEvent, RecorderConfig } from '../types'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { logger } from '../utils'

export class NavigationTracker {
  private config?: RecorderConfig
  private isRecording = false
  private navigationRef: any = null
  private events: NavigationEvent[] = []
  private navigationListeners: Map<string, any> = new Map()
  private currentRoute: string | null = null
  private navigationStack: string[] = []
  private navigationStartTime: number = 0

  init(config: RecorderConfig): void {
    this.config = config
  }

  setNavigationRef(ref: any): void {
    this.navigationRef = ref
    if (this.isRecording) {
      this._setupNavigationListener()
    }
  }

  start(): void {
    logger.info('NavigationTracker', 'Navigation tracking started')
    this.isRecording = true
    this.events = []
    this.navigationStack = []
    this.navigationStartTime = Date.now()
    this._setupNavigationListener()
    // Navigation tracking started
  }

  stop(): void {
    this.isRecording = false
    this._removeNavigationListener()
    // Navigation tracking stopped
  }

  pause(): void {
    this.isRecording = false
  }

  resume(): void {
    this.isRecording = true
    this._setupNavigationListener()
  }

  private _setupNavigationListener(): void {
    if (!this.navigationRef) {
      // Navigation ref not set - silently continue
      return
    }

    try {
      // Listen to navigation state changes
      const stateListener = this.navigationRef.addListener('state', (e: any) => {
        this._recordNavigationEvent('state_change', e.data)
      })

      // Listen to focus events
      const focusListener = this.navigationRef.addListener('focus', (e: any) => {
        this._recordNavigationEvent('focus', e.data)
      })

      // Listen to blur events
      const blurListener = this.navigationRef.addListener('blur', (e: any) => {
        this._recordNavigationEvent('blur', e.data)
      })

      // Listen to beforeRemove events
      const beforeRemoveListener = this.navigationRef.addListener('beforeRemove', (e: any) => {
        this._recordNavigationEvent('beforeRemove', e.data)
      })

      // Store listeners for cleanup
      this.navigationListeners.set('state', stateListener)
      this.navigationListeners.set('focus', focusListener)
      this.navigationListeners.set('blur', blurListener)
      this.navigationListeners.set('beforeRemove', beforeRemoveListener)

      // Navigation listeners setup complete
    } catch (error) {
      // Failed to setup navigation listeners - silently continue
    }
  }

  private _removeNavigationListener(): void {
    try {
      // Remove all listeners
      this.navigationListeners.forEach((listener, key) => {
        if (listener && typeof listener.remove === 'function') {
          listener.remove()
        }
      })
      this.navigationListeners.clear()
      // Navigation listeners removed
    } catch (error) {
      // Failed to remove navigation listeners - silently continue
    }
  }

  private _recordNavigationEvent(eventType: string, data: any): void {
    if (!this.isRecording) return

    const event: NavigationEvent = {
      type: 'navigate', // Default type
      timestamp: Date.now(),
      metadata: {
        eventType,
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
      },
    }

    if (data) {
      if (data.routeName) {
        event.routeName = data.routeName
        this._updateNavigationStack(data.routeName, eventType)
      }
      if (data.params) {
        event.params = data.params
      }
      if (data.key) {
        event.metadata!.routeKey = data.key
      }
    }

    this.events.push(event)
    this._sendEvent(event)
    this._recordOpenTelemetrySpan(event)
  }



  private _updateNavigationStack(routeName: string, eventType: string): void {
    if (eventType === 'focus' || eventType === 'state_change') {
      if (this.currentRoute !== routeName) {
        this.currentRoute = routeName
        this.navigationStack.push(routeName)
      }
    } else if (eventType === 'blur' || eventType === 'beforeRemove') {
      const index = this.navigationStack.indexOf(routeName)
      if (index > -1) {
        this.navigationStack.splice(index, 1)
      }
    }
  }

  private _sendEvent(event: NavigationEvent): void {
    // Navigation event recorded
  }

  private _recordOpenTelemetrySpan(event: NavigationEvent): void {
    try {
      const span = trace.getTracer('navigation').startSpan(`Navigation.${event.type}`, {
        attributes: {
          'navigation.system': 'ReactNavigation',
          'navigation.operation': event.type,
          'navigation.type': event.type,
          'navigation.timestamp': event.timestamp,
          'navigation.platform': 'react-native',
        },
      })

      if (event.routeName) {
        span.setAttribute('navigation.route_name', event.routeName)
      }
      if (event.params) {
        span.setAttribute('navigation.params', JSON.stringify(event.params))
      }
      if (event.metadata) {
        Object.entries(event.metadata).forEach(([key, value]) => {
          span.setAttribute(`navigation.metadata.${key}`, String(value))
        })
      }

      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
    } catch (error) {
      // Failed to record OpenTelemetry span for navigation - silently continue
    }
  }

  // Public methods for manual event recording
  recordNavigate(routeName: string, params?: Record<string, any>): void {
    const event: NavigationEvent = {
      type: 'navigate',
      timestamp: Date.now(),
      routeName,
      params,
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        manual: true,
      },
    }

    this._updateNavigationStack(routeName, 'focus')
    this._recordEvent(event)
  }

  recordGoBack(): void {
    const event: NavigationEvent = {
      type: 'goBack',
      timestamp: Date.now(),
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        manual: true,
      },
    }

    this._recordEvent(event)
  }

  recordReset(routes: any[]): void {
    const event: NavigationEvent = {
      type: 'reset',
      timestamp: Date.now(),
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        routesCount: routes.length,
        manual: true,
      },
    }

    // Update navigation stack
    this.navigationStack = routes.map(route => route.name || route.routeName)
    if (routes.length > 0) {
      this.currentRoute = routes[0].name || routes[0].routeName
    }

    this._recordEvent(event)
    this._recordEvent(event)
  }

  private _recordEvent(event: NavigationEvent): void {
    if (!this.isRecording) return

    this.events.push(event)
    this._sendEvent(event)
    this._recordOpenTelemetrySpan(event)
  }

  // Advanced navigation tracking methods
  recordDeepLink(url: string, params?: Record<string, any>): void {
    const event: NavigationEvent = {
      type: 'navigate',
      timestamp: Date.now(),
      routeName: 'deepLink',
      params: { url, ...params },
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        deepLink: true,
      },
    }

    this._recordEvent(event)
    this._recordEvent(event)
  }

  recordTabChange(tabName: string, tabIndex: number): void {
    const event: NavigationEvent = {
      type: 'navigate',
      timestamp: Date.now(),
      routeName: tabName,
      params: { tabIndex },
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        tabChange: true,
        tabIndex,
      },
    }

    this._recordEvent(event)
    this._recordEvent(event)
  }

  recordModalOpen(modalName: string, params?: Record<string, any>): void {
    const event: NavigationEvent = {
      type: 'navigate',
      timestamp: Date.now(),
      routeName: modalName,
      params,
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        modal: true,
      },
    }

    this._recordEvent(event)
    this._recordEvent(event)
  }

  recordModalClose(modalName: string): void {
    const event: NavigationEvent = {
      type: 'goBack',
      timestamp: Date.now(),
      routeName: modalName,
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        modal: true,
        modalClose: true,
      },
    }

    this._recordEvent(event)
    this._recordEvent(event)
  }

  recordStackPush(routeName: string, params?: Record<string, any>): void {
    const event: NavigationEvent = {
      type: 'navigate',
      timestamp: Date.now(),
      routeName,
      params,
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        stackOperation: 'push',
      },
    }

    this._recordEvent(event)
    this._recordEvent(event)
  }

  recordStackPop(routeName?: string): void {
    const event: NavigationEvent = {
      type: 'goBack',
      timestamp: Date.now(),
      routeName,
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        stackOperation: 'pop',
      },
    }

    this._recordEvent(event)
    this._recordEvent(event)
  }

  // Performance monitoring
  recordNavigationPerformance(routeName: string, loadTime: number): void {
    const event: NavigationEvent = {
      type: 'navigate',
      timestamp: Date.now(),
      routeName,
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        performance: 'monitoring',
        loadTime,
      },
    }

    this._recordEvent(event)
    this._recordEvent(event)
  }

  // Error tracking
  recordNavigationError(error: Error, routeName?: string): void {
    const event: NavigationEvent = {
      type: 'navigate',
      timestamp: Date.now(),
      routeName,
      metadata: {
        navigationDuration: Date.now() - this.navigationStartTime,
        stackDepth: this.navigationStack.length,
        error: true,
        errorType: error.name,
        errorMessage: error.message,
      },
    }

    this._recordEvent(event)
    this._recordEvent(event)

    // Also record as OpenTelemetry error span
    try {
      const span = trace.getTracer('navigation').startSpan('Navigation.error', {
        attributes: {
          'navigation.system': 'ReactNavigation',
          'navigation.error': true,
          'navigation.error.type': error.name,
          'navigation.error.message': error.message,
          'navigation.route_name': routeName || 'unknown',
          'navigation.timestamp': Date.now(),
        },
      })

      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      span.recordException(error)
      span.end()
    } catch (spanError) {
      // Failed to record error span - silently continue
    }
  }

  // Get current navigation state
  getCurrentRoute(): string | null {
    return this.currentRoute
  }

  getNavigationStack(): string[] {
    return [...this.navigationStack]
  }

  getNavigationDepth(): number {
    return this.navigationStack.length
  }

  // Get recorded events
  getEvents(): NavigationEvent[] {
    return [...this.events]
  }

  // Clear events
  clearEvents(): void {
    this.events = []
  }

  // Get navigation statistics
  getNavigationStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    this.events.forEach(event => {
      stats[event.type] = (stats[event.type] || 0) + 1
    })
    return stats
  }

  // Get recording status
  isRecordingEnabled(): boolean {
    return this.isRecording
  }

  // Get navigation duration
  getNavigationDuration(): number {
    return Date.now() - this.navigationStartTime
  }
}
