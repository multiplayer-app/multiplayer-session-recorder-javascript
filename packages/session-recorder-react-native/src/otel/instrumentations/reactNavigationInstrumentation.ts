import { InstrumentationBase } from '@opentelemetry/instrumentation'
import { trace, SpanStatusCode } from '@opentelemetry/api'

export class ReactNavigationInstrumentation extends InstrumentationBase {
  private navigationRef: any = null

  constructor() {
    super('react-navigation', '1.0.0', {})
  }

  init(): void {
    // Initialize the instrumentation
  }

  enable(): void {
    // Enable the instrumentation
    super.enable()
  }

  setNavigationRef(ref: any) {
    this.navigationRef = ref
    this._setupNavigationListener()
  }

  private _setupNavigationListener() {
    if (!this.navigationRef) return

    // Listen to navigation state changes
    this.navigationRef.addListener('state', (e: any) => {
      this._recordNavigationEvent('state_change', e.data)
    })

    // Listen to focus events
    this.navigationRef.addListener('focus', (e: any) => {
      this._recordNavigationEvent('focus', e.data)
    })

    // Listen to blur events
    this.navigationRef.addListener('blur', (e: any) => {
      this._recordNavigationEvent('blur', e.data)
    })
  }

  private _recordNavigationEvent(eventType: string, data: any) {
    const span = trace.getTracer('navigation').startSpan(`Navigation.${eventType}`, {
      attributes: {
        'navigation.system': 'ReactNavigation',
        'navigation.operation': eventType,
        'navigation.type': eventType,
        'navigation.timestamp': Date.now(),
      },
    })

    if (data) {
      if (data.routeName) {
        span.setAttribute('navigation.route_name', data.routeName)
      }
      if (data.params) {
        span.setAttribute('navigation.params', JSON.stringify(data.params))
      }
      if (data.key) {
        span.setAttribute('navigation.key', data.key)
      }
    }

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
  }

  // Manual navigation tracking methods
  recordNavigate(routeName: string, params?: Record<string, any>) {
    const span = trace.getTracer('navigation').startSpan('Navigation.navigate', {
      attributes: {
        'navigation.system': 'ReactNavigation',
        'navigation.operation': 'navigate',
        'navigation.route_name': routeName,
        'navigation.timestamp': Date.now(),
      },
    })

    if (params) {
      span.setAttribute('navigation.params', JSON.stringify(params))
    }

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
  }

  recordGoBack() {
    const span = trace.getTracer('navigation').startSpan('Navigation.goBack', {
      attributes: {
        'navigation.system': 'ReactNavigation',
        'navigation.operation': 'goBack',
        'navigation.timestamp': Date.now(),
      },
    })

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
  }

  recordReset(routes: any[]) {
    const span = trace.getTracer('navigation').startSpan('Navigation.reset', {
      attributes: {
        'navigation.system': 'ReactNavigation',
        'navigation.operation': 'reset',
        'navigation.routes_count': routes.length,
        'navigation.timestamp': Date.now(),
      },
    })

    if (routes.length > 0) {
      span.setAttribute('navigation.initial_route', routes[0].name)
    }

    span.setStatus({ code: SpanStatusCode.OK })
    span.end()
  }
}
