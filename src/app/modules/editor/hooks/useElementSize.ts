import { type RefObject, useLayoutEffect, useState } from 'react';

import { requireRef } from './requireRef';

export interface Size {
  readonly w: number;
  readonly h: number;
}

/** Returns the size of the element's content box, updating it whenever it resizes. */
export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<Size>({ w: 1, h: 1 });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setSize(prevSize => (prevSize.w === w && prevSize.h === h ? prevSize : { w, h }));
    });
    observer.observe(requireRef(ref));
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
