import { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import {
  IExportTraceServiceResponse,
  createExportTraceServiceRequest,
  ISerializer,
} from '@opentelemetry/otlp-transformer'
import {
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_DOC_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from './constants.base'

export const MultiplayerJsonTraceSerializer: ISerializer<
ReadableSpan[],
IExportTraceServiceResponse
> = {
  serializeRequest: (arg: ReadableSpan[]) => {
    const filteredArg = arg.filter(span => {
      const traceId = span.spanContext().traceId

      if (
        traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
        || traceId.startsWith(MULTIPLAYER_TRACE_DOC_PREFIX)
        || traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
      ) {
        return true
      }

      return false
    })

    const request = createExportTraceServiceRequest(filteredArg, {
      useHex: true,
      useLongBits: false,
    })
    const encoder = new TextEncoder()
    return encoder.encode(JSON.stringify(request))
  },
  deserializeResponse: (arg: Uint8Array) => {
    const decoder = new TextDecoder()
    return JSON.parse(decoder.decode(arg)) as IExportTraceServiceResponse
  },
}
