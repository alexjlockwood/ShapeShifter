import { MathUtil } from 'app/modules/editor/scripts/common';
import { describe, expect, it } from 'vitest';

import { CanvasCamera } from './CanvasCamera';

const VIEWPORT = { w: 24, h: 24 };

describe('CanvasCamera', () => {
  it('fits the artboard in the middle of the panel, with a margin around it', () => {
    const camera = CanvasCamera.fit({
      panel: { w: 600, h: 400 },
      viewport: VIEWPORT,
      pixelRatio: 1,
    });
    // The panel's height minus the margins.
    expect(camera.scale).toBe(328 / 24);
    expect(camera.getArtboardRect()).toEqual({ x: 136, y: 36, w: 328, h: 328 });
  });

  it('fits a wide viewport to the width of the panel', () => {
    const camera = CanvasCamera.fit({
      panel: { w: 600, h: 400 },
      viewport: { w: 48, h: 12 },
      pixelRatio: 1,
    });
    expect(camera.scale).toBe(528 / 48);
    expect(camera.getArtboardRect()).toEqual({ x: 36, y: 134, w: 528, h: 132 });
  });

  it('puts the artboard on a device pixel', () => {
    const panel = { w: 601, h: 400 };
    expect(CanvasCamera.fit({ panel, viewport: VIEWPORT, pixelRatio: 1 }).getArtboardRect().x).toBe(
      137,
    );
    expect(CanvasCamera.fit({ panel, viewport: VIEWPORT, pixelRatio: 2 }).getArtboardRect().x).toBe(
      136.5,
    );
  });

  it('converts between viewport, panel, and device coordinates', () => {
    const camera = CanvasCamera.fit({
      panel: { w: 600, h: 400 },
      viewport: VIEWPORT,
      pixelRatio: 2,
    });
    const point = { x: 12, y: 6 };
    const panelPoint = camera.viewportToPanel(point);
    expect(panelPoint).toEqual({ x: 136 + 12 * camera.scale, y: 36 + 6 * camera.scale });
    expect(camera.panelToViewport(panelPoint).x).toBeCloseTo(12, 9);
    expect(camera.panelToViewport(panelPoint).y).toBeCloseTo(6, 9);
    expect(camera.viewportToDevice(point)).toEqual({ x: panelPoint.x * 2, y: panelPoint.y * 2 });
    const devicePoint = MathUtil.transformPoint(point, camera.getDeviceTransform());
    expect(devicePoint.x).toBeCloseTo(panelPoint.x * 2, 6);
    expect(devicePoint.y).toBeCloseTo(panelPoint.y * 2, 6);
    expect(camera.deviceScale).toBe(camera.scale * 2);
    expect(camera.toViewportLength(camera.scale * 3)).toBe(3);
  });

  it('sizes the backing store in whole device pixels', () => {
    const camera = CanvasCamera.fit({
      panel: { w: 433.33, h: 100.2 },
      viewport: VIEWPORT,
      pixelRatio: 2,
    });
    expect(camera.getDeviceSize()).toEqual({ w: 867, h: 200 });
  });

  it('handles panels too small for the margin', () => {
    const camera = CanvasCamera.fit({ panel: { w: 50, h: 50 }, viewport: VIEWPORT, pixelRatio: 1 });
    expect(camera.scale).toBe(1 / 24);
    expect(camera.getArtboardRect()).toEqual({ x: 25, y: 25, w: 1, h: 1 });
  });

  it('handles panels that have no size, and bad viewports and pixel ratios', () => {
    const camera = CanvasCamera.fit({
      panel: { w: 0, h: NaN },
      viewport: { w: 0, h: Infinity },
      pixelRatio: NaN,
    });
    expect(camera.panel).toEqual({ w: 0, h: 0 });
    expect(camera.viewport).toEqual({ w: 1, h: 1 });
    expect(camera.pixelRatio).toBe(1);
    expect(camera.getDeviceSize()).toEqual({ w: 0, h: 0 });
    const { x, y, w, h } = camera.getArtboardRect();
    expect([x, y, w, h].every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(camera.panelToViewport({ x: 10, y: 10 }).x)).toBe(true);
  });
});
