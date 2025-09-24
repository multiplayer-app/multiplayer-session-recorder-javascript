type Listener<T> = (state: T, prevState: T) => void

export type Store<T> = {
  getState: () => T
  setState: (partial: Partial<T> | ((prev: T) => T), action?: string) => void
  subscribe: (listener: Listener<T>) => () => void
}

export function createStore<T extends object>(initialState: T): Store<T> {
  let state: T = initialState
  const listeners = new Set<Listener<T>>()

  const getState = () => state

  const setState: Store<T>["setState"] = (partial) => {
    const prevState = state
    const nextState = typeof partial === 'function' ? (partial as (prev: T) => T)(prevState) : { ...prevState, ...partial } as T
    if (Object.is(nextState, prevState)) return
    state = nextState
    listeners.forEach((l) => l(state, prevState))
  }

  const subscribe: Store<T>["subscribe"] = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { getState, setState, subscribe }
}
