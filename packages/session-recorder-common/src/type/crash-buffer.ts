export type CrashBufferAttrs = {
  sessionAttributes?: Record<string, any>
  resourceAttributes?: Record<string, any>
  userAttributes?: any
}

export type CrashBufferRrwebEventPayload = {
  ts: number
  isFullSnapshot?: boolean
  event: any
}

export type CrashBufferOtelSpanPayload = {
  ts: number
  span: any
}

/**
 * Batch append payload for OTEL spans.
 * This is intentionally the same per-span shape as `CrashBufferOtelSpanPayload`,
 * just provided as an array to allow implementations to persist efficiently.
 */
export type CrashBufferOtelSpanBatchPayload = CrashBufferOtelSpanPayload[]

export type CrashBufferErrorSpanAppendedEvent = CrashBufferOtelSpanPayload

export type CrashBufferEventName = 'error-span-appended'

export type CrashBufferEventMap = {
  'error-span-appended': CrashBufferErrorSpanAppendedEvent
}

export type CrashBufferSnapshot = {
  rrwebEvents: CrashBufferRrwebEventPayload[]
  otelSpans: CrashBufferOtelSpanPayload[]
  attrs: CrashBufferAttrs | null
  windowMs: number
  fromTs: number
  toTs: number
}

/**
 * Shared CrashBuffer contract used across browser + react-native implementations.
 *
 * Notes:
 * - `windowMs` is optional because browser implementations usually bake the window into the instance,
 *   while React Native typically passes it per call.
 * - `pruneOlderThan` is optional because browser implementations can handle pruning internally.
 */
export interface CrashBuffer {
  setAttrs(attrs: CrashBufferAttrs): Promise<void>
  appendEvent(payload: CrashBufferRrwebEventPayload, windowMs?: number): Promise<void>
  appendSpans(payload: CrashBufferOtelSpanBatchPayload, windowMs?: number): Promise<void>
  snapshot(windowMs?: number, now?: number): Promise<CrashBufferSnapshot>
  clear(): Promise<void>
  pruneOlderThan?(cutoffTs: number): Promise<void>
  on?(
    event: CrashBufferEventName,
    listener: (payload: CrashBufferEventMap[CrashBufferEventName]) => void
  ): () => void
  off?(
    event: CrashBufferEventName,
    listener: (payload: CrashBufferEventMap[CrashBufferEventName]) => void
  ): void
}

/**
 * Optional lifecycle controls supported by some CrashBuffer implementations (e.g. browser tabs).
 */
export interface CrashBufferLifecycle extends CrashBuffer {
  setActive(active: boolean): void
  needsFullSnapshot(): boolean
}
