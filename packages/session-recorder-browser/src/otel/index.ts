import { resourceFromAttributes } from '@opentelemetry/resources'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import * as SemanticAttributes from '@opentelemetry/semantic-conventions'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import {
  SessionType,
  ATTR_MULTIPLAYER_SESSION_ID,
  SessionRecorderIdGenerator,
  SessionRecorderBrowserTraceExporter,
  SessionRecorderTraceIdRatioBasedSampler,
  SessionRecorderSdk,
  MULTIPLAYER_TRACE_CLIENT_ID_LENGTH,
} from '@multiplayer-app/session-recorder-common'
import { trace, SpanStatusCode, context, Span } from '@opentelemetry/api'
import { TracerBrowserConfig } from '../types'
import { OTEL_IGNORE_URLS } from '../config'
import { CrashBufferService } from '../services/crashBuffer.service'
import {
  processHttpPayload,
  headersToObject,
  extractResponseBody,
  getExporterEndpoint,
  getElementTextContent,
  getElementInnerText,
} from './helpers'

export class TracerBrowserSDK {
  private tracerProvider?: WebTracerProvider
  private config?: TracerBrowserConfig
  private sessionId = ''
  clientId = ''
  private idGenerator?: SessionRecorderIdGenerator
  private exporter?: SessionRecorderBrowserTraceExporter
  private globalErrorListenersRegistered = false
  private crashBuffer?: CrashBufferService

  constructor() { }

  private setSessionId(
    sessionId: string,
    sessionType: SessionType = SessionType.MANUAL,
  ) {
    this.sessionId = sessionId

    if (!this.idGenerator) {
      throw new Error('Id generator not initialized')
    }

    this.idGenerator.setSessionId(
      sessionId,
      sessionType,
      this.clientId,
    )
  }

  init(options: TracerBrowserConfig): void {
    this.config = options
    this.clientId = SessionRecorderSdk.getIdGenerator(MULTIPLAYER_TRACE_CLIENT_ID_LENGTH)()
    const { application, version, environment } = this.config

    this.idGenerator = new SessionRecorderIdGenerator()

    this.exporter = new SessionRecorderBrowserTraceExporter({
      apiKey: options.apiKey,
      url: getExporterEndpoint(options.exporterEndpoint),
      usePostMessageFallback: options.usePostMessageFallback,
    })

    this.tracerProvider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [SemanticAttributes.SEMRESATTRS_SERVICE_NAME]: application,
        [SemanticAttributes.SEMRESATTRS_SERVICE_VERSION]: version,
        [SemanticAttributes.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      }),
      idGenerator: this.idGenerator,
      sampler: new SessionRecorderTraceIdRatioBasedSampler(this.config.sampleTraceRatio),
      spanProcessors: [
        this._getSpanSessionIdProcessor(),
        this._getCrashBufferSpanProcessor(),
        new BatchSpanProcessor(this.exporter),
      ],
    })

    this.tracerProvider.register({
      // contextManager: new ZoneContextManager(),
      propagator: new W3CTraceContextPropagator(),
    })

    registerInstrumentations({
      tracerProvider: this.tracerProvider,
      instrumentations: [
        getWebAutoInstrumentations({
          '@opentelemetry/instrumentation-xml-http-request': {
            clearTimingResources: true,
            ignoreUrls: [
              ...OTEL_IGNORE_URLS,
              ...(this.config.ignoreUrls || []),
            ],
            propagateTraceHeaderCorsUrls: options.propagateTraceHeaderCorsUrls,
            applyCustomAttributesOnSpan: (span, xhr) => {
              if (!this.config) return

              const { captureBody, captureHeaders } = this.config

              try {
                if (!captureBody && !captureHeaders) {
                  return
                }
                // @ts-ignore
                const networkRequest = xhr.networkRequest

                const requestBody = networkRequest.requestBody
                const responseBody = networkRequest.responseBody
                const requestHeaders = networkRequest.requestHeaders || {}
                const responseHeaders = networkRequest.responseHeaders || {}

                const payload = {
                  requestBody,
                  responseBody,
                  requestHeaders,
                  responseHeaders,
                }
                processHttpPayload(payload, this.config, span)
              } catch (error) {
                // eslint-disable-next-line
                console.error('[MULTIPLAYER_SESSION_RECORDER] Failed to capture xml-http payload', error)
              }
            },
          },
          '@opentelemetry/instrumentation-fetch': {
            clearTimingResources: true,
            ignoreUrls: [
              ...OTEL_IGNORE_URLS,
              ...(this.config.ignoreUrls || []),
            ],
            propagateTraceHeaderCorsUrls: options.propagateTraceHeaderCorsUrls,
            applyCustomAttributesOnSpan: async (span, request, response) => {
              if (!this.config) return

              const { captureBody, captureHeaders } = this.config

              try {
                if (!captureBody && !captureHeaders) {
                  return
                }

                // Try to get data from our fetch wrapper first
                // @ts-ignore
                const networkRequest = response?.networkRequest

                let requestBody: any = null
                let responseBody: string | null = null
                let requestHeaders: Record<string, string> = {}
                let responseHeaders: Record<string, string> = {}

                if (networkRequest) {
                  // Use data captured by our fetch wrapper
                  requestBody = networkRequest.requestBody
                  responseBody = networkRequest.responseBody
                  requestHeaders = networkRequest.requestHeaders || {}
                  responseHeaders = networkRequest.responseHeaders || {}
                } else {
                  // Fallback to original OpenTelemetry approach
                  requestBody = request.body
                  requestHeaders = headersToObject(request.headers)
                  responseHeaders = headersToObject(response instanceof Response ? response.headers : undefined)

                  if (response instanceof Response && response.body) {
                    responseBody = await extractResponseBody(response)
                  }
                }

                const payload = {
                  requestBody,
                  responseBody,
                  requestHeaders,
                  responseHeaders,
                }
                processHttpPayload(payload, this.config, span)
              } catch (error) {
                // eslint-disable-next-line
                console.error('[MULTIPLAYER_SESSION_RECORDER] Failed to capture fetch payload', error)
              }
            },
          },
          '@opentelemetry/instrumentation-user-interaction': {
            shouldPreventSpanCreation: (_event, element: HTMLElement, span) => {
              if (span['parentSpanContext']) {
                return true
              }

              span.setAttribute('target.innerText', getElementInnerText(element))
              span.setAttribute('target.textContent', getElementTextContent(element))
              Array.from(element.attributes).forEach(attribute => {
                span.setAttribute(`target.attribute.${attribute.name}`, attribute.value)
              })

              return false
            },
          },
        }),
      ],
    })

    this._registerGlobalErrorListeners()
  }

  setCrashBuffer(crashBuffer: CrashBufferService | undefined): void {
    this.crashBuffer = crashBuffer
  }

  private _getCrashBufferSpanProcessor(): SpanProcessor {
    return {
      onStart: () => { },
      onEnd: (span: any) => {
        // Only buffer spans when we don't have an active debug session.
        if (this.sessionId) return
        if (!this.crashBuffer) return
        try {
          const now = Date.now()
          this.crashBuffer.appendOtelSpan({
            ts: now,
            span: this._serializeSpan(span),
          })
        } catch (_e) {
          // ignore
        }
      },
      shutdown: () => Promise.resolve(),
      forceFlush: () => Promise.resolve(),
    }
  }

  private _serializeSpan(span: any): any {
    const spanContext = span?.spanContext?.()
      ? span.spanContext()
      : span?._spanContext
    return {
      _spanContext: spanContext,
      name: span?.name,
      kind: span?.kind,
      links: span?.links,
      ended: span?.ended,
      events: span?.events,
      status: span?.status,
      endTime: span?.endTime,
      startTime: span?.startTime,
      duration: span?.duration,
      attributes: span?.attributes,
      parentSpanId: span?.parentSpanContext?.spanId,
      droppedAttributesCount: span?.droppedAttributesCount,
      droppedEventsCount: span?.droppedEventsCount,
      droppedLinksCount: span?.droppedLinksCount,
      resource: span?.resource ? {
        attributes: span.resource.attributes,
        asyncAttributesPending: span.resource.asyncAttributesPending,
      } : undefined,
    }
  }

  start(
    sessionId,
    sessionType: SessionType,
  ): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }

    this.setSessionId(sessionId, sessionType)
  }

  stop(): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }

    this.setSessionId('')
  }

  setApiKey(apiKey: string): void {
    if (!this.exporter) {
      throw new Error(
        'Configuration not initialized. Call init() before setApiKey().',
      )
    }

    this.exporter.setApiKey(apiKey)
  }

  /**
   * Capture an exception as an error span/event.
   * If there is an active span, the exception will be recorded on it.
   * Otherwise, a short-lived span will be created to hold the exception event.
   */
  captureException(error: Error, errorInfo?: Record<string, any>): void {
    if (!error) return

    // Prefer attaching to the active span to keep correlation intact
    try {
      const activeSpan = trace.getSpan(context.active())
      if (activeSpan) {
        this._recordException(activeSpan, error, errorInfo)
        return
      }
      // eslint-disable-next-line
    } catch (_ignored) { }

    // Fallback: create a short-lived span to hold the exception details
    try {
      const tracer = trace.getTracer('exception')
      const span = tracer.startSpan(error.name || 'Error')
      this._recordException(span, error, errorInfo)
      span.end()
      // eslint-disable-next-line
    } catch (_ignored) { }
  }

  private _recordException(span: Span, error: Error, errorInfo?: Record<string, any>): void {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    span.setAttribute('exception.type', error.name || 'Error')
    span.setAttribute('exception.message', error.message)
    span.setAttribute('exception.stacktrace', error.stack || '')
    if (errorInfo) {
      Object.entries(errorInfo).forEach(([key, value]) => {
        span.setAttribute(`error_info.${key}`, value)
      })
    }
  }

  private _getSpanSessionIdProcessor(): SpanProcessor {
    return {
      forceFlush: () => Promise.resolve(),
      onEnd: () => { },
      shutdown: () => Promise.resolve(),
      onStart: (span) => {
        if (this.sessionId?.length) {
          span.setAttribute(ATTR_MULTIPLAYER_SESSION_ID, this.sessionId)
        }
      },
    }
  }

  private _registerGlobalErrorListeners(): void {
    if (this.globalErrorListenersRegistered) return

    if (typeof window === 'undefined') return

    // eslint-disable-next-line
    const errorHandler = (event: ErrorEvent) => {
      const err = event?.error instanceof Error
        ? event.error
        : new Error(event?.message || 'Script error')
      this.captureException(err)
    }

    // eslint-disable-next-line
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = (event && 'reason' in event) ? (event as any).reason : undefined
      const err = reason instanceof Error
        ? reason
        : new Error(typeof reason === 'string' ? reason : 'Unhandled promise rejection')
      this.captureException(err)
    }

    window.addEventListener('error', errorHandler)
    window.addEventListener('unhandledrejection', rejectionHandler as any)

    this.globalErrorListenersRegistered = true
  }
}
