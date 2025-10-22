import { sessionRecorderStore, type SessionRecorderState } from './store'
import { useStoreSelector } from './useStoreSelector'

export function useSessionRecorderStore<TSlice>(
  selector: (state: SessionRecorderState) => TSlice,
  equalityFn: (a: TSlice, b: TSlice) => boolean = Object.is,
) {
  return useStoreSelector(sessionRecorderStore, selector, equalityFn)
}

export { sessionRecorderStore }
