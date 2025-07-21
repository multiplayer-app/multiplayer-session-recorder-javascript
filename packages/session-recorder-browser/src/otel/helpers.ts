import { sensitiveFields, sensitiveHeaders, mask } from '@multiplayer-app/session-recorder-opentelemetry/dist/src/helpers'
import { TracerBrowserMasking } from '../types'

export function setDefaultMaskingOptions(options: TracerBrowserMasking = {}): Required<TracerBrowserMasking> {
  const bodyFields = Array.isArray(options.maskBodyFieldsList) ? options.maskBodyFieldsList : sensitiveFields
  const headersFields = Array.isArray(options.maskHeadersList) ? options.maskHeadersList : sensitiveHeaders

  return {
    ...options,
    maskBodyFieldsList: bodyFields,
    maskHeadersList: headersFields,
    captureBody: 'captureBody' in options ? Boolean(options.captureBody) : true,
    captureHeaders: 'captureHeaders' in options ? Boolean(options.captureHeaders) : true,
    headersToInclude: Array.isArray(options.headersToInclude) ? options.headersToInclude : [],
    headersToExclude: Array.isArray(options.headersToExclude) ? options.headersToExclude : [],
    maskDebugSpanPayload: options.maskDebugSpanPayload !== undefined ? options.maskDebugSpanPayload : false,
    maskBodyFunction: typeof options.maskBodyFunction === 'function' ? options.maskBodyFunction : mask(bodyFields),
    maskHeadersFunction: typeof options.maskHeadersFunction === 'function' ? options.maskHeadersFunction : mask(headersFields),

  }
}
