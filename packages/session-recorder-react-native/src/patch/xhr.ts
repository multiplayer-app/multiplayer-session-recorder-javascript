import { Platform } from 'react-native'
import {

  isFormData,
  isNullish,
  isObject,
  isString,
} from '../utils/type-utils'
import { formDataToQuery } from '../utils/request-utils'
import { DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE } from '../config'

// Check if we're on web platform
const isWeb = Platform.OS === 'web'

let recordRequestHeaders = true
let recordResponseHeaders = true
let shouldRecordBody = true
let maxCapturingHttpPayloadSize = DEFAULT_MAX_HTTP_CAPTURING_PAYLOAD_SIZE

export const setMaxCapturingHttpPayloadSize = (_maxCapturingHttpPayloadSize: number) => {
  maxCapturingHttpPayloadSize = _maxCapturingHttpPayloadSize
}

export const setShouldRecordHttpData = (shouldRecordBody: boolean, shouldRecordHeaders: boolean) => {
  recordRequestHeaders = shouldRecordHeaders
  recordResponseHeaders = shouldRecordHeaders
  shouldRecordBody = shouldRecordBody
}

function _tryReadXHRBody({
  body,
}: {
  body: any | null | undefined
  url: string | URL | RequestInfo
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
      return JSON.stringify({ ...body })
    } catch {
      return '[XHR] Failed to stringify response object'
    }
  }

  return `[XHR] Cannot read body of type ${Object.prototype.toString.call(body)}`
}

// Only patch XMLHttpRequest if not on web platform or if XMLHttpRequest is available
if (!isWeb && typeof XMLHttpRequest !== 'undefined') {
  (function (xhr) {
    const originalOpen = XMLHttpRequest.prototype.open

    xhr.open = function (
      method: string,
      url: string | URL,
      async = true,
      username?: string | null,
      password?: string | null,
    ) {
      const xhr = this as XMLHttpRequest
      const networkRequest: {
        requestHeaders?: any,
        requestBody?: any,
        responseHeaders?: any,
        responseBody?: any,
      } = {}


      // @ts-ignore
      const requestHeaders: Record<string, string> = {}
      const originalSetRequestHeader = xhr.setRequestHeader.bind(xhr)
      xhr.setRequestHeader = (header: string, value: string) => {
        requestHeaders[header] = value
        return originalSetRequestHeader(header, value)
      }
      if (recordRequestHeaders) {
        networkRequest.requestHeaders = requestHeaders
      }

      const originalSend = xhr.send.bind(xhr)
      xhr.send = (body) => {
        if (shouldRecordBody) {
          const requestBody = _tryReadXHRBody({ body, url })

          if (
            requestBody?.length
            && requestBody.length <= maxCapturingHttpPayloadSize
          ) {
            networkRequest.requestBody = requestBody
          }
        }
        return originalSend(body)
      }

      xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState !== xhr.DONE) {
          return
        }

        // @ts-ignore
        const responseHeaders: Record<string, string> = {}
        const rawHeaders = xhr.getAllResponseHeaders() || ''
        const headers = rawHeaders.trim().split(/[\r\n]+/).filter(Boolean)

        headers.forEach((line) => {
          const parts = line.split(': ')
          const header = parts.shift()
          const value = parts.join(': ')
          if (header) {
            responseHeaders[header] = value
          }
        })
        if (recordResponseHeaders) {
          networkRequest.responseHeaders = responseHeaders
        }
        if (shouldRecordBody) {
          const responseBody = _tryReadXHRBody({ body: xhr.response, url })

          if (
            responseBody?.length
            && responseBody.length <= maxCapturingHttpPayloadSize
          ) {
            networkRequest.responseBody = responseBody
          }
        }
      })


      // @ts-ignore
      xhr.networkRequest = networkRequest

      originalOpen.call(xhr, method, url as string, async, username, password)
    }
  })(XMLHttpRequest.prototype)
} else if (isWeb) {
  console.info('XHR patch: Skipping XMLHttpRequest patching on web platform')
}
