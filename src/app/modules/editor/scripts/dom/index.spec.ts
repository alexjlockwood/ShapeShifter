import { afterEach, describe, expect, it, vi } from 'vitest';

import { watchDevicePixelRatio } from '.';

describe('watchDevicePixelRatio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // jsdom has no matchMedia, and browsers can't be moved to another display in tests.
  function stubMatchMedia() {
    const queries: { media: string; listeners: Set<() => void> }[] = [];
    vi.stubGlobal('matchMedia', (media: string) => {
      const listeners = new Set<() => void>();
      queries.push({ media, listeners });
      return {
        addEventListener: (_: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      };
    });
    return queries;
  }

  function change(query: { listeners: Set<() => void> }) {
    [...query.listeners].forEach(listener => listener());
  }

  it('calls back each time the ratio changes', () => {
    const queries = stubMatchMedia();
    vi.stubGlobal('devicePixelRatio', 1);
    const onChange = vi.fn<() => void>();
    watchDevicePixelRatio(onChange);
    expect(queries.map(q => q.media)).toEqual(['(resolution: 1dppx)']);

    vi.stubGlobal('devicePixelRatio', 2);
    change(queries[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    // The old query stops matching, and a new one watches the new ratio.
    expect(queries[0].listeners.size).toBe(0);
    expect(queries[1].media).toBe('(resolution: 2dppx)');

    vi.stubGlobal('devicePixelRatio', 1);
    change(queries[1]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(queries[2].media).toBe('(resolution: 1dppx)');
  });

  it('stops watching', () => {
    const queries = stubMatchMedia();
    vi.stubGlobal('devicePixelRatio', 1);
    const stop = watchDevicePixelRatio(() => {});
    stop();
    expect(queries[0].listeners.size).toBe(0);
  });
});
