
import {
  isValidTraceId,
  Context,
  SpanKind,
  Attributes,
  Link,
} from '@opentelemetry/api'
import {
  Sampler,
  SamplingDecision,
  SamplingResult,
} from '@opentelemetry/sdk-trace-base'
import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions'
import {
  MULTIPLAYER_TRACE_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX,
  MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX,
  // MULTIPLAYER_TRACE_CONTINUOUS_SESSION_CACHE_PREFIX,
} from './constants/constants.base'

export class SessionRecorderTraceIdRatioBasedSampler implements Sampler {
  private _upperBound: number

  constructor(private readonly _ratio: number = 0) {
    this._ratio = this._normalize(_ratio)
    this._upperBound = Math.floor(this._ratio * 0xffffffff)
  }

  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[],
  ): SamplingResult {
    if (attributes[ATTR_EXCEPTION_MESSAGE] || attributes[ATTR_EXCEPTION_STACKTRACE] || attributes[ATTR_EXCEPTION_TYPE]) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
      }
    }

    if (
      traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
      || traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_DEBUG_PREFIX)
      || traceId.startsWith(MULTIPLAYER_TRACE_SESSION_CACHE_PREFIX)
      // || traceId.startsWith(MULTIPLAYER_TRACE_CONTINUOUS_SESSION_CACHE_PREFIX)
    ) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
      }
    }

    let decision: SamplingDecision = SamplingDecision.NOT_RECORD

    if (
      isValidTraceId(traceId)
      && this._accumulate(traceId) < this._upperBound
    ) {
      decision = SamplingDecision.RECORD_AND_SAMPLED
    }

    return { decision }
  }

  toString(): string {
    return `SessionRecorderTraceIdRatioBasedSampler{${this._ratio}}`
  }

  private _normalize(ratio: number): number {
    if (typeof ratio !== 'number' || isNaN(ratio)) return 0
    return ratio >= 1 ? 1 : ratio <= 0 ? 0 : ratio
  }

  private _accumulate(traceId: string): number {
    let accumulation = 0
    for (let i = 0; i < traceId.length / 8; i++) {
      const pos = i * 8
      const part = parseInt(traceId.slice(pos, pos + 8), 16)
      accumulation = (accumulation ^ part) >>> 0
    }
    return accumulation
  }
}
