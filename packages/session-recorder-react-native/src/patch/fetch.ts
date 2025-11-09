import {
  isFormData,
  isNullish,
  isObject,
  isString,
} from '../utils/type-utils'
import { formDataToQuery } from '../utils/request-utils'
import { configs } from './configs'

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

async function _tryReadResponseBody(response: Response): Promise<string | null> {
  try {
    // Clone the response to avoid consuming the original stream.
    const clonedResponse = response.clone()

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const json = await clonedResponse.json()
      return JSON.stringify(json)
    } else if (contentType.includes('text/')) {
      return await clonedResponse.text()
    } else {
      // For other content types, try text first, fallback to arrayBuffer
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
function _headersInitToObject(headersInit?: any): Record<string, string> {
  if (!headersInit) return {}

  // Headers instance
  if (typeof Headers !== 'undefined' && headersInit instanceof Headers) {
    return _headersToObject(headersInit)
  }

  const result: Record<string, string> = {}

  // Array of tuples
  if (Array.isArray(headersInit)) {
    for (const [key, value] of headersInit) {
      result[String(key).toLowerCase()] = String(value)
    }
    return result
  }

  // Record<string, string>
  for (const [key, value] of Object.entries(headersInit as Record<string, string>)) {
    result[String(key).toLowerCase()] = String(value)
  }

  return result
}

// Only patch fetch if available and safe to do so
if (typeof fetch !== 'undefined' && typeof global !== 'undefined') {
  // Store original fetch
  const originalFetch = global.fetch

  // Override fetch with safer implementation
  global.fetch = async function (
    input: any,
    init?: any
  ): Promise<Response> {
    const networkRequest: {
      requestHeaders?: Record<string, string>
      requestBody?: string
      responseHeaders?: Record<string, string>
      responseBody?: string
    } = {}

    // Capture request data
    const inputIsRequest = typeof Request !== 'undefined' && input instanceof Request
    const safeToConstructRequest = !inputIsRequest || !(input as Request).bodyUsed

    // Only construct a new Request when it's safe (i.e., body not already used)
    let requestForMetadata: Request | null = null
    if (safeToConstructRequest) {
      try {
        requestForMetadata = new Request(input as RequestInfo, init)
      } catch {
        requestForMetadata = null
      }
    }

    if (configs.recordRequestHeaders) {
      if (requestForMetadata) {
        networkRequest.requestHeaders = _headersToObject(requestForMetadata.headers)
      } else if (inputIsRequest) {
        networkRequest.requestHeaders = _headersToObject((input as Request).headers)
      } else {
        networkRequest.requestHeaders = _headersInitToObject(init?.headers)
      }
    }

    if (configs.shouldRecordBody) {
      const candidateBody: any | null | undefined = requestForMetadata
        ? (requestForMetadata as any).body as any
        : (inputIsRequest ? (init as any)?.body : (init as any)?.body)

      if (!isNullish(candidateBody)) {
        const requestBody = _tryReadFetchBody({
          body: candidateBody,
        })

        if (
          requestBody?.length &&
          (typeof Blob !== 'undefined'
            ? new Blob([requestBody]).size <= configs.maxCapturingHttpPayloadSize
            : requestBody.length <= configs.maxCapturingHttpPayloadSize)
        ) {
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

        if (
          responseBody?.length &&
          (typeof Blob !== 'undefined'
            ? new Blob([responseBody]).size <= configs.maxCapturingHttpPayloadSize
            : responseBody.length <= configs.maxCapturingHttpPayloadSize)
        ) {
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