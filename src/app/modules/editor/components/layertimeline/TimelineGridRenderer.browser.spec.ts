import { Animation } from 'app/modules/editor/model/timeline';
import type { ThemeService } from 'app/modules/editor/services';

import { TIMELINE_ANIMATION_PADDING } from './constants';
import { TimelineGridRenderer } from './TimelineGridRenderer';

describe('TimelineGridRenderer', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  function drawHeaderLabels(duration: number, horizZoom: number) {
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
    return fillText.mock.calls.map(([text]) => text);
  }

  it("doesn't draw time labels past the end of the animation", () => {
    // The labels are 25ms apart at this zoom, and the last one that fits is at 300ms.
    const labels = drawHeaderLabels(320, 2);
    expect(labels.at(0)).toBe('0s');
    expect(labels.at(-1)).toBe('0.3s');
  });

  it('draws the label at the end of the animation at a fractional zoom', () => {
    // The layout rounds the canvas's fractional width, which mustn't drop the last label.
    const labels = drawHeaderLabels(1000, 0.73519);
    expect(labels.at(-1)).toBe('1s');
  });
});
