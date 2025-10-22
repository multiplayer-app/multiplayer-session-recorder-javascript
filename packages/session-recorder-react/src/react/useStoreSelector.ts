import { useEffect, useRef, useState } from 'react'
import type { Store } from './store'

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
    handleChange(store.getState(), store.getState())
    return unsubscribe
  }, [store])

  return slice
}

export const shallow = <T extends object>(a: T, b: T) => {
  if (Object.is(a, b)) return true
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    // @ts-ignore
    if (!Object.prototype.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) return false
  }
  return true
}
