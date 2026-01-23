import { Platform } from 'react-native'

// Safe import for AsyncStorage with web fallback
let AsyncStorage: any = null
const isWeb = Platform.OS === 'web'

if (!isWeb) {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default
  } catch (_error) {
    AsyncStorage = null
  }
} else {
  AsyncStorage = {
    getItem: (_key: string) => Promise.resolve(null),
    setItem: (_key: string, _value: string) => Promise.resolve(undefined),
    removeItem: (_key: string) => Promise.resolve(undefined),
    multiRemove: (_keys: string[]) => Promise.resolve(undefined),
    multiGet: (_keys: string[]) => Promise.resolve([]),
    multiSet: (_pairs: Array<[string, string]>) => Promise.resolve(undefined),
  }
}

type RecordKind = 'rrweb' | 'span'

type IndexEntry = {
  id: string
  ts: number
  kind: RecordKind
}

const INDEX_KEY = 'mp_crash_buffer_index_v1'
const ATTRS_KEY = 'mp_crash_buffer_attrs_v1'
const RECORD_PREFIX = 'mp_crash_buffer_rec_v1:'

const randomId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export type CrashBufferSnapshot = {
  rrwebEvents: Array<{ ts: number; event: any }>
  otelSpans: Array<{ ts: number; span: any }>
  attrs: any | null
  windowMs: number
  fromTs: number
  toTs: number
}

export class CrashBufferService {
  private static instance: CrashBufferService | null = null

  private index: IndexEntry[] = []
  private indexLoaded = false
  private lastPruneAt = 0
  private opChain: Promise<any> = Promise.resolve()

  static getInstance(): CrashBufferService {
    if (!CrashBufferService.instance) {
      CrashBufferService.instance = new CrashBufferService()
    }
    return CrashBufferService.instance
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.opChain.then(fn, fn)
    // Preserve chain, but don't leak rejections.
    this.opChain = next.then(() => undefined, () => undefined)
    return next
  }

  private async ensureIndexLoaded(): Promise<void> {
    if (this.indexLoaded) return
    if (!AsyncStorage) {
      this.indexLoaded = true
      this.index = []
      return
    }
    try {
      const raw = await AsyncStorage.getItem(INDEX_KEY)
      this.index = raw ? JSON.parse(raw) : []
    } catch (_e) {
      this.index = []
    } finally {
      this.indexLoaded = true
    }
  }

  async setAttrs(attrs: any): Promise<void> {
    return this.enqueue(async () => {
      if (!AsyncStorage) return
      try {
        await AsyncStorage.setItem(ATTRS_KEY, JSON.stringify(attrs || null))
      } catch (_e) {
        // best-effort
      }
    })
  }

  async appendRrwebEvent(payload: { ts: number; event: any }, windowMs: number): Promise<void> {
    return this.appendRecord('rrweb', payload.ts, payload, windowMs)
  }

  async appendOtelSpan(payload: { ts: number; span: any }, windowMs: number): Promise<void> {
    return this.appendRecord('span', payload.ts, payload, windowMs)
  }

  private async appendRecord(kind: RecordKind, ts: number, payload: any, windowMs: number): Promise<void> {
    return this.enqueue(async () => {
      if (!AsyncStorage) return
      await this.ensureIndexLoaded()

      const id = randomId()
      const key = `${RECORD_PREFIX}${id}`
      const entry: IndexEntry = { id, ts, kind }
      this.index.push(entry)

      try {
        await AsyncStorage.setItem(key, JSON.stringify(payload))
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index))
      } catch (_e) {
        // best-effort
      }

      this.pruneSoon(windowMs)
    })
  }

  private pruneSoon(windowMs: number) {
    const now = Date.now()
    if (now - this.lastPruneAt < 2000) return
    this.lastPruneAt = now
    const cutoff = Math.max(0, now - windowMs)
    void this.pruneOlderThan(cutoff)
  }

  async pruneOlderThan(cutoffTs: number): Promise<void> {
    return this.enqueue(async () => {
      if (!AsyncStorage) return
      await this.ensureIndexLoaded()
      const toRemove = this.index.filter((e) => e.ts < cutoffTs)
      if (toRemove.length === 0) return

      const removeKeys = toRemove.map((e) => `${RECORD_PREFIX}${e.id}`)
      this.index = this.index.filter((e) => e.ts >= cutoffTs)

      try {
        await AsyncStorage.multiRemove(removeKeys)
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(this.index))
      } catch (_e) {
        // best-effort
      }
    })
  }

  async snapshot(windowMs: number, now: number = Date.now()): Promise<CrashBufferSnapshot> {
    return this.enqueue(async () => {
      await this.ensureIndexLoaded()
      const toTs = now
      const fromTs = Math.max(0, toTs - windowMs)
      const entries = this.index.filter((e) => e.ts >= fromTs && e.ts <= toTs)
      const keys = entries.map((e) => `${RECORD_PREFIX}${e.id}`)

      let pairs: Array<[string, string | null]> = []
      try {
        pairs = AsyncStorage ? await AsyncStorage.multiGet(keys) : []
      } catch (_e) {
        pairs = []
      }

      const byKey = new Map<string, any>()
      for (const [k, v] of pairs) {
        if (!v) continue
        try {
          byKey.set(k, JSON.parse(v))
        } catch (_e) {
          // ignore
        }
      }

      const rrwebEvents: Array<{ ts: number; event: any }> = []
      const otelSpans: Array<{ ts: number; span: any }> = []

      for (const e of entries.sort((a, b) => a.ts - b.ts)) {
        const key = `${RECORD_PREFIX}${e.id}`
        const payload = byKey.get(key)
        if (!payload) continue
        if (e.kind === 'rrweb') rrwebEvents.push(payload)
        if (e.kind === 'span') otelSpans.push(payload)
      }

      let attrs: any | null = null
      try {
        const raw = AsyncStorage ? await AsyncStorage.getItem(ATTRS_KEY) : null
        attrs = raw ? JSON.parse(raw) : null
      } catch (_e) {
        attrs = null
      }

      return { rrwebEvents, otelSpans, attrs, windowMs, fromTs, toTs }
    })
  }

  async clear(): Promise<void> {
    return this.enqueue(async () => {
      if (!AsyncStorage) return
      await this.ensureIndexLoaded()
      const keys = this.index.map((e) => `${RECORD_PREFIX}${e.id}`)
      this.index = []
      try {
        await AsyncStorage.multiRemove([INDEX_KEY, ATTRS_KEY, ...keys])
      } catch (_e) {
        // best-effort
      }
    })
  }
}
