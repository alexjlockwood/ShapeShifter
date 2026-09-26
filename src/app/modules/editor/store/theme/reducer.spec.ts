import { createEditorStore } from 'app/modules/editor/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SetTheme } from './actions';
import { getThemeType } from './selectors';

describe('theme reducer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('restores and saves the theme', () => {
    window.localStorage.setItem('storage_key_theme_type', 'dark');
    const store = createEditorStore({ logActions: false });
    expect(getThemeType(store.getState()).themeType).toBe('dark');
    store.dispatch(new SetTheme('light'));
    expect(window.localStorage.getItem('storage_key_theme_type')).toBe('light');
  });

  // Reading localStorage throws when cookies are blocked, which used to leave a blank page.
  it('uses the light theme when localStorage is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied for this document.', 'SecurityError');
    });
    const store = createEditorStore({ logActions: false });
    expect(getThemeType(store.getState()).themeType).toBe('light');
    store.dispatch(new SetTheme('dark'));
    expect(getThemeType(store.getState()).themeType).toBe('dark');
  });
});
