import { IndexedDBService } from './indexedDb.service'

export type CrashBufferSnapshot = {
  rrwebEvents: Array<{ ts: number; isFullSnapshot?: boolean; event: any }>
  otelSpans: Array<{ ts: number; span: any }>
  attrs: {
    sessionAttributes?: Record<string, any>
    resourceAttributes?: Record<string, any>
    userAttributes?: any
  } | null
  windowMs: number
  fromTs: number
  toTs: number
}

export class CrashBufferService {
  private lastPruneAt = 0
  private pruneInFlight: Promise<void> | null = null
  private isActive = true
  private frozenAtTs: number | null = null
  private lastSeenEventTs: number = 0
  private requiresFullSnapshot = true
  private lastTouchAt = 0

  constructor(
    private readonly db: IndexedDBService,
    private readonly tabId: string,
    private readonly windowMs: number,
  ) { }

  private async _safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn()
    } catch (_e) {
      return fallback
    }
  }

  async setAttrs(attrs: {
    sessionAttributes?: Record<string, any>
    resourceAttributes?: Record<string, any>
    userAttributes?: any
  }): Promise<void> {
    await this._safe(async () => {
      await this.db.setAttrs({
        tabId: this.tabId,
        ...attrs,
      })
    }, undefined as any)
  }

  async appendRrwebEvent(payload: { ts: number; isFullSnapshot?: boolean; event: any }): Promise<void> {
    this.lastSeenEventTs = Math.max(this.lastSeenEventTs, payload.ts || 0)
    if (!this.isActive) return

    const isFullSnapshot = Boolean(payload.isFullSnapshot)
    if (this.requiresFullSnapshot && !isFullSnapshot) {
      // Buffer must always start with a full snapshot; drop incrementals until we see one.
      return
    }

    await this._safe(async () => {
      await this.db.appendRrwebEvent({
        tabId: this.tabId,
        ts: payload.ts,
        isFullSnapshot: payload.isFullSnapshot,
        event: payload.event,
      })
    }, undefined as any)

    if (isFullSnapshot && this.requiresFullSnapshot) {
      // Ensure this snapshot becomes the first replayable event.
      // We keep the snapshot itself and prune everything older.
      await this._safe(() => this.db.pruneOlderThan(this.tabId, Math.max(0, payload.ts - 1)), undefined as any)
      this.requiresFullSnapshot = false
    } else if (isFullSnapshot) {
      this.requiresFullSnapshot = false
    }

    this.pruneSoon()
  }

  async appendOtelSpan(payload: { ts: number; span: any }): Promise<void> {
    this.lastSeenEventTs = Math.max(this.lastSeenEventTs, payload.ts || 0)
    if (!this.isActive) return
    await this._safe(async () => {
      await this.db.appendOtelSpan({
        tabId: this.tabId,
        ts: payload.ts,
        span: payload.span,
      })
    }, undefined as any)
    this.pruneSoon()
  }

  async snapshot(now: number = Date.now()): Promise<CrashBufferSnapshot> {
    const toTs = now
    const fromTs = Math.max(0, toTs - this.windowMs)

    // Always include a full snapshot "anchor" if one exists at/before the window start.
    const rrwebFromTs = await this._safe(async () => {
      const anchor = await this.db.getLastRrwebFullSnapshotBefore(this.tabId, fromTs)
      return typeof anchor?.ts === 'number' ? anchor.ts : fromTs
    }, fromTs)

    const [rrweb, spans, attrs] = await Promise.all([
      this._safe(() => this.db.getRrwebEventsWindow(this.tabId, rrwebFromTs, toTs), []),
      this._safe(() => this.db.getOtelSpansWindow(this.tabId, fromTs, toTs), []),
      this._safe(() => this.db.getAttrs(this.tabId), null),
    ])

    const rrwebSorted = rrweb
      .sort((a, b) => a.ts - b.ts)
      .map((r) => ({ ts: r.ts, isFullSnapshot: r.isFullSnapshot, event: r.event }))

    // Hard guarantee: snapshot payload starts with a FullSnapshot (or is empty).
    const firstFullSnapshotIdx = rrwebSorted.findIndex((e) => Boolean(e.isFullSnapshot))
    const rrwebEvents = firstFullSnapshotIdx >= 0 ? rrwebSorted.slice(firstFullSnapshotIdx) : []

    // Align spans with the rrweb replay start: spans must start from the FullSnapshot timestamp.
    const replayStartTs = rrwebEvents.length > 0 ? rrwebEvents[0].ts : fromTs
    const otelSpans = spans
      .filter((s) => typeof s?.ts === 'number' && s.ts >= replayStartTs)
      .sort((a, b) => a.ts - b.ts)
      .map((r) => ({ ts: r.ts, span: r.span }))

    return {
      rrwebEvents,
      otelSpans,
      attrs: attrs ? {
        sessionAttributes: attrs.sessionAttributes,
        resourceAttributes: attrs.resourceAttributes,
        userAttributes: attrs.userAttributes,
      } : null,
      windowMs: this.windowMs,
      fromTs: replayStartTs,
      toTs,
    }
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

    this.pruneInFlight = this._safe(() => this.db.pruneOlderThanWithRrwebSnapshotAnchor(this.tabId, cutoff), undefined as any)
      .finally(() => { this.pruneInFlight = null })
  }
}
