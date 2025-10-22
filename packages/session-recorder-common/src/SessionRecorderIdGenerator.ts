import { IdGenerator } from '@opentelemetry/sdk-trace-base'
import { SessionType } from './type'
import {
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
} from './constants/constants.base'
import { getIdGenerator } from './sdk'

export class SessionRecorderIdGenerator implements IdGenerator {
  sessionShortId: string
  sessionType: SessionType
  private generateLongId: () => string
  private generateShortId: () => string

  constructor() {
    this.generateLongId = getIdGenerator(16)
    this.generateShortId = getIdGenerator(8)
    this.sessionShortId = ''
    this.sessionType = SessionType.MANUAL
  }

  generateTraceId(): string {
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
    }

    return traceId
  }

  generateSpanId(): string {
    return this.generateShortId()
  }

  setSessionId(
    sessionShortId: string,
    sessionType: SessionType = SessionType.MANUAL,
  ) {
    this.sessionShortId = sessionShortId
    this.sessionType = sessionType
  }
}
