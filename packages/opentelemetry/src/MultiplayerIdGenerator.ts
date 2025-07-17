import {
  RandomIdGenerator,
  SamplingDecision,
} from '@opentelemetry/sdk-trace-base'
import { DebugSessionType } from './type'
import { MultiplayerTraceIdRatioBasedSampler } from './MultiplayerTraceIdRatioBasedSampler'
import {
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_DOC_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from './constants.base'
import { getIdGenerator } from './helpers'

export class MultiplayerIdGenerator extends RandomIdGenerator {
  debugSessionShortId: string
  debugSessionType: DebugSessionType
  docSpanSampler: MultiplayerTraceIdRatioBasedSampler

  generateLongId: () => string

  constructor({ autoDocTracesRatio = 0 } = {}) {
    super()

    this.docSpanSampler = new MultiplayerTraceIdRatioBasedSampler(autoDocTracesRatio)

    this.generateLongId = getIdGenerator(16)
    this.debugSessionShortId = ''
    this.debugSessionType = DebugSessionType.PLAIN

    this.generateTraceId = () => {
      const traceId = this.generateLongId()

      if (this.debugSessionShortId) {
        let debugSessionTypePrefix: string = ''
        switch (this.debugSessionType) {
          case DebugSessionType.CONTINUOUS:
            debugSessionTypePrefix = MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX
            break
          default:
            debugSessionTypePrefix = MULTIPLAYER_TRACE_DEBUG_PREFIX
        }

        const prefix = `${debugSessionTypePrefix}${this.debugSessionShortId}`

        const debugSessionTraceId = `${prefix}${traceId.substring(prefix.length, traceId.length)}`

        return debugSessionTraceId
      } else if (this._isDocTrace(traceId)) {
        return `${MULTIPLAYER_TRACE_DOC_PREFIX}${traceId.slice(MULTIPLAYER_TRACE_DOC_PREFIX.length, traceId.length)}`
      }

      return traceId
    }
  }

  setSessionId(
    debugSessionShortId: string,
    debugSessionType: DebugSessionType = DebugSessionType.PLAIN,
  ) {
    this.debugSessionShortId = debugSessionShortId
    this.debugSessionType = debugSessionType
  }

  _isDocTrace(traceId: string) {
    return this.docSpanSampler.shouldSample(
      undefined,
      traceId,
    ).decision === SamplingDecision.RECORD_AND_SAMPLED
  }
}
