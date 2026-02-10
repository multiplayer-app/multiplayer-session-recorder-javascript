import { resourceFromAttributes } from '@opentelemetry/resources'
import { ExportResult, W3CTraceContextPropagator } from '@opentelemetry/core'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor, ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import * as SemanticAttributes from '@opentelemetry/semantic-conventions'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import {
  SessionType,
  SessionRecorderSdk,
  SessionRecorderIdGenerator,
  SessionRecorderBrowserTraceExporter,
  SessionRecorderTraceIdRatioBasedSampler,
  ATTR_MULTIPLAYER_SESSION_ID,
  MULTIPLAYER_TRACE_CLIENT_ID_LENGTH,
} from '@multiplayer-app/session-recorder-common'
import { TracerBrowserConfig } from '../types'
import { OTEL_IGNORE_URLS } from '../config'
import type { CrashBuffer } from '@multiplayer-app/session-recorder-common'
import {
  processHttpPayload,
  headersToObject,
  extractResponseBody,
  getExporterEndpoint,
  getElementTextContent,
  getElementInnerText,
} from './helpers'
import { CrashBufferSpanProcessor } from './CrashBufferSpanProcessor'

const clientIdGenerator = SessionRecorderSdk.getIdGenerator(MULTIPLAYER_TRACE_CLIENT_ID_LENGTH)
export class TracerBrowserSDK {
  clientId = ''
  private tracerProvider?: WebTracerProvider
  private config?: TracerBrowserConfig
  private sessionId = ''
  private idGenerator?: SessionRecorderIdGenerator
  private exporter?: SessionRecorderBrowserTraceExporter
  private globalErrorListenersRegistered = false
  private crashBuffer?: CrashBuffer
  private batchSpanProcessor?: BatchSpanProcessor

  constructor() {}

  private _setSessionId(sessionId: string, sessionType: SessionType = SessionType.MANUAL) {
    this.sessionId = sessionId

    if (!this.idGenerator) {
      throw new Error('Id generator not initialized')
    }

    this.idGenerator.setSessionId(sessionId, sessionType, this.clientId)
  }

  init(options: TracerBrowserConfig): void {
    this.config = options
    this.clientId = clientIdGenerator()

    const { application, version, environment } = this.config

    this.idGenerator = new SessionRecorderIdGenerator()

    this._setSessionId('', SessionType.SESSION_CACHE)

    this.exporter = new SessionRecorderBrowserTraceExporter({
      apiKey: options.apiKey,
      url: getExporterEndpoint(options.exporterEndpoint),
      usePostMessageFallback: options.usePostMessageFallback,
    })

    const resourceAttributes = resourceFromAttributes({
      [SemanticAttributes.SEMRESATTRS_SERVICE_NAME]: application,
      [SemanticAttributes.SEMRESATTRS_SERVICE_VERSION]: version,
      [SemanticAttributes.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
    })

    SessionRecorderSdk.setResourceAttributes(resourceAttributes.attributes)

    this.tracerProvider = new WebTracerProvider({
      resource: resourceAttributes,
      idGenerator: this.idGenerator,
      sampler: new SessionRecorderTraceIdRatioBasedSampler(this.config.sampleTraceRatio),
      spanProcessors: [
        this._getSpanSessionIdProcessor(),
        new BatchSpanProcessor(this.exporter),
        new CrashBufferSpanProcessor(this.crashBuffer, this.exporter.serializeSpan),
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
            ignoreUrls: [...OTEL_IGNORE_URLS, ...(this.config.ignoreUrls || [])],
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
            ignoreUrls: [...OTEL_IGNORE_URLS, ...(this.config.ignoreUrls || [])],
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
              Array.from(element.attributes).forEach((attribute) => {
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

  setCrashBuffer(crashBuffer: CrashBuffer | undefined): void {
    this.crashBuffer = crashBuffer
  }

  start(sessionId, sessionType: SessionType): void {
    if (!this.tracerProvider) {
      throw new Error('Configuration not initialized. Call init() before start().')
    }

    this._setSessionId(sessionId, sessionType)
  }

  stop(): void {
    if (!this.tracerProvider) {
      throw new Error('Configuration not initialized. Call init() before start().')
    }

    this._setSessionId('', SessionType.SESSION_CACHE)
  }

  setApiKey(apiKey: string): void {
    if (!this.exporter) {
      throw new Error('Configuration not initialized. Call init() before setApiKey().')
    }

    this.exporter.setApiKey(apiKey)
  }

  private static _toReadableSpanLike(span: any): ReadableSpan {
    if (span && typeof span.spanContext === 'function' && span.instrumentationScope) {
      return span as ReadableSpan
    }

    const spanContext = typeof span?.spanContext === 'function' ? span.spanContext() : span?._spanContext
    const normalizedCtx =
      spanContext ||
      ({
        traceId: span?.traceId,
        spanId: span?.spanId,
        traceFlags: span?.traceFlags,
        traceState: span?.traceState,
      } as any)

    const instrumentationScope =
      span?.instrumentationScope ||
      span?.instrumentationLibrary ||
      ({ name: 'multiplayer-buffer', version: undefined, schemaUrl: undefined } as any)

    const normalizedScope = {
      name: instrumentationScope?.name || 'multiplayer-buffer',
      version: instrumentationScope?.version,
      schemaUrl: instrumentationScope?.schemaUrl,
    }

    const resource = span?.resource || { attributes: {}, asyncAttributesPending: false }
    const parentSpanId = span?.parentSpanId

    return {
      name: span?.name || '',
      kind: span?.kind,
      spanContext: () => normalizedCtx,
      parentSpanContext: parentSpanId
        ? ({
          traceId: normalizedCtx?.traceId,
          spanId: parentSpanId,
          traceFlags: normalizedCtx?.traceFlags,
          traceState: normalizedCtx?.traceState,
        } as any)
        : undefined,
      startTime: span?.startTime,
      endTime: span?.endTime ?? span?.startTime,
      duration: span?.duration,
      status: span?.status,
      attributes: span?.attributes || {},
      links: span?.links || [],
      events: span?.events || [],
      ended: typeof span?.ended === 'boolean' ? span.ended : true,
      droppedAttributesCount: span?.droppedAttributesCount || 0,
      droppedEventsCount: span?.droppedEventsCount || 0,
      droppedLinksCount: span?.droppedLinksCount || 0,
      resource,
      instrumentationScope: normalizedScope as any,
    } as any
  }

  async exportTraces(spans: ReadableSpan[]): Promise<ExportResult | undefined | void> {
    if (!this.exporter) {
      throw new Error('Trace exporter not initialized')
    }
    if (!spans || spans.length === 0) {
      return Promise.resolve()
    }

    const readableSpans = spans.map((s: any) => TracerBrowserSDK._toReadableSpanLike(s))

    return new Promise((resolve) => {
      this.exporter?.exportBuffer(readableSpans, (result) => {
        resolve(result)
      })
    })
  }
  /**
   * Capture an exception as an error span/event.
   * If there is an active span, the exception will be recorded on it.
   * Otherwise, a short-lived span will be created to hold the exception event.
   */
  captureException(error: Error, errorInfo?: Record<string, any>): void {
    SessionRecorderSdk.captureException(error, errorInfo)
  }

  private _getSpanSessionIdProcessor(): SpanProcessor {
    return {
      forceFlush: () => Promise.resolve(),
      onEnd: () => Promise.resolve(),
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
      const err = event?.error instanceof Error ? event.error : new Error(event?.message || 'Script error')
      this.captureException(err)
    }

    // eslint-disable-next-line
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event && 'reason' in event ? (event as any).reason : undefined
      const err =
        reason instanceof Error
          ? reason
          : new Error(typeof reason === 'string' ? reason : 'Unhandled promise rejection')
      this.captureException(err)
    }

    window.addEventListener('error', errorHandler)
    window.addEventListener('unhandledrejection', rejectionHandler as any)

    this.globalErrorListenersRegistered = true
  }
}
