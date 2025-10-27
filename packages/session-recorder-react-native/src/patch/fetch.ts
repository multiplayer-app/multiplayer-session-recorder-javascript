import {
  isFormData,
  isNullish,
  isObject,
  isString,
} from '../utils/type-utils'
import { formDataToQuery } from '../utils/request-utils'
import { DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE } from '../config'

let recordRequestHeaders = true
let recordResponseHeaders = true
let shouldRecordBody = true
let maxCapturingHttpPayloadSize = DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE

export const setMaxCapturingHttpPayloadSize = (
  _maxCapturingHttpPayloadSize: number
) => {
  maxCapturingHttpPayloadSize = _maxCapturingHttpPayloadSize
}

export const setShouldRecordHttpData = (
  shouldRecordBody: boolean,
  shouldRecordHeaders: boolean
) => {
  recordRequestHeaders = shouldRecordHeaders
  recordResponseHeaders = shouldRecordHeaders
  shouldRecordBody = shouldRecordBody
}

function _tryReadFetchBody({
  body,
}: {
  body: any | null | undefined
}): string | null {
  if (isNullish(body)) {
    return null
  }

  if (isString(body)) {
    return body
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

  return `[Fetch] Cannot read body of type ${Object.prototype.toString.call(body)}`
}

function _headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => {
    result[key] = value
  })
  return result
}

// Only patch fetch if available and safe to do so
if (typeof fetch !== 'undefined' && typeof global !== 'undefined') {
  // Store original fetch
  const originalFetch = global.fetch

  // Override fetch with safer implementation
  global.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const networkRequest: {
      requestHeaders?: Record<string, string>
      requestBody?: string
      responseHeaders?: Record<string, string>
      responseBody?: string
    } = {}

    try {
      // Capture request data safely
      const request = new Request(input as RequestInfo, init)

      if (recordRequestHeaders) {
        try {
          networkRequest.requestHeaders = _headersToObject(request.headers)
        } catch (error) {
          console.warn('[Fetch Patch] Failed to capture request headers:', error)
        }
      }

      if (shouldRecordBody && request.body) {
        try {
          const requestBody = _tryReadFetchBody({
            body: request.body,
          })

          if (
            requestBody?.length &&
            requestBody.length <= maxCapturingHttpPayloadSize
          ) {
            networkRequest.requestBody = requestBody
          }
        } catch (error) {
          console.warn('[Fetch Patch] Failed to capture request body:', error)
        }
      }

      // Make the actual fetch request
      const response = await originalFetch(input, init)

      // Capture response data safely
      if (recordResponseHeaders) {
        try {
          networkRequest.responseHeaders = _headersToObject(response.headers)
        } catch (error) {
          console.warn('[Fetch Patch] Failed to capture response headers:', error)
        }
      }

      if (shouldRecordBody) {
        try {
          // Try to capture response body without cloning first
          let responseBody: string | null = null

          // Check if response body is available and not consumed
          if (response.body && !response.bodyUsed) {
            try {
              // Try cloning first (might fail in React Native)
              const clonedResponse = response.clone()
              responseBody = await clonedResponse.text()
            } catch (cloneError) {
              // If cloning fails, try to read from original response
              // This is risky but we'll catch the error
              try {
                responseBody = await response.text()
                // If we get here, we consumed the body, so we need to recreate the response
                // This is a limitation - we can't both capture and preserve the body
                console.warn('[Fetch Patch] Response body consumed for capture - user code may not be able to read it')
              } catch (readError) {
                console.warn('[Fetch Patch] Failed to read response body:', readError)
                responseBody = '[Fetch] Unable to read response body'
              }
            }
          } else if (response.bodyUsed) {
            responseBody = '[Fetch] Response body already consumed'
          }

          if (
            responseBody?.length &&
            responseBody.length <= maxCapturingHttpPayloadSize
          ) {
            networkRequest.responseBody = responseBody
          }
        } catch (error) {
          console.warn('[Fetch Patch] Failed to capture response body:', error)
        }
      }

      // Attach network request data to the response for later access
      // @ts-ignore
      response.networkRequest = networkRequest

      return response
    } catch (error) {
      // Don't interfere with the original error - just log and rethrow
      console.warn('[Fetch Patch] Fetch failed:', error)
      throw error
    }
  }

  // Preserve the original fetch function's properties
  try {
    Object.setPrototypeOf(global.fetch, originalFetch)
    Object.defineProperty(global.fetch, 'name', { value: 'fetch' })
    Object.defineProperty(global.fetch, 'length', { value: originalFetch.length })
  } catch (error) {
    console.warn('[Fetch Patch] Failed to preserve fetch properties:', error)
  }
} else {
  console.info('Fetch patch: Skipping fetch patching - fetch not available or unsafe environment')
}