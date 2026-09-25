import { type RefObject, useLayoutEffect } from 'react';

const GROUPS = new Map<string, Set<HTMLElement>>();

/** Keeps the vertical scroll position of every element in the group in sync. */
export function useScrollGroup(ref: RefObject<HTMLElement | null>, group: string) {
  useLayoutEffect(() => {
    const element = ref.current;
    const elements = GROUPS.get(group) || new Set<HTMLElement>();
    GROUPS.set(group, elements);
    elements.add(element);
    const onScroll = () => {
      elements.forEach(e => {
        if (e !== element) {
          e.scrollTop = element.scrollTop;
        }
      });
    };
    element.addEventListener('scroll', onScroll);
    return () => {
      element.removeEventListener('scroll', onScroll);
      elements.delete(element);
    };
  }, [ref, group]);
}
