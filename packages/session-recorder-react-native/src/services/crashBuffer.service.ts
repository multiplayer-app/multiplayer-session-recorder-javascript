import { Platform } from 'react-native';
import { EventType } from '@rrweb/types';
import type {
  CrashBufferEventMap,
  CrashBufferEventName,
  CrashBufferErrorSpanAppendedEvent,
  CrashBuffer,
  CrashBufferRrwebEventPayload,
  CrashBufferOtelSpanPayload,
  CrashBufferOtelSpanBatchPayload,
  CrashBufferSnapshot,
} from '@multiplayer-app/session-recorder-common';
import { SpanStatusCode } from '@opentelemetry/api';

// Safe import for AsyncStorage with web fallback
let AsyncStorage: any = null;
const isWeb = Platform.OS === 'web';

if (!isWeb) {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch (_error) {
    AsyncStorage = null;
  }
} else {
  AsyncStorage = {
    getItem: (_key: string) => Promise.resolve(null),
    setItem: (_key: string, _value: string) => Promise.resolve(undefined),
    removeItem: (_key: string) => Promise.resolve(undefined),
    multiRemove: (_keys: string[]) => Promise.resolve(undefined),
    multiGet: (_keys: string[]) => Promise.resolve([]),
    multiSet: (_pairs: Array<[string, string]>) => Promise.resolve(undefined),
  };
}

type RecordKind = 'rrweb' | 'span';

type IndexEntry = {
  id: string;
  ts: number;
  kind: RecordKind;
};

const INDEX_KEY = 'mp_crash_buffer_index_v1';
const ATTRS_KEY = 'mp_crash_buffer_attrs_v1';
const RECORD_PREFIX = 'mp_crash_buffer_rec_v1:';

const randomId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export class CrashBufferService implements CrashBuffer {
  private static instance: CrashBufferService | null = null;

  private index: IndexEntry[] = [];
  private indexLoaded = false;
  private lastPruneAt = 0;
  private opChain: Promise<any> = Promise.resolve();
  private defaultWindowMs: number = 0.5 * 60 * 1000;
  private lastSeenEventTs: number = 0;

  private listeners = new Map<
    CrashBufferEventName,
    Set<(payload: CrashBufferEventMap[CrashBufferEventName]) => void>
  >();

  static getInstance(): CrashBufferService {
    if (!CrashBufferService.instance) {
      CrashBufferService.instance = new CrashBufferService();
    }
    return CrashBufferService.instance;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.opChain.then(fn, fn);
    // Preserve chain, but don't leak rejections.
    this.opChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async ensureIndexLoaded(): Promise<void> {
    if (this.indexLoaded) return;
    if (!AsyncStorage) {
      this.indexLoaded = true;
      this.index = [];
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(INDEX_KEY);
      this.index = raw ? JSON.parse(raw) : [];
    } catch (_e) {
      this.index = [];
    } finally {
      this.indexLoaded = true;
    }
  }

  async setAttrs(attrs: any): Promise<void> {
    return this.enqueue(async () => {
      if (!AsyncStorage) return;
      try {
        await AsyncStorage.setItem(ATTRS_KEY, JSON.stringify(attrs || null));
      } catch (_e) {
        // best-effort
      }
    });
  }

  async appendEvent(
    payload: CrashBufferRrwebEventPayload,
    windowMs?: number
  ): Promise<void> {
    const ts = payload?.ts ?? Date.now();
    this.lastSeenEventTs = Math.max(this.lastSeenEventTs, ts);

    const rawEventType =
      (payload as any)?.event?.eventType ?? (payload as any)?.event?.type;
    const isFullSnapshot =
      Boolean(payload.isFullSnapshot) ||
      rawEventType === EventType.FullSnapshot;

    const record: CrashBufferRrwebEventPayload = {
      ...payload,
      ts,
      isFullSnapshot,
    };

    return this.appendRecord(
      'rrweb',
      record.ts,
      record,
      windowMs ?? this.defaultWindowMs
    );
  }

  async appendSpans(
    payload: CrashBufferOtelSpanBatchPayload,
    windowMs?: number
  ): Promise<void> {
    if (!payload.length) return;
    const effectiveWindowMs = windowMs ?? this.defaultWindowMs;
    return this.enqueue(async () => {
      if (!AsyncStorage) return;
      await this.ensureIndexLoaded();

      const pairs: Array<[string, string]> = [];
      let errorEvent: CrashBufferErrorSpanAppendedEvent | null = null;
      for (const p of payload) {
        const id = randomId();
        const key = `${RECORD_PREFIX}${id}`;
        const entry: IndexEntry = { id, ts: p.ts, kind: 'span' };
        this.index.push(entry);
        pairs.push([key, JSON.stringify(p)]);
        if (!errorEvent && p?.span?.status?.code === SpanStatusCode.ERROR) {
          errorEvent = { ts: p.ts, span: p.span };
        }
      }

      try {
        await AsyncStorage.multiSet(pairs);
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index));
      } catch (_e) {
        // best-effort
      }

      this.pruneSoon(effectiveWindowMs);

      if (errorEvent) {
        this._emit('error-span-appended', errorEvent);
      }
    });
  }

  setDefaultWindowMs(windowMs: number): void {
    this.defaultWindowMs = Math.max(10_000, windowMs || 0.5 * 60 * 1000);
  }

  on<E extends CrashBufferEventName>(
    event: E,
    listener: (payload: CrashBufferEventMap[E]) => void
  ): () => void {
    const set = this.listeners.get(event) || new Set();
    set.add(listener as any);
    this.listeners.set(event, set as any);
    return () => this.off(event, listener as any);
  }

  off<E extends CrashBufferEventName>(
    event: E,
    listener: (payload: CrashBufferEventMap[E]) => void
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as any);
    if (set.size === 0) this.listeners.delete(event);
  }

  private _emit<E extends CrashBufferEventName>(
    event: E,
    payload: CrashBufferEventMap[E]
  ): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const fn of Array.from(set)) {
      try {
        (fn as any)(payload);
      } catch (_e) {
        // never throw into app code
      }
    }
  }

  private async appendRecord(
    kind: RecordKind,
    ts: number,
    payload: any,
    windowMs: number
  ): Promise<void> {
    return this.enqueue(async () => {
      if (!AsyncStorage) return;
      await this.ensureIndexLoaded();

      const id = randomId();
      const key = `${RECORD_PREFIX}${id}`;
      const entry: IndexEntry = { id, ts, kind };
      this.index.push(entry);

      try {
        await AsyncStorage.setItem(key, JSON.stringify(payload));
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index));
      } catch (_e) {
        // best-effort
      }

      this.pruneSoon(windowMs);
    });
  }

  private pruneSoon(windowMs: number) {
    const now = Date.now();
    if (now - this.lastPruneAt < 2000) return;
    this.lastPruneAt = now;
    const cutoff = Math.max(0, now - windowMs);
    void this.pruneOlderThan(cutoff);
  }

  async pruneOlderThan(cutoffTs: number): Promise<void> {
    return this.enqueue(async () => {
      if (!AsyncStorage) return;
      await this.ensureIndexLoaded();
      const toRemove = this.index.filter((e) => e.ts < cutoffTs);
      if (toRemove.length === 0) return;

      const removeKeys = toRemove.map((e) => `${RECORD_PREFIX}${e.id}`);
      this.index = this.index.filter((e) => e.ts >= cutoffTs);

      try {
        await AsyncStorage.multiRemove(removeKeys);
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index));
      } catch (_e) {
        // best-effort
      }
    });
  }

  async snapshot(
    windowMs?: number,
    now: number = Date.now()
  ): Promise<CrashBufferSnapshot> {
    return this.enqueue(async () => {
      await this.ensureIndexLoaded();
      const effectiveWindowMs = windowMs ?? this.defaultWindowMs;
      const toTs = now;
      const fromTs = Math.max(0, toTs - effectiveWindowMs);
      const entries = this.index.filter((e) => e.ts >= fromTs && e.ts <= toTs);
      const keys = entries.map((e) => `${RECORD_PREFIX}${e.id}`);

      let pairs: Array<[string, string | null]> = [];
      try {
        pairs = AsyncStorage ? await AsyncStorage.multiGet(keys) : [];
      } catch (_e) {
        pairs = [];
      }

      const byKey = new Map<string, any>();
      for (const [k, v] of pairs) {
        if (!v) continue;
        try {
          byKey.set(k, JSON.parse(v));
        } catch (_e) {
          // ignore
        }
      }

      const allEvents: CrashBufferRrwebEventPayload[] = [];
      const allSpans: CrashBufferOtelSpanPayload[] = [];

      for (const e of entries.sort((a, b) => a.ts - b.ts)) {
        const key = `${RECORD_PREFIX}${e.id}`;
        const payload = byKey.get(key);
        if (!payload) continue;
        if (e.kind === 'rrweb') allEvents.push(payload);
        if (e.kind === 'span') allSpans.push(payload);
      }

      // Mirror browser semantics:
      // - Ensure the rrweb stream starts at Meta -> FullSnapshot (or is empty).
      // - Only include spans from the replayable window onward.
      const eventsSorted = allEvents.slice().sort((a, b) => a.ts - b.ts);
      const firstSnapshotIdx = eventsSorted.findIndex((e) => {
        const t = (e as any)?.event?.eventType ?? (e as any)?.event?.type;
        return t === EventType.FullSnapshot;
      });

      if (firstSnapshotIdx < 0) {
        return {
          events: [],
          spans: [],
          startedAt: fromTs,
          stoppedAt: toTs,
        };
      }

      let startIdx = firstSnapshotIdx;
      for (let i = firstSnapshotIdx - 1; i >= 0; i--) {
        const t =
          (eventsSorted[i] as any)?.event?.eventType ??
          (eventsSorted[i] as any)?.event?.type;
        if (t === EventType.Meta) {
          startIdx = i;
          break;
        }
      }

      const rrwebEvents = eventsSorted.slice(startIdx);
      const firstEvent = rrwebEvents[0];
      const replayStartedAt =
        typeof firstEvent?.ts === 'number' ? firstEvent.ts : fromTs;

      const otelSpans = allSpans
        .filter((s) => typeof s?.ts === 'number' && s.ts >= replayStartedAt)
        .sort((a, b) => a.ts - b.ts);

      return {
        spans: otelSpans,
        events: rrwebEvents,
        stoppedAt: toTs,
        startedAt: replayStartedAt,
      };
    });
  }

  async clear(): Promise<void> {
    return this.enqueue(async () => {
      if (!AsyncStorage) return;
      await this.ensureIndexLoaded();
      const keys = this.index.map((e) => `${RECORD_PREFIX}${e.id}`);
      this.index = [];
      this.lastSeenEventTs = 0;
      try {
        await AsyncStorage.multiRemove([INDEX_KEY, ATTRS_KEY, ...keys]);
      } catch (_e) {
        // best-effort
      }
    });
  }
}
