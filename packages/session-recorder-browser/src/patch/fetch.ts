import {
  isDocument,
  isFormData,
  isNullish,
  isObject,
  isString,
} from '../utils/type-utils'
import { formDataToQuery } from '../utils/request-utils'
import { DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE } from '../config'

let recordRequestHeaders = true
let recordResponseHeaders = true
const shouldRecordBody = true
let maxCapturingHttpPayloadSize = DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE

export const setMaxCapturingHttpPayloadSize = (_maxCapturingHttpPayloadSize: number) => {
  maxCapturingHttpPayloadSize = _maxCapturingHttpPayloadSize
}

export const setShouldRecordHttpData = (shouldRecordBody: boolean, shouldRecordHeaders: boolean) => {
  recordRequestHeaders = shouldRecordHeaders
  recordResponseHeaders = shouldRecordHeaders
  // eslint-disable-next-line
  shouldRecordBody = shouldRecordBody
}

function _tryReadFetchBody({
  body,
  url,
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

async function _tryReadResponseBody(response: Response): Promise<string | null> {
  try {
    // Clone the response to avoid consuming the original stream
    const clonedResponse = response.clone()

    // Try different methods to read the body
    if (response.headers.get('content-type')?.includes('application/json')) {
      const json = await clonedResponse.json()
      return JSON.stringify(json)
    } else if (response.headers.get('content-type')?.includes('text/')) {
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

// Store original fetch
const originalFetch = window.fetch

// Override fetch
window.fetch = async function (
  input: RequestInfo | URL,
  // eslint-disable-next-line
  init?: RequestInit,
): Promise<Response> {
  const networkRequest: {
    requestHeaders?: Record<string, string>,
    requestBody?: string,
    responseHeaders?: Record<string, string>,
    responseBody?: string,
  } = {}

  // Capture request data
  const request = new Request(input, init)

  if (recordRequestHeaders) {
    networkRequest.requestHeaders = _headersToObject(request.headers)
  }

  if (shouldRecordBody && request.body) {
    const requestBody = _tryReadFetchBody({
      body: request.body,
      url: request.url,
    })

    if (
      requestBody?.length &&
      new Blob([requestBody]).size <= maxCapturingHttpPayloadSize
    ) {
      networkRequest.requestBody = requestBody
    }
  }

  try {
    // Make the actual fetch request
    const response = await originalFetch(input, init)

    // Capture response data
    if (recordResponseHeaders) {
      networkRequest.responseHeaders = _headersToObject(response.headers)
    }

    if (shouldRecordBody) {
      const responseBody = await _tryReadResponseBody(response)

      if (
        responseBody?.length &&
        new Blob([responseBody]).size <= maxCapturingHttpPayloadSize
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
    // @ts-ignore
    const errorResponse = new Response(null, { status: 0, statusText: 'Network Error' })
    // @ts-ignore
    errorResponse.networkRequest = networkRequest
    throw error
  }
}

// Preserve the original fetch function's properties
Object.setPrototypeOf(window.fetch, originalFetch)
Object.defineProperty(window.fetch, 'name', { value: 'fetch' })
Object.defineProperty(window.fetch, 'length', { value: originalFetch.length })
