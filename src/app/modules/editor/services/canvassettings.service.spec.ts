import { afterEach, describe, expect, it } from 'vitest';

import { CanvasSettingsService, DEFAULT_CANVAS_SETTINGS } from './canvassettings.service';

const STORAGE_KEY = 'canvas_editor_settings';

describe('CanvasSettingsService', () => {
  afterEach(() => localStorage.clear());

  it('starts with the defaults', () => {
    expect(new CanvasSettingsService().getSettings()).toEqual(DEFAULT_CANVAS_SETTINGS);
  });

  it('remembers the settings in this browser', () => {
    const service = new CanvasSettingsService();
    const emitted: boolean[] = [];
    service.asObservable().subscribe(settings => emitted.push(settings.showRulers));
    service.toggle('showRulers');
    expect(emitted).toEqual([true, false]);
    expect(new CanvasSettingsService().getSettings()).toEqual({
      ...DEFAULT_CANVAS_SETTINGS,
      showRulers: false,
    });
  });

  it('falls back to the defaults for stored values that are missing or wrong', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ showPixelGrid: 'no', snapToPixelGrid: false }),
    );
    expect(new CanvasSettingsService().getSettings()).toEqual({
      ...DEFAULT_CANVAS_SETTINGS,
      snapToPixelGrid: false,
    });
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(new CanvasSettingsService().getSettings()).toEqual(DEFAULT_CANVAS_SETTINGS);
  });
});
