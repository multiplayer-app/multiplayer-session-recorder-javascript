export type SessionRecorderState = {
  isInitialized: boolean
  sessionType: any | null
  sessionState: any | null
  isOnline: boolean
  error: string | null
}

type Listener<T> = (state: T, prev: T) => void

export type Store<T> = {
  getState: () => T
  setState: (partial: Partial<T> | ((prev: T) => T)) => void
  subscribe: (listener: Listener<T>) => () => void
}

export function createStore<T extends object>(initialState: T): Store<T> {
  let state = initialState
  const listeners = new Set<Listener<T>>()

  const getState = () => state

  const setState: Store<T>['setState'] = (partial) => {
    const prev = state
    const next = typeof partial === 'function' ? (partial as (p: T) => T)(prev) : ({ ...prev, ...partial } as T)
    if (Object.is(next, prev)) return
    state = next
    listeners.forEach((l) => l(state, prev))
  }

  const subscribe: Store<T>['subscribe'] = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { getState, setState, subscribe }
}
