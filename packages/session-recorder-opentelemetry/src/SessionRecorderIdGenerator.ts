import {
  RandomIdGenerator,
  SamplingDecision,
} from '@opentelemetry/sdk-trace-base'
import { SessionType } from './type'
import {
  SessionRecorderTraceIdRatioBasedSampler
} from './SessionRecorderTraceIdRatioBasedSampler'
import {
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_DOC_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from './constants.base'
import { getIdGenerator } from './helpers'

export class SessionRecorderIdGenerator extends RandomIdGenerator {
  sessionShortId: string
  sessionType: SessionType
  docSpanSampler: SessionRecorderTraceIdRatioBasedSampler

  generateLongId: () => string

  constructor({ autoDocTracesRatio = 0 } = {}) {
    super()

    this.docSpanSampler = new SessionRecorderTraceIdRatioBasedSampler(autoDocTracesRatio)

    this.generateLongId = getIdGenerator(16)
    this.sessionShortId = ''
    this.sessionType = SessionType.PLAIN

    this.generateTraceId = () => {
      const traceId = this.generateLongId()

      if (this.sessionShortId) {
        let sessionTypePrefix: string = ''
        switch (this.sessionType) {
          case SessionType.CONTINUOUS:
            sessionTypePrefix = MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX
            break
          default:
            sessionTypePrefix = MULTIPLAYER_TRACE_DEBUG_PREFIX
        }

        const prefix = `${sessionTypePrefix}${this.sessionShortId}`

        const sessionTraceId = `${prefix}${traceId.substring(prefix.length, traceId.length)}`

        return sessionTraceId
      } else if (this._isDocTrace(traceId)) {
        return `${MULTIPLAYER_TRACE_DOC_PREFIX}${traceId.slice(MULTIPLAYER_TRACE_DOC_PREFIX.length, traceId.length)}`
      }

      return traceId
    }
  }

  setSessionId(
    debugSessionShortId: string,
    debugSessionType: SessionType = SessionType.PLAIN,
  ) {
    this.sessionShortId = debugSessionShortId
    this.sessionType = debugSessionType
  }

  _isDocTrace(traceId: string) {
    return this.docSpanSampler.shouldSample(
      undefined,
      traceId,
    ).decision === SamplingDecision.RECORD_AND_SAMPLED
  }
}
