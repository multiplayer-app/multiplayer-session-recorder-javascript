import { useEffect, useRef, useState } from 'react';
import { type Store } from './createStore';
import { shallowEqual } from '../utils/shallowEqual';

export function useStoreSelector<TState extends object, TSlice>(
  store: Store<TState>,
  selector: (state: TState) => TSlice,
  equalityFn: (a: TSlice, b: TSlice) => boolean = Object.is
): TSlice {
  const latestSelectorRef = useRef(selector);
  const latestEqualityRef = useRef(equalityFn);
  latestSelectorRef.current = selector;
  latestEqualityRef.current = equalityFn;

  const [slice, setSlice] = useState<TSlice>(() =>
    latestSelectorRef.current(store.getState())
  );

  useEffect(() => {
    function handleChange(nextState: TState, prevState: TState) {
      const nextSlice = latestSelectorRef.current(nextState);
      const prevSlice = latestSelectorRef.current(prevState);
      if (!latestEqualityRef.current(nextSlice, prevSlice)) {
        setSlice(nextSlice);
      }
    }
    const unsubscribe = store.subscribe(handleChange);
    // Sync once in case state changed between render and effect. Use the
    // functional updater form so we compare against the already-stored slice
    // rather than calling the selector twice on the same state (which returns
    // different object references for non-primitive values and causes an
    // unnecessary re-render that leads to infinite update loops with virtualizers).
    setSlice((prev) => {
      const current = latestSelectorRef.current(store.getState());
      return latestEqualityRef.current(prev, current) ? prev : current;
    });
    return unsubscribe;
  }, [store]);

  return slice;
}

export const shallow = shallowEqual;
