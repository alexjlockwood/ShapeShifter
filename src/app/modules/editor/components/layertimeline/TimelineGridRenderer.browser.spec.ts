import { Animation } from 'app/modules/editor/model/timeline';
import type { ThemeService } from 'app/modules/editor/services';

import { TIMELINE_ANIMATION_PADDING } from './constants';
import { TimelineGridRenderer } from './TimelineGridRenderer';

describe('TimelineGridRenderer', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("doesn't draw time labels past the end of the animation", () => {
    const duration = 320;
    const horizZoom = 2;
    const canvas = document.createElement('canvas');
    canvas.style.width = `${duration * horizZoom + TIMELINE_ANIMATION_PADDING * 2}px`;
    canvas.style.height = '40px';
    document.body.append(canvas);
    const themeService = {
      getSecondaryTextColor: () => '#000',
      getDividerTextColor: () => '#000',
    } as unknown as ThemeService;
    const fillText = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText');

    const renderer = new TimelineGridRenderer(canvas, true, themeService);
    renderer.animation = new Animation({ duration });
    renderer.horizZoom = horizZoom;

    // The labels are 25ms apart at this zoom, and the last one that fits is at 300ms.
    const labels = fillText.mock.calls.map(([text]) => text);
    expect(labels.at(0)).toBe('0s');
    expect(labels.at(-1)).toBe('0.3s');
  });
});
