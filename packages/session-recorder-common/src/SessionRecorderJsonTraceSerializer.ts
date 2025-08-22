import { ReadableSpan } from '@opentelemetry/sdk-trace-base'
import {
  IExportTraceServiceResponse,
  ISerializer,
} from '@opentelemetry/otlp-transformer'
import {
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from './constants/constants.base'

export const SessionRecorderJsonTraceSerializer: ISerializer<
ReadableSpan[],
IExportTraceServiceResponse
> = {
  serializeRequest: (arg: ReadableSpan[]) => {
    const filteredArg = arg.filter(span => {
      const traceId = span.spanContext().traceId

      if (
        traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
        || traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
      ) {
        return true
      }

      return false
    })

    // Create a simple trace service request structure
    const request = {
      resourceSpans: filteredArg.map(span => ({
        resource: {
          attributes: Object.entries(span.resource.attributes).map(([key, value]) => ({
            key,
            value: { stringValue: String(value) },
          })),
        },
        scopeSpans: [{
          spans: [{
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId,
            parentSpanId: span.spanContext().spanId, // Using spanId as fallback
            name: span.name,
            kind: span.kind,
            startTimeUnixNano: span.startTime[0] * 1e9 + span.startTime[1],
            endTimeUnixNano: span.endTime ? span.endTime[0] * 1e9 + span.endTime[1] : undefined,
            attributes: Object.entries(span.attributes).map(([key, value]) => ({
              key,
              value: { stringValue: String(value) },
            })),
            events: span.events.map(event => ({
              timeUnixNano: event.time[0] * 1e9 + event.time[1],
              name: event.name,
              attributes: Object.entries(event.attributes || {}).map(([key, value]) => ({
                key,
                value: { stringValue: String(value) },
              })),
            })),
            links: span.links.map(link => ({
              traceId: link.context.traceId,
              spanId: link.context.spanId,
              attributes: Object.entries(link.attributes || {}).map(([key, value]) => ({
                key,
                value: { stringValue: String(value) },
              })),
            })),
            status: {
              code: span.status.code,
              message: span.status.message || '',
            },
          }],
        }],
      })),
    }

    const encoder = new TextEncoder()
    return encoder.encode(JSON.stringify(request))
  },
  deserializeResponse: (arg: Uint8Array) => {
    const decoder = new TextDecoder()
    return JSON.parse(decoder.decode(arg)) as IExportTraceServiceResponse
  },
}
