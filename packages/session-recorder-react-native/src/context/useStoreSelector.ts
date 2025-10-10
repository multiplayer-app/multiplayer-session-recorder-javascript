import { useEffect, useRef, useState } from 'react'
import { type Store } from '../utils/createStore'
import { shallowEqual } from '../utils/shallowEqual'

export function useStoreSelector<TState extends object, TSlice>(
  store: Store<TState>,
  selector: (state: TState) => TSlice,
  equalityFn: (a: TSlice, b: TSlice) => boolean = Object.is,
): TSlice {
  const latestSelectorRef = useRef(selector)
  const latestEqualityRef = useRef(equalityFn)
  latestSelectorRef.current = selector
  latestEqualityRef.current = equalityFn

  const [slice, setSlice] = useState<TSlice>(() => latestSelectorRef.current(store.getState()))

  useEffect(() => {
    function handleChange(nextState: TState, prevState: TState) {
      const nextSlice = latestSelectorRef.current(nextState)
      const prevSlice = latestSelectorRef.current(prevState)
      if (!latestEqualityRef.current(nextSlice, prevSlice)) {
        setSlice(nextSlice)
      }
    }
    const unsubscribe = store.subscribe(handleChange)
    // Sync once in case changed between render and effect
    handleChange(store.getState(), store.getState())
    return unsubscribe
  }, [store])

  return slice
}

export const shallow = shallowEqual
