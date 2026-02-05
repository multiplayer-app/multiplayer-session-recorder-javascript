import { IdGenerator } from '@opentelemetry/sdk-trace-base'
import { SessionType } from './type'
import { getIdGenerator } from './sdk'
import {
  MULTIPLAYER_TRACE_PREFIX_MAP,
} from './constants/constants.base'

export class SessionRecorderIdGenerator implements IdGenerator {
  sessionShortId: string
  sessionType?: SessionType
  clientId?: string
  private generateLongId: () => string
  private generateShortId: () => string

  constructor() {
    this.generateLongId = getIdGenerator(16)
    this.generateShortId = getIdGenerator(8)
    this.sessionShortId = ''
    this.clientId = ''
    this.sessionType
  }

  generateTraceId(): string {
    const traceId = this.generateLongId()

    if (
      (
        !this.sessionShortId
        && !this.clientId
      )
      || !this.sessionType
    ) {
      return traceId
    }

    const sessionTypePrefix = MULTIPLAYER_TRACE_PREFIX_MAP[this.sessionType]
    const prefix = `${sessionTypePrefix}${[SessionType.CONTINUOUS_SESSION_CACHE, SessionType.SESSION_CACHE].includes(this.sessionType) ? this.clientId : ''}${this.sessionShortId}`
    const sessionTraceId = `${prefix}${traceId.substring(prefix.length, traceId.length)}`

    return sessionTraceId
  }

  generateSpanId(): string {
    return this.generateShortId()
  }

  setSessionId(
    sessionShortId: string,
    sessionType?: SessionType,
    clientId?: string,
  ) {
    if (
      sessionType
      && !clientId
      && [
        SessionType.SESSION_CACHE,
        SessionType.CONTINUOUS_SESSION_CACHE,
      ].includes(sessionType)
    ) {
      throw new Error(`Client ID is required for ${[
        SessionType.SESSION_CACHE,
        SessionType.CONTINUOUS_SESSION_CACHE,
      ].join(', ')} session types`)
    }

    this.sessionShortId = sessionShortId
    this.sessionType = sessionType
    this.clientId = clientId
  }
}
