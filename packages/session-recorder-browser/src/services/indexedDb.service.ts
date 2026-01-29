const dbName = 'mpEventsDB'
const dbVersion = 2

const legacyStoreName = 'mpEventsStore'

const rrwebEventsStore = 'rrwebEvents'
const otelSpansStore = 'otelSpans'
const attrsStore = 'crashBufferAttrs'

type TabId = string

export type CrashBufferAttrs = {
  tabId: TabId
  updatedAt: number
  sessionAttributes?: Record<string, any>
  resourceAttributes?: Record<string, any>
  userAttributes?: any
}

export type CrashBufferRrwebEventRecord = {
  id?: number
  tabId: TabId
  ts: number
  isFullSnapshot?: boolean
  event: any
}

export type CrashBufferOtelSpanRecord = {
  id?: number
  tabId: TabId
  ts: number
  span: any
}

export class IndexedDBService {
  private dbPromise: Promise<IDBDatabase>

  constructor() {
    this.dbPromise = this.openDB()
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion)
      request.onupgradeneeded = () => {
        const db = request.result
        // Keep the legacy store if it exists to avoid breaking older versions.
        if (!db.objectStoreNames.contains(legacyStoreName)) {
          db.createObjectStore(legacyStoreName, { keyPath: 'id', autoIncrement: true })
        }

        if (!db.objectStoreNames.contains(rrwebEventsStore)) {
          const store = db.createObjectStore(rrwebEventsStore, { keyPath: 'id', autoIncrement: true })
          store.createIndex('tabId_ts', ['tabId', 'ts'], { unique: false })
        }

        if (!db.objectStoreNames.contains(otelSpansStore)) {
          const store = db.createObjectStore(otelSpansStore, { keyPath: 'id', autoIncrement: true })
          store.createIndex('tabId_ts', ['tabId', 'ts'], { unique: false })
        }

        if (!db.objectStoreNames.contains(attrsStore)) {
          db.createObjectStore(attrsStore, { keyPath: 'tabId' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * @deprecated Prefer `appendEvent(tabId, ...)` and `getRrwebEventsWindow(...)`.
   * This writes into the legacy store with no pruning semantics.
   */
  async saveEvent(event: any): Promise<void> {
    const db = await this.dbPromise
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(legacyStoreName, 'readwrite')
      const store = tx.objectStore(legacyStoreName)
      store.add({ event })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * @deprecated Prefer `getRrwebEventsWindow(...)`.
   */
  async getAllEvents(): Promise<Array<any>> {
    const db = await this.dbPromise
    return new Promise<Array<any>>((resolve, reject) => {
      const tx = db.transaction(legacyStoreName, 'readonly')
      const store = tx.objectStore(legacyStoreName)
      const request = store.getAll()

      request.onsuccess = () => {
        const events = request.result.map((record: any) => record.event)
        resolve(events)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * @deprecated Prefer `clearTab(tabId)`.
   */
  async clearEvents(): Promise<void> {
    const db = await this.dbPromise
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(legacyStoreName, 'readwrite')
      const store = tx.objectStore(legacyStoreName)
      store.clear()

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async setAttrs(attrs: Omit<CrashBufferAttrs, 'updatedAt'> & { updatedAt?: number }): Promise<void> {
    const db = await this.dbPromise
    const payload: CrashBufferAttrs = {
      ...attrs,
      updatedAt: attrs.updatedAt ?? Date.now()
    }
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(attrsStore, 'readwrite')
      tx.objectStore(attrsStore).put(payload)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getAttrs(tabId: TabId): Promise<CrashBufferAttrs | null> {
    const db = await this.dbPromise
    return new Promise((resolve, reject) => {
      const tx = db.transaction(attrsStore, 'readonly')
      const request = tx.objectStore(attrsStore).get(tabId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllAttrs(): Promise<CrashBufferAttrs[]> {
    const db = await this.dbPromise
    return new Promise((resolve, reject) => {
      const tx = db.transaction(attrsStore, 'readonly')
      const request = tx.objectStore(attrsStore).getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Updates `updatedAt` for the tab without clobbering existing attributes.
   */
  async touchTab(tabId: TabId, updatedAt: number = Date.now()): Promise<void> {
    const db = await this.dbPromise
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(attrsStore, 'readwrite')
      const store = tx.objectStore(attrsStore)
      const getReq = store.get(tabId)

      getReq.onsuccess = () => {
        const existing = (getReq.result || null) as CrashBufferAttrs | null
        const next: CrashBufferAttrs = existing ? { ...existing, updatedAt } : { tabId, updatedAt }
        store.put(next)
      }
      getReq.onerror = () => reject(getReq.error)

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Best-effort garbage collection for orphaned tabs.
   * Deletes all data for tabs whose `attrs.updatedAt` is older than `maxAgeMs`.
   */
  async sweepStaleTabs(maxAgeMs: number, now: number = Date.now()): Promise<number> {
    const attrs = await this.getAllAttrs().catch(() => [])
    if (!attrs.length) return 0

    const stale = attrs
      .filter((a) => typeof a?.updatedAt === 'number' && now - a.updatedAt > maxAgeMs)
      .map((a) => a.tabId)

    let cleared = 0
    for (const tabId of stale) {
      try {
        await this.clearTab(tabId)
        cleared += 1
      } catch (_e) {
        // best effort
      }
    }
    return cleared
  }

  async appendEvent(record: CrashBufferRrwebEventRecord): Promise<void> {
    const db = await this.dbPromise
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(rrwebEventsStore, 'readwrite')
      tx.objectStore(rrwebEventsStore).add(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async appendSpans(records: CrashBufferOtelSpanRecord[]): Promise<void> {
    if (!records.length) return
    const db = await this.dbPromise
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(otelSpansStore, 'readwrite')
      const store = tx.objectStore(otelSpansStore)
      for (const record of records) {
        store.add(record)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getRrwebEventsWindow(tabId: TabId, fromTs: number, toTs: number): Promise<CrashBufferRrwebEventRecord[]> {
    const db = await this.dbPromise
    const range = IDBKeyRange.bound([tabId, fromTs], [tabId, toTs])
    return new Promise((resolve, reject) => {
      const tx = db.transaction(rrwebEventsStore, 'readonly')
      const idx = tx.objectStore(rrwebEventsStore).index('tabId_ts')
      const req = idx.getAll(range)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  }

  /**
   * Returns the last (highest-ts) FullSnapshot record at/before `cutoffTs`.
   * Used to keep a replayable anchor when pruning.
   */
  async getLastRrwebFullSnapshotBefore(tabId: TabId, cutoffTs: number): Promise<CrashBufferRrwebEventRecord | null> {
    const db = await this.dbPromise
    const range = IDBKeyRange.bound([tabId, 0], [tabId, cutoffTs])
    return new Promise((resolve, reject) => {
      const tx = db.transaction(rrwebEventsStore, 'readonly')
      const idx = tx.objectStore(rrwebEventsStore).index('tabId_ts')
      const req = idx.openCursor(range, 'prev')
      req.onsuccess = () => {
        const cursor = req.result
        if (!cursor) {
          resolve(null)
          return
        }
        const value = cursor.value as CrashBufferRrwebEventRecord
        if (value?.isFullSnapshot) {
          resolve(value)
          return
        }
        cursor.continue()
      }
      req.onerror = () => reject(req.error)
    })
  }

  async getOtelSpansWindow(tabId: TabId, fromTs: number, toTs: number): Promise<CrashBufferOtelSpanRecord[]> {
    const db = await this.dbPromise
    const range = IDBKeyRange.bound([tabId, fromTs], [tabId, toTs])
    return new Promise((resolve, reject) => {
      const tx = db.transaction(otelSpansStore, 'readonly')
      const idx = tx.objectStore(otelSpansStore).index('tabId_ts')
      const req = idx.getAll(range)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  }

  async pruneOlderThan(tabId: TabId, cutoffTs: number): Promise<void> {
    const db = await this.dbPromise
    const rrwebRange = IDBKeyRange.bound([tabId, 0], [tabId, cutoffTs])
    const spansRange = IDBKeyRange.bound([tabId, 0], [tabId, cutoffTs])

    const pruneStore = (store: IDBObjectStore, range: IDBKeyRange) =>
      new Promise<void>((resolve, reject) => {
        const idx = store.index('tabId_ts')
        const req = idx.openCursor(range)
        req.onsuccess = () => {
          const cursor = req.result
          if (!cursor) {
            resolve()
            return
          }
          cursor.delete()
          cursor.continue()
        }
        req.onerror = () => reject(req.error)
      })

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([rrwebEventsStore, otelSpansStore], 'readwrite')
      const rrwebStore = tx.objectStore(rrwebEventsStore)
      const spanStore = tx.objectStore(otelSpansStore)

      Promise.all([pruneStore(rrwebStore, rrwebRange), pruneStore(spanStore, spansRange)])
        .then(() => {
          // noop; completion is signaled by tx.oncomplete
        })
        .catch((e) => {
          reject(e)
        })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  /**
   * Prune older data while keeping rrweb replayability:
   * - rrweb: keep the last FullSnapshot at/before cutoff as an "anchor"
   * - spans: prune strictly by cutoff
   */
  async pruneOlderThanWithRrwebSnapshotAnchor(tabId: TabId, cutoffTs: number): Promise<void> {
    const db = await this.dbPromise
    const anchor = await this.getLastRrwebFullSnapshotBefore(tabId, cutoffTs)

    // rrweb: delete everything strictly older than the anchor snapshot (keep the anchor itself)
    // spans: delete everything older than cutoffTs
    const rrwebCutoffTs = typeof anchor?.ts === 'number' ? Math.max(0, anchor.ts - 1) : cutoffTs
    const rrwebRange = IDBKeyRange.bound([tabId, 0], [tabId, rrwebCutoffTs])
    const spansRange = IDBKeyRange.bound([tabId, 0], [tabId, cutoffTs])

    const pruneStore = (store: IDBObjectStore, range: IDBKeyRange) =>
      new Promise<void>((resolve, reject) => {
        const idx = store.index('tabId_ts')
        const req = idx.openCursor(range)
        req.onsuccess = () => {
          const cursor = req.result
          if (!cursor) {
            resolve()
            return
          }
          cursor.delete()
          cursor.continue()
        }
        req.onerror = () => reject(req.error)
      })

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([rrwebEventsStore, otelSpansStore], 'readwrite')
      const rrwebStore = tx.objectStore(rrwebEventsStore)
      const spanStore = tx.objectStore(otelSpansStore)

      Promise.all([pruneStore(rrwebStore, rrwebRange), pruneStore(spanStore, spansRange)])
        .then(() => {
          // noop
        })
        .catch((e) => reject(e))

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async clearTab(tabId: TabId): Promise<void> {
    const db = await this.dbPromise
    const allRange = IDBKeyRange.bound([tabId, 0], [tabId, Number.MAX_SAFE_INTEGER])

    const clearByTab = (store: IDBObjectStore) =>
      new Promise<void>((resolve, reject) => {
        const idx = store.index('tabId_ts')
        const req = idx.openCursor(allRange)
        req.onsuccess = () => {
          const cursor = req.result
          if (!cursor) {
            resolve()
            return
          }
          cursor.delete()
          cursor.continue()
        }
        req.onerror = () => reject(req.error)
      })

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([rrwebEventsStore, otelSpansStore, attrsStore], 'readwrite')
      const rrwebStore = tx.objectStore(rrwebEventsStore)
      const spanStore = tx.objectStore(otelSpansStore)
      const attr = tx.objectStore(attrsStore)

      Promise.all([
        clearByTab(rrwebStore),
        clearByTab(spanStore),
        new Promise<void>((res, rej) => {
          const r = attr.delete(tabId)
          r.onsuccess = () => res()
          r.onerror = () => rej(r.error)
        })
      ])
        .then(() => {
          // noop
        })
        .catch((e) => reject(e))

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}
