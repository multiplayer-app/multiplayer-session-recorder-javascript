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

function _tryReadXHRBody({
  body,
  url,
}: {
  body: Document | XMLHttpRequestBodyInit | any | null | undefined
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
      return '[XHR] Failed to stringify response object'
    }
  }

  return `[XHR] Cannot read body of type ${toString.call(body)}`
}

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
    const requestHeaders: Headers = {}
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
          && new Blob([requestBody]).size <= maxCapturingHttpPayloadSize
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
      const responseHeaders: Headers = {}
      const rawHeaders = xhr.getAllResponseHeaders()
      const headers = rawHeaders.trim().split(/[\r\n]+/)
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
          && new Blob([responseBody]).size <= maxCapturingHttpPayloadSize
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
