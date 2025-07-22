import { isValidTraceId } from '@opentelemetry/api'
import {
  Sampler,
  SamplingDecision,
  SamplingResult,
} from '@opentelemetry/sdk-trace-base'
import { MULTIPLAYER_TRACE_DEBUG_PREFIX } from './constants.base'

export class SessionRecorderTraceIdRatioBasedSampler implements Sampler {
  private _upperBound: number

  constructor(private readonly _ratio: number = 0) {
    this._ratio = this._normalize(_ratio)
    this._upperBound = Math.floor(this._ratio * 0xffffffff)
  }

  shouldSample(context: unknown, traceId: string): SamplingResult {
    if (
      this._ratio > 0
      && traceId.startsWith(MULTIPLAYER_TRACE_DEBUG_PREFIX)
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
    return `MultiplayerTraceIdRatioBasedSampler{${this._ratio}}`
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
