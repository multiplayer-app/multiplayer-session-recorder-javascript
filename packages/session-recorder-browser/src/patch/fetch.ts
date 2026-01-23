import { isDocument, isFormData, isNullish, isObject, isString } from '../utils/type-utils'
import { formDataToQuery } from '../utils/request-utils'
import { configs } from './configs'

function _tryReadFetchBody({
  body,
  url
}: {
  // eslint-disable-next-line
  body: BodyInit | null | undefined
  url: string | URL | RequestInfo
}): string | null {
  if (isNullish(body)) {
    return null
  }

  if (isString(body)) {
    return body
  }

  if (isDocument(body)) {
    return body.textContent
  }

  if (isFormData(body)) {
    return formDataToQuery(body)
  }

  if (isObject(body)) {
    try {
      return JSON.stringify(body)
    } catch {
      return '[Fetch] Failed to stringify request object'
    }
  }

  return `[Fetch] Cannot read body of type ${toString.call(body)}`
}

/**
 * Detects if a response is a streaming response that should NOT have its body read.
 * Reading the body of streaming responses (SSE, chunked streams, etc.) will either:
 * - Block forever (SSE streams never end)
 * - Corrupt the stream for the actual consumer
 */
function _isStreamingResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

  // SSE - Server-Sent Events (infinite stream)
  if (contentType.includes('text/event-stream')) {
    return true
  }

  // Binary streams that are typically long-running
  if (contentType.includes('application/octet-stream')) {
    return true
  }

  // NDJSON streaming (newline-delimited JSON, common in streaming APIs)
  if (contentType.includes('application/x-ndjson') || contentType.includes('application/ndjson')) {
    return true
  }

  // gRPC-web streaming
  if (contentType.includes('application/grpc')) {
    return true
  }

  // Check for chunked transfer encoding (often indicates streaming)
  const transferEncoding = response.headers.get('transfer-encoding')?.toLowerCase()
  if (transferEncoding?.includes('chunked')) {
    // Chunked alone isn't definitive, but combined with no content-length = streaming
    const contentLength = response.headers.get('content-length')
    if (!contentLength) {
      return true
    }
  }

  return false
}

/**
 * Safely reads response body for non-streaming responses.
 * Returns null for streaming responses to avoid blocking/corruption.
 */
async function _tryReadResponseBody(response: Response): Promise<string | null> {
  // CRITICAL: Never attempt to read streaming response bodies
  if (_isStreamingResponse(response)) {
    return null
  }

  try {
    // Clone the response to avoid consuming the original
    const clonedResponse = response.clone()
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

    // Check content-length to avoid reading massive responses
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      const length = parseInt(contentLength, 10)
      if (!isNaN(length) && length > configs.maxCapturingHttpPayloadSize) {
        return `[Fetch] Response too large (${length} bytes)`
      }
    }

    if (contentType.includes('application/json')) {
      const json = await clonedResponse.json()
      return JSON.stringify(json)
    }

    if (contentType.includes('text/')) {
      return await clonedResponse.text()
    }

    // For unknown types, attempt text read with timeout protection
    try {
      return await clonedResponse.text()
    } catch {
      try {
        const arrayBuffer = await clonedResponse.arrayBuffer()
        return `[Fetch] Binary data (${arrayBuffer.byteLength} bytes)`
      } catch {
        return '[Fetch] Unable to read response body'
      }
    }
  } catch (error) {
    return `[Fetch] Error reading response body: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

function _headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

// Convert HeadersInit to a plain object without needing to construct a Request
function _headersInitToObject(headersInit?: HeadersInit): Record<string, string> {
  if (!headersInit) return {}

  if (headersInit instanceof Headers) {
    return _headersToObject(headersInit)
  }

  const result: Record<string, string> = {}

  if (Array.isArray(headersInit)) {
    for (const [key, value] of headersInit) {
      result[String(key).toLowerCase()] = String(value)
    }
    return result
  }

  // Record<string, string>
  for (const [key, value] of Object.entries(headersInit)) {
    result[String(key).toLowerCase()] = String(value)
  }

  return result
}

if (typeof window !== 'undefined' && typeof window.fetch !== 'undefined') {
  // Idempotency guard: avoid double-patching
  // @ts-ignore
  if ((window.fetch as any).__mp_session_recorder_patched__) {
    // Already patched; do nothing
  } else {
    // @ts-ignore
    ;(window.fetch as any).__mp_session_recorder_patched__ = true

    // Store original fetch
    const originalFetch = window.fetch

    // Override fetch
    window.fetch = async function (
      input: RequestInfo | URL,
      // eslint-disable-next-line
      init?: RequestInit
    ): Promise<Response> {
      const networkRequest: {
        requestHeaders?: Record<string, string>
        requestBody?: string
        responseHeaders?: Record<string, string>
        responseBody?: string
      } = {}

      // Capture request data
      const inputIsRequest = typeof Request !== 'undefined' && input instanceof Request

      if (configs.recordRequestHeaders) {
        if (inputIsRequest) {
          networkRequest.requestHeaders = _headersToObject((input as Request).headers)
        } else {
          networkRequest.requestHeaders = _headersInitToObject(init?.headers)
        }
      }

      if (configs.shouldRecordBody) {
        const urlStr = inputIsRequest
          ? (input as Request).url
          : typeof input === 'string' || input instanceof URL
          ? String(input)
          : ''

        // Only attempt to read the body from init (safe); avoid constructing/cloning Requests
        // If the caller passed a Request as input, we do not attempt to read its body here
        // eslint-disable-next-line
        const candidateBody: BodyInit | null | undefined = init?.body

        if (!isNullish(candidateBody)) {
          const requestBody = _tryReadFetchBody({
            body: candidateBody,
            url: urlStr
          })

          if (requestBody?.length && new Blob([requestBody]).size <= configs.maxCapturingHttpPayloadSize) {
            networkRequest.requestBody = requestBody
          }
        }
      }

      try {
        // Make the actual fetch request
        const response = await originalFetch(input, init)

        // Capture response data
        if (configs.recordResponseHeaders) {
          networkRequest.responseHeaders = _headersToObject(response.headers)
        }

        if (configs.shouldRecordBody) {
          const responseBody = await _tryReadResponseBody(response)

          if (responseBody?.length && new Blob([responseBody]).size <= configs.maxCapturingHttpPayloadSize) {
            networkRequest.responseBody = responseBody
          }
        }

        // Attach network request data to the response for later access
        // @ts-ignore
        response.networkRequest = networkRequest

        return response
      } catch (error) {
        // Even if the fetch fails, we can still capture the request data
        // Attach captured request data to the thrown error for downstream handling
        // @ts-ignore
        if (error && typeof error === 'object') {
          // @ts-ignore
          error.networkRequest = networkRequest
        }
        throw error
      }
    }

    // Preserve the original fetch function's properties
    Object.setPrototypeOf(window.fetch, originalFetch)
    Object.defineProperty(window.fetch, 'name', { value: 'fetch' })
    Object.defineProperty(window.fetch, 'length', { value: originalFetch.length })
  }
}
