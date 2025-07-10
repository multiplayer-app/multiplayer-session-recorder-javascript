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
import { mask, schemify, isGzip, maskHeaders } from './helpers'

interface HttpResponseHookOptions {
  headersToMask?: string[],
  maxPayloadSize?: number,
  schemifyDocSpanPayload?: boolean,
  maskDebSpanPayload?: boolean,
  uncompressPayload?: boolean,
}

interface HttpRequestHookOptions {
  headersToMask?: string[],
  maxPayloadSize?: number,
  schemifyDocSpanPayload?: boolean,
  maskDebSpanPayload?: boolean
}

export const MultiplayerHttpInstrumentationHooksNode = {
  responseHook: (options: HttpResponseHookOptions = {}) =>
    (span: Span, response: IncomingMessage | ServerResponse) => {
      try {
        options = {
          maskDebSpanPayload: true,
          schemifyDocSpanPayload: true,
          ...options,
        }

        const _response = response as ServerResponse
        const traceId = span.spanContext().traceId

        if (_response.setHeader) {
          _response.setHeader('X-Trace-Id', traceId)
        }

        const [oldWrite, oldEnd] = [_response.write, _response.end]
        const chunks: Buffer[] = [];

        (_response.write as unknown) = function (...restArgs: any[]) {
          chunks.push(Buffer.from(restArgs[0]))
          // eslint-disable-next-line
          // @ts-ignore
          oldWrite.apply(_response, restArgs)
        }

        // eslint-disable-next-line
        // @ts-ignore
        _response.end = async function (...restArgs) {
          if (restArgs[0]) {
            chunks.push(Buffer.from(restArgs[0]))
          }

          const responseBuffer = Buffer.concat(chunks)

          if (
            responseBuffer.byteLength === 0
            || responseBuffer.byteLength > (options.maxPayloadSize || MULTIPLAYER_MAX_HTTP_REQUEST_RESPONSE_SIZE)
          ) {
            // eslint-disable-next-line
            // @ts-ignore
            return oldEnd.apply(_response, restArgs)
          }

          let responseBody: string
          let skipResponseBodyModification = false

          if (isGzip(responseBuffer)) {
            if (options.uncompressPayload) {
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
              && options.maskDebSpanPayload
            ) {
              responseBody = mask(responseBody)
            } else if (options.schemifyDocSpanPayload) {
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

          const headers = maskHeaders(
            _response.getHeaders(),
            options.headersToMask,
          )
          const stringifiedHeaders = JSON.stringify(headers)

          if (stringifiedHeaders?.length) {
            span.setAttribute(
              ATTR_MULTIPLAYER_HTTP_RESPONSE_HEADERS,
              stringifiedHeaders,
            )
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
        options = {
          maskDebSpanPayload: true,
          schemifyDocSpanPayload: true,
          ...options,
        }

        const traceId = span.spanContext().traceId
        const _request = request as IncomingMessage
        const contentType = _request?.headers?.['content-type']

        if (!contentType || !contentType?.includes('application/json')) {
          return
        }

        const headers = maskHeaders(
          _request.headers,
          options.headersToMask,
        )
        span.setAttribute(
          ATTR_MULTIPLAYER_HTTP_REQUEST_HEADERS,
          JSON.stringify(headers),
        )

        let body = ''
        _request.on('data', (chunk) => {
          body += chunk
        })
        _request.on('end', () => {
          try {
            const requestBodySizeBytes = Buffer.byteLength(body, 'utf8')

            if (
              requestBodySizeBytes === 0
              || requestBodySizeBytes > (options.maxPayloadSize || MULTIPLAYER_MAX_HTTP_REQUEST_RESPONSE_SIZE)
            ) {
              return
            }

            let requestBody = body
            if (!requestBody) return

            if (
              traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
              && options.maskDebSpanPayload
            ) {
              requestBody = mask(requestBody)
            } else if (options.schemifyDocSpanPayload) {
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

      } catch (error) {
        // eslint-disable-next-line
        console.error('An error occured in multiplayer otlp http requestHook', error)
      }
    },
}
