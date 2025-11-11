
import {
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
  ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
  ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
} from '@multiplayer-app/session-recorder-common'
import { TracerBrowserConfig } from '../types'
import { type Span } from '@opentelemetry/api'



export interface HttpPayloadData {
  requestBody?: any
  responseBody?: any
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
}

export interface ProcessedHttpPayload {
  requestBody?: string
  responseBody?: string
  requestHeaders?: string
  responseHeaders?: string
}

/**
 * Checks if the trace should be processed based on trace ID prefixes
 */
export function shouldProcessTrace(traceId: string): boolean {
  return (
    traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
    traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
  )
}

/**
 * Processes request and response body based on trace type and configuration
 */
export function processBody(
  payload: HttpPayloadData,
  config: TracerBrowserConfig,
  span: Span,
): { requestBody?: string; responseBody?: string } {
  const { captureBody, masking } = config
  const traceId = span.spanContext().traceId

  if (!captureBody) {
    return {}
  }

  let { requestBody, responseBody } = payload

  if (requestBody !== undefined && requestBody !== null) {
    requestBody = JSON.parse(JSON.stringify(requestBody))
  }
  if (responseBody !== undefined && responseBody !== null) {
    responseBody = JSON.parse(JSON.stringify(responseBody))
  }

  // Apply masking for debug traces
  if (
    traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX) ||
    traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
  ) {
    if (masking.isContentMaskingEnabled) {
      requestBody = requestBody && masking.maskBody?.(requestBody, span)
      responseBody = responseBody && masking.maskBody?.(responseBody, span)
    }
  }

  // Convert to string if needed
  if (typeof requestBody !== 'string') {
    requestBody = JSON.stringify(requestBody)
  }

  if (typeof responseBody !== 'string') {
    responseBody = JSON.stringify(responseBody)
  }

  return {
    requestBody: requestBody?.length ? requestBody : undefined,
    responseBody: responseBody?.length ? responseBody : undefined,
  }
}

/**
 * Processes request and response headers based on configuration
 */
export function processHeaders(
  payload: HttpPayloadData,
  config: TracerBrowserConfig,
  span: Span,
): { requestHeaders?: string; responseHeaders?: string } {
  const { captureHeaders, masking } = config

  if (!captureHeaders) {
    return {}
  }

  let { requestHeaders = {}, responseHeaders = {} } = payload

  // Handle header filtering
  if (
    !masking.headersToInclude?.length &&
    !masking.headersToExclude?.length
  ) {
    // Add null checks to prevent JSON.parse error when headers is undefined
    if (requestHeaders !== undefined && requestHeaders !== null) {
      requestHeaders = JSON.parse(JSON.stringify(requestHeaders))
    }
    if (responseHeaders !== undefined && responseHeaders !== null) {
      responseHeaders = JSON.parse(JSON.stringify(responseHeaders))
    }
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

  // Apply masking
  const maskedRequestHeaders = masking.maskHeaders?.(requestHeaders, span) || requestHeaders
  const maskedResponseHeaders = masking.maskHeaders?.(responseHeaders, span) || responseHeaders

  // Convert to string
  const requestHeadersStr = typeof maskedRequestHeaders === 'string'
    ? maskedRequestHeaders
    : JSON.stringify(maskedRequestHeaders)

  const responseHeadersStr = typeof maskedResponseHeaders === 'string'
    ? maskedResponseHeaders
    : JSON.stringify(maskedResponseHeaders)

  return {
    requestHeaders: requestHeadersStr?.length ? requestHeadersStr : undefined,
    responseHeaders: responseHeadersStr?.length ? responseHeadersStr : undefined,
  }
}

/**
 * Processes HTTP payload (body and headers) and sets span attributes
 */
export function processHttpPayload(
  payload: HttpPayloadData,
  config: TracerBrowserConfig,
  span: Span,
): void {
  const traceId = span.spanContext().traceId

  if (!shouldProcessTrace(traceId)) {
    return
  }

  const { requestBody, responseBody } = processBody(payload, config, span)
  const { requestHeaders, responseHeaders } = processHeaders(payload, config, span)

  // Set span attributes
  if (requestBody) {
    span.setAttribute(ATTR_MULTIPLAYER_HTTP_REQUEST_BODY, requestBody)
  }

  if (responseBody) {
    span.setAttribute(ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY, responseBody)
  }

  if (requestHeaders) {
    span.setAttribute(ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS, requestHeaders)
  }

  if (responseHeaders) {
    span.setAttribute(ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS, responseHeaders)
  }
}

/**
 * Converts Headers object to plain object
 */
export function headersToObject(headers: Headers | Record<string, string> | HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {}

  if (!headers) {
    return result
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = value
    })
  } else if (Array.isArray(headers)) {
    // Handle array of [key, value] pairs
    for (const [key, value] of headers) {
      if (typeof key === 'string' && typeof value === 'string') {
        result[key] = value
      }
    }
  } else if (typeof headers === 'object' && !Array.isArray(headers)) {
    for (const [key, value] of Object.entries(headers)) {
      if (typeof key === 'string' && typeof value === 'string') {
        result[key] = value
      }
    }
  }

  return result
}

/**
 * Extracts response body as string from Response object
 */
export async function extractResponseBody(response: Response): Promise<string | null> {
  if (!response.body) {
    return null
  }

  try {
    if (response.body instanceof ReadableStream) {
      // Check if response body is already consumed
      if (response.bodyUsed) {
        return null
      }

      const responseClone = response.clone()
      return responseClone.text()
    } else {
      return JSON.stringify(response.body)
    }
  } catch (error) {
    // If cloning fails (body already consumed), return null
    // eslint-disable-next-line no-console
    console.warn('[MULTIPLAYER_SESSION_RECORDER] Failed to extract response body:', error)
    return null
  }
}

export const getExporterEndpoint = (exporterEndpoint: string): string => {
  const hasPath = exporterEndpoint && (() => {
    try {
      const url = new URL(exporterEndpoint)
      return url.pathname !== '/' && url.pathname !== ''
    } catch {
      return false
    }
  })()

  if (hasPath) {
    return exporterEndpoint
  }

  const trimmedExporterEndpoint = new URL(exporterEndpoint).origin

  return `${trimmedExporterEndpoint}/v1/traces`
}


export const getElementTextContent = (element: HTMLElement): string => {
  return String(element.textContent || element.ariaLabel || '').trim()
}