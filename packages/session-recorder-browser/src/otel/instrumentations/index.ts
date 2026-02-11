import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'

import {
  headersToObject,
  processHttpPayload,
  extractResponseBody,
  getElementInnerText,
  getElementTextContent
} from '../helpers'
import { OTEL_IGNORE_URLS } from '../../config'
import { TracerBrowserConfig } from '../../types'

export const getInstrumentations = (config: TracerBrowserConfig) => {
  return [
    getWebAutoInstrumentations({
      '@opentelemetry/instrumentation-xml-http-request': {
        clearTimingResources: true,
        ignoreUrls: [...OTEL_IGNORE_URLS, ...(config.ignoreUrls || [])],
        propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls,
        applyCustomAttributesOnSpan: (span, xhr) => {
          if (!config) return

          const { captureBody, captureHeaders } = config

          try {
            if (!captureBody && !captureHeaders) {
              return
            }
            // @ts-ignore
            const networkRequest = xhr.networkRequest

            const requestBody = networkRequest.requestBody
            const responseBody = networkRequest.responseBody
            const requestHeaders = networkRequest.requestHeaders || {}
            const responseHeaders = networkRequest.responseHeaders || {}

            const payload = {
              requestBody,
              responseBody,
              requestHeaders,
              responseHeaders
            }
            processHttpPayload(payload, config, span)
          } catch (error) {
            // eslint-disable-next-line
            console.error('[MULTIPLAYER_SESSION_RECORDER] Failed to capture xml-http payload', error)
          }
        }
      },
      '@opentelemetry/instrumentation-fetch': {
        clearTimingResources: true,
        ignoreUrls: [...OTEL_IGNORE_URLS, ...(config.ignoreUrls || [])],
        propagateTraceHeaderCorsUrls: config.propagateTraceHeaderCorsUrls,
        applyCustomAttributesOnSpan: async (span, request, response) => {
          if (!config) return

          const { captureBody, captureHeaders } = config

          try {
            if (!captureBody && !captureHeaders) {
              return
            }

            // Try to get data from our fetch wrapper first
            // @ts-ignore
            const networkRequest = response?.networkRequest

            let requestBody: any = null
            let responseBody: string | null = null
            let requestHeaders: Record<string, string> = {}
            let responseHeaders: Record<string, string> = {}

            if (networkRequest) {
              // Use data captured by our fetch wrapper
              requestBody = networkRequest.requestBody
              responseBody = networkRequest.responseBody
              requestHeaders = networkRequest.requestHeaders || {}
              responseHeaders = networkRequest.responseHeaders || {}
            } else {
              // Fallback to original OpenTelemetry approach
              requestBody = request.body
              requestHeaders = headersToObject(request.headers)
              responseHeaders = headersToObject(response instanceof Response ? response.headers : undefined)

              if (response instanceof Response && response.body) {
                responseBody = await extractResponseBody(response)
              }
            }

            const payload = {
              requestBody,
              responseBody,
              requestHeaders,
              responseHeaders
            }
            processHttpPayload(payload, config, span)
          } catch (error) {
            // eslint-disable-next-line
            console.error('[MULTIPLAYER_SESSION_RECORDER] Failed to capture fetch payload', error)
          }
        }
      },
      '@opentelemetry/instrumentation-user-interaction': {
        shouldPreventSpanCreation: (_event, element: HTMLElement, span) => {
          if (span['parentSpanContext']) {
            return true
          }
          span.setAttribute('target.innerText', getElementInnerText(element))
          span.setAttribute('target.textContent', getElementTextContent(element))
          Array.from(element.attributes).forEach((attribute) => {
            span.setAttribute(`target.attribute.${attribute.name}`, attribute.value)
          })

          return false
        }
      }
    })
  ]
}
