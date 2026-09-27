import { MathUtil } from 'app/modules/editor/scripts/common';
import type { ManualView } from 'app/modules/editor/services/canvasviewport.service';
import { describe, expect, it } from 'vitest';

import { CanvasCamera, clampCenter, getZoomStep, MAX_SCALE, MIN_SCALE } from './CanvasCamera';

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

describe('CanvasCamera views', () => {
  const panel = { w: 600, h: 400 };

  it('shows a view at its scale, around its center', () => {
    const camera = CanvasCamera.create({
      panel,
      viewport: VIEWPORT,
      pixelRatio: 1,
      view: { type: 'manual', scale: 40, center: { x: 12, y: 6 } },
    });
    expect(camera.scale).toBe(40);
    expect(camera.viewportToPanel({ x: 12, y: 6 })).toEqual({ x: 300, y: 200 });
    expect(camera.getView()).toEqual({ type: 'manual', scale: 40, center: { x: 12, y: 6 } });
  });

  it('fits by default', () => {
    const camera = CanvasCamera.create({ panel, viewport: VIEWPORT, pixelRatio: 1 });
    expect(camera.getArtboardRect()).toEqual({ x: 136, y: 36, w: 328, h: 328 });
    // The same view as a scale and center, e.g. to start zooming from.
    const view = camera.getView();
    expect(view.scale).toBe(328 / 24);
    expect(view.center.x).toBeCloseTo(12, 9);
    expect(view.center.y).toBeCloseTo(12, 9);
  });

  it('keeps the point under the cursor in place when zooming', () => {
    const camera = CanvasCamera.create({ panel, viewport: VIEWPORT, pixelRatio: 1 });
    const cursor = { x: 200, y: 100 };
    const before = camera.panelToViewport(cursor);
    const view = camera.zoomAround(cursor, 64);
    const zoomed = CanvasCamera.create({ panel, viewport: VIEWPORT, pixelRatio: 1, view });
    expect(zoomed.scale).toBe(64);
    // Within half a pixel, since the artboard is kept on a device pixel.
    expect(Math.abs(zoomed.viewportToPanel(before).x - cursor.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(zoomed.viewportToPanel(before).y - cursor.y)).toBeLessThanOrEqual(0.5);
  });

  it('zooms around the middle of the panel', () => {
    const camera = CanvasCamera.create({
      panel,
      viewport: VIEWPORT,
      pixelRatio: 1,
      view: { type: 'manual', scale: 10, center: { x: 6, y: 18 } },
    });
    expect(camera.zoomTo(1)).toEqual({ type: 'manual', scale: 1, center: { x: 6, y: 18 } });
  });

  it('pans by a distance in CSS pixels', () => {
    const camera = CanvasCamera.create({
      panel,
      viewport: VIEWPORT,
      pixelRatio: 1,
      view: { type: 'manual', scale: 10, center: { x: 12, y: 12 } },
    });
    // Moving the artboard right and down moves the view's center left and up.
    expect(camera.panBy(20, 40)).toEqual({ type: 'manual', scale: 10, center: { x: 10, y: 8 } });
  });

  it('keeps the middle of the panel on the artboard', () => {
    const camera = CanvasCamera.create({
      panel,
      viewport: VIEWPORT,
      pixelRatio: 1,
      view: { type: 'manual', scale: 10, center: { x: 100, y: -5 } },
    });
    expect(camera.getView().center).toEqual({ x: 24, y: 0 });
    expect(camera.panBy(-1000, 1000).center).toEqual({ x: 24, y: 0 });
    expect(clampCenter(VIEWPORT, { x: NaN, y: 3 })).toEqual({ x: 12, y: 3 });
  });

  it('limits the zoom', () => {
    const view = (scale: number) =>
      CanvasCamera.create({
        panel,
        viewport: VIEWPORT,
        pixelRatio: 1,
        view: { type: 'manual', scale, center: { x: 12, y: 12 } },
      });
    expect(view(10).zoomTo(1000).scale).toBe(MAX_SCALE);
    expect(view(10).zoomTo(0.001).scale).toBe(MIN_SCALE);
    expect(view(0).scale).toBe(1);
  });

  it('only zooms a scale outside of the range back toward it', () => {
    // A half-unit viewport fits at 656 CSS pixels per unit, past the maximum.
    const fit = CanvasCamera.create({ panel, viewport: { w: 0.5, h: 0.5 }, pixelRatio: 1 });
    expect(fit.scale).toBe(656);
    expect(fit.zoomTo(getZoomStep(fit.scale, 1)).scale).toBe(656);
    expect(fit.zoomAround({ x: 10, y: 10 }, 1000).scale).toBe(656);
    expect(fit.zoomTo(getZoomStep(fit.scale, -1)).scale).toBe(512);
  });

  it('adds up pans of less than half a pixel', () => {
    let view: ManualView = { type: 'manual', scale: 10, center: { x: 12, y: 12 } };
    const create = () => CanvasCamera.create({ panel, viewport: VIEWPORT, pixelRatio: 1, view });
    const { x } = create().getArtboardRect();
    for (let i = 0; i < 5; i++) {
      view = create().panBy(0.4, 0);
    }
    expect(create().getArtboardRect().x).toBe(x + 2);
  });
});

describe('getZoomStep', () => {
  it('steps through powers of two', () => {
    expect(getZoomStep(1, 1)).toBe(2);
    expect(getZoomStep(1, -1)).toBe(0.5);
    expect(getZoomStep(13.7, 1)).toBe(16);
    expect(getZoomStep(13.7, -1)).toBe(8);
  });

  it("doesn't take tiny steps from just short of a power of two", () => {
    expect(getZoomStep(7.9999, 1)).toBe(16);
    expect(getZoomStep(8.0001, -1)).toBe(4);
  });

  it('stays in range, and never zooms the wrong way from outside of it', () => {
    expect(getZoomStep(MAX_SCALE, 1)).toBe(MAX_SCALE);
    expect(getZoomStep(MIN_SCALE, -1)).toBe(MIN_SCALE);
    expect(getZoomStep(900, 1)).toBe(900);
    expect(getZoomStep(900, -1)).toBe(512);
  });
});
