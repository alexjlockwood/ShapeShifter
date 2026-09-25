import type { RefObject } from 'react';

/** Returns the ref's element, which React attaches before running layout effects. */
export function requireRef<T>(ref: RefObject<T | null>): T {
  const { current } = ref;
  if (current === null) {
    throw new Error("The ref hasn't been attached to an element");
  }
  return current;
}
