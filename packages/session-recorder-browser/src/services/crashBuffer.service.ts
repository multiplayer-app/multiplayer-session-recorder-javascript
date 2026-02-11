import { SpanStatusCode } from '@opentelemetry/api'
import { EventType } from '@rrweb/types'
import { IndexedDBService } from './indexedDb.service'
import type {
  CrashBuffer,
  CrashBufferEventMap,
  CrashBufferEventName,
  CrashBufferOtelSpanBatchPayload,
  CrashBufferRrwebEventPayload,
  CrashBufferSnapshot
} from '@multiplayer-app/session-recorder-common'

export class CrashBufferService implements CrashBuffer {
  private lastPruneAt = 0
  private pruneInFlight: Promise<void> | null = null
  private isActive = true
  private frozenAtTs: number | null = null
  private lastSeenEventTs: number = 0
  private requiresFullSnapshot = true
  private lastTouchAt = 0
  private listeners = new Map<CrashBufferEventName, Set<(payload: CrashBufferEventMap[CrashBufferEventName]) => void>>()

  constructor(
    private readonly db: IndexedDBService,
    private readonly tabId: string,
    private readonly windowMs: number
  ) {}

  private async _safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn()
    } catch (_e) {
      return fallback
    }
  }

  async appendEvent(payload: CrashBufferRrwebEventPayload, _windowMs?: number): Promise<void> {
    this.lastSeenEventTs = Math.max(this.lastSeenEventTs, payload.ts || 0)
    if (!this.isActive) return

    const isFullSnapshot = Boolean(payload.isFullSnapshot)
    const eventType = payload?.event?.eventType
    const isMeta = eventType === EventType.Meta
    if (this.requiresFullSnapshot && !isFullSnapshot && !isMeta) {
      // rrweb replayable prefix is Meta -> FullSnapshot.
      // While waiting for the first FullSnapshot, we still keep the Meta event (but drop incrementals).
      return
    }

    await this._safe(async () => {
      await this.db.appendEvent({
        tabId: this.tabId,
        ts: payload.ts,
        isFullSnapshot: payload.isFullSnapshot,
        event: payload.event
      })
    }, undefined as any)

    if (isFullSnapshot && this.requiresFullSnapshot) {
      // Ensure this snapshot becomes the first replayable event.
      // Keep Meta + FullSnapshot (if present) and prune everything older.
      await this._safe(() => this.db.pruneOlderThanWithRrwebSnapshotAnchor(this.tabId, payload.ts), undefined as any)
      this.requiresFullSnapshot = false
    } else if (isFullSnapshot) {
      this.requiresFullSnapshot = false
    }

    this.pruneSoon()
  }

  async appendSpans(payload: CrashBufferOtelSpanBatchPayload, _windowMs?: number): Promise<void> {
    for (const p of payload) {
      this.lastSeenEventTs = Math.max(this.lastSeenEventTs, p.ts || 0)
    }
    if (!this.isActive) return
    let errorEvent: CrashBufferEventMap['error-span-appended'] | null = null
    await this._safe(async () => {
      const records = payload.map((p) => {
        if (!errorEvent && p?.span?.status?.code === SpanStatusCode.ERROR) {
          errorEvent = { ts: p.ts, span: p.span }
        }
        return {
          tabId: this.tabId,
          ts: p.ts,
          span: p.span
        }
      })
      await this.db.appendSpans(records)
    }, undefined as any)

    this.pruneSoon()

    if (errorEvent) {
      this._emit('error-span-appended', errorEvent)
    }
  }

  on<E extends CrashBufferEventName>(event: E, listener: (payload: CrashBufferEventMap[E]) => void): () => void {
    const set = this.listeners.get(event) || new Set()
    set.add(listener as any)
    this.listeners.set(event, set as any)
    return () => this.off(event, listener as any)
  }

  off<E extends CrashBufferEventName>(event: E, listener: (payload: CrashBufferEventMap[E]) => void): void {
    const set = this.listeners.get(event)
    if (!set) return
    set.delete(listener as any)
    if (set.size === 0) this.listeners.delete(event)
  }

  private _emit<E extends CrashBufferEventName>(event: E, payload: CrashBufferEventMap[E]): void {
    const set = this.listeners.get(event)
    if (!set || set.size === 0) return
    for (const fn of Array.from(set)) {
      try {
        ;(fn as any)(payload)
      } catch (_e) {
        // never throw into app code
      }
    }
  }

  async snapshot(_windowMs?: number, now: number = Date.now()): Promise<CrashBufferSnapshot> {
    const stoppedAt = now
    let startedAt = Math.max(0, stoppedAt - this.windowMs)

    const [allEvents, allSpans] = await Promise.all([
      this._safe(() => this.db.getRrwebEventsWindow(this.tabId, startedAt, stoppedAt), []),
      this._safe(() => this.db.getOtelSpansWindow(this.tabId, startedAt, stoppedAt), [])
    ])

    const eventsSorted = allEvents
      .sort((a, b) => a.ts - b.ts)
      .map((r) => ({ ts: r.ts, isFullSnapshot: r.isFullSnapshot, event: r.event }))

    const payload: CrashBufferSnapshot = {
      startedAt,
      stoppedAt,
      spans: [],
      events: []
    }

    // Hard guarantee: snapshot payload starts with Meta -> FullSnapshot (or is empty).
    const firstSnapshotIdx = eventsSorted.findIndex((e) => Boolean(e.isFullSnapshot))
    if (firstSnapshotIdx < 0) {
      return payload
    }

    // Prefer including the Meta event immediately preceding the first FullSnapshot.
    let startIdx = firstSnapshotIdx
    for (let i = firstSnapshotIdx - 1; i >= 0; i--) {
      const t = eventsSorted[i]?.event?.eventType
      if (t === EventType.Meta) {
        startIdx = i
        break
      }
    }

    const events = eventsSorted.slice(startIdx)
    const replayStartedAt = events.length > 0 ? events[0].ts : startedAt
    const spans = allSpans
      .filter((s) => typeof s?.ts === 'number' && s.ts >= replayStartedAt)
      .sort((a, b) => a.ts - b.ts)
      .map((r) => ({ ts: r.ts, span: r.span }))

    payload.events = events
    payload.spans = spans
    payload.startedAt = replayStartedAt

    return payload
  }

  async clear(): Promise<void> {
    await this._safe(() => this.db.clearTab(this.tabId), undefined as any)
    this.requiresFullSnapshot = true
  }

  needsFullSnapshot(): boolean {
    return this.requiresFullSnapshot
  }

  /**
   * Mark the tab as active/inactive.
   *
   * - When inactive, we freeze the buffer and keep the last active `windowMs` indefinitely.
   * - When re-activated, we resume buffering but require a new FullSnapshot to start a replayable segment.
   */
  setActive(active: boolean): void {
    if (this.isActive === active) return
    this.isActive = active

    if (!active) {
      const freezeAt = this.lastSeenEventTs || Date.now()
      this.frozenAtTs = freezeAt

      // Keep the last active window, but preserve rrweb replayability via snapshot anchor.
      const cutoff = Math.max(0, freezeAt - this.windowMs)
      void this._safe(() => this.db.pruneOlderThanWithRrwebSnapshotAnchor(this.tabId, cutoff), undefined as any)
      return
    }

    const wasFrozen = this.frozenAtTs !== null
    this.frozenAtTs = null

    // New active segment must start with a full snapshot (don’t stitch segments together).
    if (wasFrozen) this.requiresFullSnapshot = true
    this.pruneSoon()
  }

  private pruneSoon() {
    if (!this.isActive) return
    const now = Date.now()
    // Throttle pruning to avoid hammering IDB on high event rates
    if (now - this.lastPruneAt < 2000) return
    if (this.pruneInFlight) return

    this.lastPruneAt = now
    const cutoff = Math.max(0, now - this.windowMs)
    // Heartbeat so the stale-tab sweeper never deletes active tabs.
    if (now - this.lastTouchAt > 30_000) {
      this.lastTouchAt = now
      void this._safe(() => this.db.touchTab(this.tabId, now), undefined as any)
    }

    this.pruneInFlight = this._safe(
      () => this.db.pruneOlderThanWithRrwebSnapshotAnchor(this.tabId, cutoff),
      undefined as any
    ).finally(() => {
      this.pruneInFlight = null
    })
  }
}
