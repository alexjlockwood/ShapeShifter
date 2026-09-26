import { afterEach, describe, expect, it, vi } from 'vitest';

import { getStoredItem, setStoredItem } from '.';

describe('storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('reads and writes localStorage', () => {
    setStoredItem('key', 'value');
    expect(getStoredItem('key')).toBe('value');
    expect(getStoredItem('missing')).toBeNull();
  });

  it('does nothing when reading localStorage throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    });
    expect(() => setStoredItem('key', 'value')).not.toThrow();
    expect(getStoredItem('key')).toBeNull();
  });

  it('does nothing when localStorage is null', () => {
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue(null as unknown as Storage);
    expect(() => setStoredItem('key', 'value')).not.toThrow();
    expect(getStoredItem('key')).toBeNull();
  });

  it('does nothing when localStorage is full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    expect(() => setStoredItem('key', 'value')).not.toThrow();
  });
});
