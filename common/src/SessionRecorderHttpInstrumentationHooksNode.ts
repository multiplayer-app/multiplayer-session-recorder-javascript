import type {
  IncomingMessage,
  ServerResponse,
  ClientRequest,
} from 'http'
import * as zlib from 'zlib'
import type { Span } from '@opentelemetry/api'
import {
  ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
  ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
  MULTIPLAYER_MAX_HTTP_REQUEST_RESPONSE_SIZE,
  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY_ENCODING,
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
} from './constants.node'
import {
  mask,
  schemify,
  isGzip,
} from './sdk'
import {
  sensitiveFields,
  sensitiveHeaders
} from './sdk/mask'

interface HttpResponseHookOptions {
  maxPayloadSizeBytes?: number
  schemifyDocSpanPayload?: boolean
  uncompressPayload?: boolean

  captureHeaders?: boolean
  captureBody?: boolean

  isMaskingEnabled?: boolean

  maskBody?: (arg: any, span: Span) => any
  maskHeaders?: (arg: any, span: Span) => any

  maskBodyFieldsList?: string[]
  maskHeadersList?: string[]

  headersToInclude?: string[]
  headersToExclude?: string[]
}

interface HttpRequestHookOptions {
  maxPayloadSizeBytes?: number
  schemifyDocSpanPayload?: boolean

  captureHeaders?: boolean
  captureBody?: boolean

  isMaskingEnabled?: boolean

  maskBody?: (arg: any, span: Span) => any
  maskHeaders?: (arg: any, span: Span) => any

  maskBodyFieldsList?: string[]
  maskHeadersList?: string[]

  headersToInclude?: string[]
  headersToExclude?: string[]
}

const setDefaultOptions = (
  options: HttpResponseHookOptions | HttpResponseHookOptions
): Omit<HttpResponseHookOptions & HttpResponseHookOptions, 'maskBody' | 'maskHeaders'>
  & {
    maskBody: (arg: any, span: Span) => any
    maskHeaders: (arg: any, span: Span) => any
    captureHeaders: boolean,
    captureBody: boolean,
    isMaskingEnabled: boolean,
    schemifyDocSpanPayload: boolean,
    uncompressPayload: boolean,
    maxPayloadSizeBytes: number
  } => {
  options.captureHeaders = 'captureHeaders' in options
    ? options.captureHeaders
    : true
  options.captureBody = 'captureBody' in options
    ? options.captureBody
    : true
  options.isMaskingEnabled = 'isMaskingEnabled' in options
    ? options.isMaskingEnabled
    : true
  options.schemifyDocSpanPayload = 'schemifyDocSpanPayload' in options
    ? options.schemifyDocSpanPayload
    : false
  options.uncompressPayload = 'uncompressPayload' in options
    ? options.uncompressPayload
    : true
  options.maskBody = options.maskBody || mask([
    ...(
      Array.isArray(options.maskBodyFieldsList)
        ? options.maskBodyFieldsList
        : sensitiveFields
    ),
    ...(
      Array.isArray(options.maskHeadersList)
        ? options.maskHeadersList
        : sensitiveHeaders
    ),
  ])
  options.maskHeaders = options.maskHeaders || mask([
    ...(
      Array.isArray(options.maskBodyFieldsList)
        ? options.maskBodyFieldsList
        : sensitiveFields
    ),
    ...(
      Array.isArray(options.maskHeadersList)
        ? options.maskHeadersList
        : sensitiveHeaders
    ),
  ])
  options.maxPayloadSizeBytes = options.maxPayloadSizeBytes || MULTIPLAYER_MAX_HTTP_REQUEST_RESPONSE_SIZE

  return options as Omit<HttpResponseHookOptions & HttpResponseHookOptions, 'maskBody' | 'maskHeaders'>
    & {
      maskBody: (arg: any, span: Span) => any
      maskHeaders: (arg: any, span: Span) => any
      captureHeaders: boolean,
      captureBody: boolean,
      isMaskingEnabled: boolean,
      schemifyDocSpanPayload: boolean,
      uncompressPayload: boolean,
      maxPayloadSizeBytes: number
    }
}

export const SessionRecorderHttpInstrumentationHooksNode = {
  responseHook: (options: HttpResponseHookOptions = {}) =>
    (span: Span, response: IncomingMessage | ServerResponse) => {
      try {
        const _options = setDefaultOptions(options)

        if (!_options.captureBody && !_options.captureHeaders) {
          return
        }

        const _response = response as ServerResponse
        const traceId = span.spanContext().traceId

        if (_response.setHeader) {
          _response.setHeader('X-Trace-Id', traceId)
        }

        const [oldWrite, oldEnd] = [_response.write, _response.end]

        const chunks: Buffer[] = [];

        if (_options.captureBody) {
          (_response.write as unknown) = function (...restArgs: any[]) {
            chunks.push(Buffer.from(restArgs[0]))
            // eslint-disable-next-line
            // @ts-ignore
            oldWrite.apply(_response, restArgs)
          }
        }

        // eslint-disable-next-line
        // @ts-ignore
        _response.end = async function (...restArgs) {
          if (_options.captureBody && restArgs[0]) {
            chunks.push(Buffer.from(restArgs[0]))
          }

          const responseBuffer = Buffer.concat(chunks)

          if (
            _options.captureBody
            && responseBuffer.byteLength > 0
            && responseBuffer.byteLength < _options.maxPayloadSizeBytes
          ) {
            let responseBody: string
            let skipResponseBodyModification = false

            if (isGzip(responseBuffer)) {
              if (_options.uncompressPayload) {
                const dezippedBuffer = await new Promise((resolve) => zlib
                  .gunzip(responseBuffer, function (err, dezipped) {
                    if (err) {
                      return resolve(Buffer.from(''))
                    } else {
                      return resolve(dezipped)
                    }
                  })) as Buffer
                responseBody = dezippedBuffer.toString('utf-8')
              } else {
                span.setAttribute(
                  ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY_ENCODING,
                  'gzip',
                )

                skipResponseBodyModification = true
                responseBody = responseBuffer.toString('hex')
              }
            } else {
              responseBody = responseBuffer.toString('utf-8')
            }

            if (!skipResponseBodyModification) {
              if (
                traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
                && _options.isMaskingEnabled
              ) {
                responseBody = _options.maskBody(responseBody, span)
              } else if (_options.schemifyDocSpanPayload) {
                responseBody = schemify(responseBody)
              } else if (typeof responseBody !== 'string') {
                responseBody = JSON.stringify(responseBody)
              }
            }

            if (responseBody.length) {
              span.setAttribute(
                ATTR_MULTIPLAYER_HTTP_RESPONSE_BODY,
                responseBody,
              )
            }
          }

          if (_options.captureHeaders) {
            const headers = _options.maskHeaders(_response.getHeaders(), span)

            let _headers: any = {}

            if (
              !_options.headersToInclude?.length
              && !_options.headersToExclude?.length
            ) {
              _headers = JSON.parse(JSON.stringify(headers))
            } else {
              if (_options.headersToInclude) {
                for (const headerName of _options.headersToInclude) {
                  _headers[headerName] = headers[headerName]
                }
              }

              if (_options.headersToExclude?.length) {
                for (const headerName of _options.headersToExclude) {
                  delete _headers[headerName]
                }
              }
            }

            const stringifiedHeaders = JSON.stringify(_headers)

            if (stringifiedHeaders?.length) {
              span.setAttribute(
                ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
                stringifiedHeaders,
              )
            }
          }

          // eslint-disable-next-line
          // @ts-ignore
          return oldEnd.apply(_response, restArgs)
        }
      } catch (error) {
        // eslint-disable-next-line
        console.error('An error occured in multiplayer otlp http responseHook', error)
      }
    },
  requestHook: (options: HttpRequestHookOptions = {}) =>
    (span: Span, request: ClientRequest | IncomingMessage) => {
      try {
        const _options = setDefaultOptions(options)

        if (!_options.captureBody && !_options.captureHeaders) {
          return
        }

        const traceId = span.spanContext().traceId
        const _request = request as IncomingMessage

        if (_options.captureHeaders) {
          let _headers: any = {}

          if (
            !_options.headersToInclude?.length
            && !_options.headersToExclude?.length
          ) {
            _headers = JSON.parse(JSON.stringify(_request.headers))
          } else {
            if (_options.headersToInclude) {
              for (const headerName of _options.headersToInclude) {
                _headers[headerName] = _request.headers
              }
            }

            if (_options.headersToExclude?.length) {
              for (const headerName of _options.headersToExclude) {
                delete _headers[headerName]
              }
            }
          }

          const headers = _options.maskHeaders(_headers, span)

          span.setAttribute(
            ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
            JSON.stringify(headers),
          )
        }

        const contentType = _request?.headers?.['content-type']
        if (
          _options.captureBody
          && contentType?.includes('application/json')
        ) {
          let body = ''
          _request.on('data', (chunk) => {
            body += chunk
          })
          _request.on('end', () => {
            try {
              const requestBodySizeBytes = Buffer.byteLength(body, 'utf8')

              if (
                requestBodySizeBytes === 0
                || requestBodySizeBytes > _options.maxPayloadSizeBytes
              ) {
                return
              }

              let requestBody = body
              if (!requestBody) return

              if (
                traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
                && _options.isMaskingEnabled
              ) {
                requestBody = _options.maskBody(requestBody, span)
              } else if (_options.schemifyDocSpanPayload) {
                requestBody = schemify(requestBody)
              } else if (typeof requestBody !== 'string') {
                requestBody = JSON.stringify(requestBody)
              }

              if (requestBody?.length) {
                span.setAttribute(
                  ATTR_MULTIPLAYER_HTTP_REQUEST_BODY,
                  requestBody,
                )
              }
            } catch (err) {
              // eslint-disable-next-line
              console.error('[MULTIPLAYER-HTTP-REQ-HOOK] An error occured in multiplayer otlp http requestHook', err)
            }
          })
        }

      } catch (error) {
        // eslint-disable-next-line
        console.error('An error occured in multiplayer otlp http requestHook', error)
      }
    },
}
