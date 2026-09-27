import { describe, expect, it } from 'vitest';

import { CanvasCamera } from './CanvasCamera';
import { getRulerInterval, getRulerLayout } from './CanvasRuler';

describe('getRulerInterval', () => {
  it('leaves at least 40 CSS pixels between ticks', () => {
    expect(getRulerInterval(40)).toBe(1);
    expect(getRulerInterval(24)).toBe(2);
    expect(getRulerInterval(13.7)).toBe(4);
    expect(getRulerInterval(1)).toBe(48);
  });

  // CANVAS-5: the ruler used to treat a scale below 1 as 1, and its loop never ended past the
  // table's end.
  it('uses bigger intervals when there are fewer pixels than viewport units', () => {
    // A 512 unit viewport in a 400 pixel panel.
    expect(getRulerInterval(328 / 512)).toBe(100);
    expect(getRulerInterval(0.1)).toBe(500);
    expect(getRulerInterval(0.02)).toBe(2500);
    expect(getRulerInterval(0.0001)).toBe(500000);
  });

  it("doesn't hang on scales that aren't numbers", () => {
    expect(getRulerInterval(0)).toBe(Infinity);
    expect(getRulerInterval(NaN)).toBe(Infinity);
  });
});

describe('getRulerLayout', () => {
  const panel = { w: 600, h: 400 };
  const viewport = { w: 24, h: 24 };

  it('runs along the artboard, a little past each end of it', () => {
    const camera = CanvasCamera.fit({ panel, viewport, pixelRatio: 1 });
    // The artboard is 328 pixels wide, at (136, 36).
    const horizontal = getRulerLayout(camera, 'horizontal');
    expect(horizontal.rect).toEqual({ x: 124, y: 4, w: 352, h: 32 });
    expect(horizontal.ticks.map(t => t.label)).toEqual(['0', '4', '8', '12', '16', '20', '24']);
    expect(horizontal.ticks[0].offset).toBe(12);
    expect(horizontal.ticks[6].offset).toBeCloseTo(340, 9);

    const vertical = getRulerLayout(camera, 'vertical');
    expect(vertical.rect).toEqual({ x: 104, y: 24, w: 32, h: 352 });
    expect(vertical.ticks.map(t => t.label)).toEqual(horizontal.ticks.map(t => t.label));
    vertical.ticks.forEach((t, i) => expect(t.offset).toBeCloseTo(horizontal.ticks[i].offset, 9));
  });

  it('labels viewport units when there are fewer pixels than units', () => {
    const camera = CanvasCamera.fit({ panel, viewport: { w: 512, h: 512 }, pixelRatio: 1 });
    const { ticks } = getRulerLayout(camera, 'horizontal');
    expect(ticks.map(t => t.label)).toEqual(['0', '100', '200', '300', '400', '500']);
    expect(ticks[1].offset).toBeCloseTo(12 + 100 * camera.scale, 9);
  });

  it('follows the zoom and pan, and stays inside of the panel', () => {
    const camera = CanvasCamera.create({
      panel,
      viewport,
      pixelRatio: 1,
      view: { type: 'manual', scale: 100, center: { x: 12, y: 12 } },
    });
    const { rect, ticks } = getRulerLayout(camera, 'horizontal');
    expect(rect).toEqual({ x: 0, y: 0, w: 600, h: 32 });
    // The panel shows x from 9 to 15.
    expect(ticks.map(t => t.label)).toEqual(['9', '10', '11', '12', '13', '14', '15']);
    expect(ticks[3].offset).toBe(300);
  });
});
