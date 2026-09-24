import { useEditorStore } from 'app/modules/editor/context/EditorContext';
import type { State } from 'app/modules/editor/store';
import { useEffectEvent, useLayoutEffect } from 'react';

/**
 * Calls the effect with the selected value, and then again whenever it changes, without
 * re-rendering the component. Use this for state that changes on every animation frame.
 */
export function useStoreEffect<T>(selector: (state: State) => T, effect: (value: T) => void) {
  const store = useEditorStore();
  const onChange = useEffectEvent(effect);
  useLayoutEffect(() => {
    const subscription = store.select(selector).subscribe(value => onChange(value));
    return () => subscription.unsubscribe();
  }, [store, selector]);
}
