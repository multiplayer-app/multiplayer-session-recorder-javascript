const dbName = 'mpRrwebEventsDB'
const storeName = 'mpEventsStore'

export class IndexedDBService {
  private dbPromise: Promise<IDBDatabase>

  constructor() {
    this.dbPromise = this.openDB()
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async saveEvent(event: any): Promise<void> {
    const db = await this.dbPromise
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      store.add({ event })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getAllEvents(): Promise<Array<any>> {
    const db = await this.dbPromise
    return new Promise<Array<any>>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => {
        const events = request.result.map((record: any) => record.event)
        resolve(events)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async clearEvents(): Promise<void> {
    const db = await this.dbPromise
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      store.clear()

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}