import { Resource } from '@opentelemetry/resources'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import * as SemanticAttributes from '@opentelemetry/semantic-conventions'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import {
  MultiplayerHelpers,
  MultiplayerIdGenerator,
  MultiplayerHttpTraceExporterBrowser,
  MultiplayerTraceIdRatioBasedSampler,
  MULTIPLAYER_TRACE_DOC_PREFIX,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
  ATTR_MULTIPLAYER_DEBUG_SESSION,
  ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
  ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
  DebugSessionType,
} from '@multiplayer-app/session-recorder-opentelemetry'
import { TracerBrowserConfig } from '../types'
import { OTEL_MP_DOC_TRACE_RATIO } from '../config'


const { schemify } = MultiplayerHelpers

export class TracerBrowserSDK {
  private tracerProvider?: WebTracerProvider
  private config?: TracerBrowserConfig
  private allowedElements = new Set<string>(['A', 'BUTTON'])
  private sessionId = ''
  private idGenerator

  constructor() { }

  private setSessionId(
    sessionId: string,
    sessionType: DebugSessionType = DebugSessionType.PLAIN,
  ) {
    this.sessionId = sessionId
    this.idGenerator.setSessionId(sessionId, sessionType)
  }

  init(options: TracerBrowserConfig): void {
    this.config = options
    const { application, version, environment } = this.config

    this.idGenerator = new MultiplayerIdGenerator({
      autoDocTracesRatio: options.docTraceRatio || OTEL_MP_DOC_TRACE_RATIO,
    })

    this.tracerProvider = new WebTracerProvider({
      resource: new Resource({
        [SemanticAttributes.SEMRESATTRS_SERVICE_NAME]: application,
        [SemanticAttributes.SEMRESATTRS_SERVICE_VERSION]: version,
        [SemanticAttributes.SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
      }),
      idGenerator: this.idGenerator,
      sampler: new MultiplayerTraceIdRatioBasedSampler(this.config.sampleTraceRatio),
      spanProcessors: [
        this._getSpanSessionIdProcessor(),
      ],
    })

    if (this.config.apiKey) {
      this.addBatchSpanExporter(this.config.apiKey)
    }

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
              /\/v1\/traces/,
              /\/v0\/radar\/debug-sessions/,
              ...(this.config.ignoreUrls || []),
            ],
            propagateTraceHeaderCorsUrls: options.propagateTraceHeaderCorsUrls,
            applyCustomAttributesOnSpan: (span, xhr) => {
              if (!this.config) return

              const { captureBody, captureHeaders, masking, schemifyDocSpanPayload } = this.config

              try {
                if (!captureBody && !captureHeaders) {
                  return
                }

                const traceId = span.spanContext().traceId

                if (
                  !traceId.startsWith(MULTIPLAYER_TRACE_DOC_PREFIX)
                  && !traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
                  && !traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
                ) {
                  return
                }

                if (captureBody) {
                  // @ts-ignore
                  let requestBody = xhr.networkRequest.requestBody
                  // @ts-ignore
                  let responseBody = xhr.networkRequest.responseBody

                  if (traceId.startsWith(MULTIPLAYER_TRACE_DOC_PREFIX)) {
                    if (schemifyDocSpanPayload) {
                      requestBody = requestBody && schemify(requestBody)
                      responseBody = responseBody && schemify(responseBody)
                    }
                  }

                  if (
                    traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
                    traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
                  ) {
                    if (masking.maskDebugSpanPayload) {
                      requestBody = requestBody && masking.maskBodyFunction?.(requestBody, span)
                      responseBody = responseBody && masking.maskBodyFunction?.(responseBody, span)
                    }
                  }

                  if (typeof requestBody !== 'string') {
                    requestBody = JSON.stringify(requestBody)
                  }

                  if (typeof responseBody !== 'string') {
                    responseBody = JSON.stringify(responseBody)
                  }


                  if (requestBody?.length) {
                    span.setAttribute(ATTR_MULTIPLAYER_HTTP_REQUEST_BODY, requestBody)
                  }

                  if (responseBody?.length) {
                    span.setAttribute(ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY, responseBody)
                  }
                }

                if (captureHeaders) {
                  // @ts-ignore
                  let requestHeaders = xhr.networkRequest.requestHeaders || {}
                  // @ts-ignore
                  let responseHeaders = xhr.networkRequest.responseHeaders || {}

                  if (
                    !masking.headersToInclude?.length
                    && !masking.headersToExclude?.length
                  ) {
                    requestHeaders = JSON.parse(JSON.stringify(requestHeaders))
                    responseHeaders = JSON.parse(JSON.stringify(responseHeaders))
                  } else {
                    if (masking.headersToInclude) {
                      const _requestHeaders = {}
                      const _responseHeaders = {}
                      for (const headerName of masking.headersToInclude) {
                        _requestHeaders[headerName] = requestHeaders[headerName]
                        _responseHeaders[headerName] = responseHeaders[headerName]
                      }
                      requestHeaders = _requestHeaders
                      responseHeaders = _responseHeaders
                    }

                    if (masking.headersToExclude?.length) {
                      for (const headerName of masking.headersToExclude) {
                        delete requestHeaders[headerName]
                        delete responseHeaders[headerName]
                      }
                    }
                  }

                  requestHeaders = masking.maskHeadersFunction?.(requestHeaders, span)
                  responseHeaders = masking.maskHeadersFunction?.(responseHeaders, span)

                  if (typeof requestHeaders !== 'string') {
                    requestHeaders = JSON.stringify(requestHeaders)
                  }

                  if (typeof responseHeaders !== 'string') {
                    responseHeaders = JSON.stringify(responseHeaders)
                  }

                  if (requestHeaders?.length) {
                    span.setAttribute(ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS, requestHeaders)
                  }

                  if (responseHeaders?.length) {
                    span.setAttribute(ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS, responseHeaders)
                  }
                }
              } catch (error) {
                // eslint-disable-next-line
                console.error('[DEBUGGER_LIB] Failed to capture xml-http payload', error)
              }
            },
          },
          '@opentelemetry/instrumentation-fetch': {
            clearTimingResources: true,
            ignoreUrls: [
              /\/v1\/traces/,
              /\/v0\/radar\/debug-sessions/,
              ...(this.config.ignoreUrls || []),
            ],
            propagateTraceHeaderCorsUrls: options.propagateTraceHeaderCorsUrls,
            applyCustomAttributesOnSpan: async (span, request, response) => {
              if (!this.config) return

              const { captureBody, captureHeaders, masking, schemifyDocSpanPayload } = this.config

              try {
                if (!captureBody && !captureHeaders) {
                  return
                }

                const traceId = span.spanContext().traceId

                if (
                  !traceId.startsWith(MULTIPLAYER_TRACE_DOC_PREFIX)
                  && !traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
                  && !traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
                ) {
                  return
                }

                if (captureBody) {
                  let requestBody = request.body
                  let responseBody: string | null = null

                  if (traceId.startsWith(MULTIPLAYER_TRACE_DOC_PREFIX)) {
                    if (schemifyDocSpanPayload) {
                      requestBody = requestBody && schemify(requestBody)
                    }
                  }

                  if (
                    traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
                    traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
                  ) {
                    if (masking.maskDebugSpanPayload) {
                      requestBody = requestBody && masking.maskBodyFunction?.(requestBody, span)
                    }
                  }


                  if (typeof requestBody !== 'string') {
                    requestBody = JSON.stringify(requestBody)
                  }

                  if (requestBody?.length) {
                    span.setAttribute(ATTR_MULTIPLAYER_HTTP_REQUEST_BODY, requestBody)
                  }

                  if (response instanceof Response && response.body) {
                    if (response.body instanceof ReadableStream) {
                      const responseClone = response.clone()
                      responseBody = await responseClone.text()
                    } else {
                      responseBody = JSON.stringify(response.body)
                    }

                    if (traceId.startsWith(MULTIPLAYER_TRACE_DOC_PREFIX)) {
                      if (schemifyDocSpanPayload && responseBody) {
                        responseBody = schemify(responseBody)
                      }
                    }

                    if (
                      traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
                      traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
                    ) {
                      if (masking.maskDebugSpanPayload) {
                        responseBody = responseBody && masking.maskBodyFunction?.(responseBody, span)
                      }
                    }

                    if (typeof responseBody !== 'string') {
                      responseBody = JSON.stringify(responseBody)
                    }

                    if (responseBody?.length) {
                      span.setAttribute(ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY, responseBody)
                    }
                  }
                }

                if (captureHeaders) {
                  let requestHeaders: Record<string, string> = {}
                  let responseHeaders: Record<string, string> = {}

                  // Convert request headers to plain object
                  if (request.headers) {
                    if (request.headers instanceof Headers) {
                      request.headers.forEach((value, key) => {
                        requestHeaders[key] = value
                      })
                    } else if (typeof request.headers === 'object' && !Array.isArray(request.headers)) {
                      for (const [key, value] of Object.entries(request.headers)) {
                        if (typeof key === 'string' && typeof value === 'string') {
                          requestHeaders[key] = value
                        }
                      }
                    }
                  }

                  // Convert response headers to plain object
                  if (response instanceof Response && response.headers) {
                    if (response.headers instanceof Headers) {
                      response.headers.forEach((value, key) => {
                        responseHeaders[key] = value
                      })
                    } else if (typeof response.headers === 'object' && !Array.isArray(response.headers)) {
                      for (const [key, value] of Object.entries(response.headers)) {
                        if (typeof key === 'string' && typeof value === 'string') {
                          responseHeaders[key] = value
                        }
                      }
                    }
                  }

                  if (
                    !masking.headersToInclude?.length
                    && !masking.headersToExclude?.length
                  ) {
                    requestHeaders = JSON.parse(JSON.stringify(requestHeaders))
                    responseHeaders = JSON.parse(JSON.stringify(responseHeaders))
                  } else {
                    if (masking.headersToInclude) {
                      const _requestHeaders: Record<string, string> = {}
                      const _responseHeaders: Record<string, string> = {}
                      for (const headerName of masking.headersToInclude) {
                        if (requestHeaders[headerName]) {
                          _requestHeaders[headerName] = requestHeaders[headerName]
                        }
                        if (responseHeaders[headerName]) {
                          _responseHeaders[headerName] = responseHeaders[headerName]
                        }
                      }
                      requestHeaders = _requestHeaders
                      responseHeaders = _responseHeaders
                    }

                    if (masking.headersToExclude?.length) {
                      for (const headerName of masking.headersToExclude) {
                        delete requestHeaders[headerName]
                        delete responseHeaders[headerName]
                      }
                    }
                  }

                  const maskedRequestHeaders = masking.maskHeadersFunction?.(requestHeaders, span) || requestHeaders
                  const maskedResponseHeaders = masking.maskHeadersFunction?.(responseHeaders, span) || responseHeaders

                  const requestHeadersStr = typeof maskedRequestHeaders === 'string'
                    ? maskedRequestHeaders
                    : JSON.stringify(maskedRequestHeaders)

                  const responseHeadersStr = typeof maskedResponseHeaders === 'string'
                    ? maskedResponseHeaders
                    : JSON.stringify(maskedResponseHeaders)

                  if (requestHeadersStr?.length) {
                    span.setAttribute(ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS, requestHeadersStr)
                  }

                  if (responseHeadersStr?.length) {
                    span.setAttribute(ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS, responseHeadersStr)
                  }
                }
              } catch (error) {
                // eslint-disable-next-line
                console.error('[DEBUGGER_LIB] Failed to capture fetch payload', error)
              }
            },
          },
          '@opentelemetry/instrumentation-user-interaction': {
            shouldPreventSpanCreation: (_event, element: HTMLElement, span) => {
              if (span['parentSpanId']) {
                return true
              }
              let textContent = ''
              if (this.allowedElements.has(element.tagName)) {
                textContent = String(
                  element.textContent || element.ariaLabel || '',
                ).trim()
              }
              span.setAttribute('target.innerText', textContent)
              return false
            },
          },
        }),
      ],
    })
  }

  start(
    sessionId,
    sessionType: DebugSessionType,
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


  addBatchSpanExporter(apiKey: string): void {
    if (!this.tracerProvider) {
      throw new Error(
        'Configuration not initialized. Call init() before start().',
      )
    }

    this.tracerProvider.addSpanProcessor(new BatchSpanProcessor(
      new MultiplayerHttpTraceExporterBrowser({
        apiKey,
        url: `${this.config?.exporterApiBaseUrl}/v1/traces`,
        usePostMessageFallback: this.config?.usePostMessageFallback,
      }),
    ))
  }

  private _getSpanSessionIdProcessor(): SpanProcessor {
    return {
      forceFlush: () => Promise.resolve(),
      onEnd: () => { },
      shutdown: () => Promise.resolve(),
      onStart: (span) => {
        if (this.sessionId?.length) {
          span.setAttribute(ATTR_MULTIPLAYER_DEBUG_SESSION, this.sessionId)
        }
      },
    }
  }
}
