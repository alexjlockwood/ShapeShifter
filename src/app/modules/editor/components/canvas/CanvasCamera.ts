import { Matrix, Point } from 'app/modules/editor/scripts/common';
import {
  type CanvasView,
  FIT_VIEW,
  type ManualView,
} from 'app/modules/editor/services/canvasviewport.service';
import { clamp } from 'lodash-es';

export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// The space around the artboard when it's fit to its panel, in CSS pixels.
export const FIT_MARGIN = 36;

// The zoom range, in CSS pixels per viewport unit, from 2% to 25600% like Figma. Fitting a tiny
// or a huge viewport can go past it, and zooming from there only goes back toward it.
export const MIN_SCALE = 0.02;
export const MAX_SCALE = 256;

interface FitOptions {
  /** The panel's size in CSS pixels. */
  readonly panel: Size;
  /** The vector layer's width and height. */
  readonly viewport: Size;
  /** Device pixels per CSS pixel in the canvases' backing stores. */
  readonly pixelRatio: number;
  readonly margin?: number;
}

interface CreateOptions extends FitOptions {
  readonly view?: CanvasView;
}

/**
 * Maps between a canvas's three coordinate spaces:
 *
 * - Viewport coordinates are the vector layer's own units, with the artboard from (0, 0) to its
 *   width and height.
 * - Panel coordinates are CSS pixels from the top left of the canvas's panel, which the canvases
 *   cover.
 * - Device coordinates are pixels in the canvases' backing stores.
 *
 * The camera for a view is immutable. Zooming and panning return a new view, and the canvas makes a
 * new camera for it.
 */
export class CanvasCamera {
  /** Shows the view in the panel. */
  static create({ view = FIT_VIEW, ...options }: CreateOptions) {
    if (view.type === 'fit') {
      return CanvasCamera.fit(options);
    }
    const panel = { w: toNonNegative(options.panel.w), h: toNonNegative(options.panel.h) };
    const viewport = { w: toPositive(options.viewport.w), h: toPositive(options.viewport.h) };
    const pixelRatio = toPositive(options.pixelRatio);
    const scale = toPositive(view.scale);
    const center = clampCenter(viewport, view.center);
    const origin = { x: panel.w / 2 - center.x * scale, y: panel.h / 2 - center.y * scale };
    return new CanvasCamera(panel, viewport, pixelRatio, scale, origin);
  }

  /**
   * Centers the artboard in the panel at the largest size that leaves a margin around it. The
   * artboard's top left corner is snapped to a device pixel, so that its edges and the pixel grid
   * stay sharp.
   */
  static fit({ panel, viewport, pixelRatio, margin = FIT_MARGIN }: FitOptions) {
    panel = { w: toNonNegative(panel.w), h: toNonNegative(panel.h) };
    viewport = { w: toPositive(viewport.w), h: toPositive(viewport.h) };
    pixelRatio = toPositive(pixelRatio);
    const scale = Math.min(
      Math.max(1, panel.w - margin * 2) / viewport.w,
      Math.max(1, panel.h - margin * 2) / viewport.h,
    );
    const origin = {
      x: (panel.w - viewport.w * scale) / 2,
      y: (panel.h - viewport.h * scale) / 2,
    };
    return new CanvasCamera(panel, viewport, pixelRatio, scale, origin);
  }

  private constructor(
    readonly panel: Size,
    readonly viewport: Size,
    readonly pixelRatio: number,
    /** CSS pixels per viewport unit. */
    readonly scale: number,
    /** The panel coordinates of the viewport's origin, before it's snapped to a device pixel. */
    private readonly exactOrigin: Point,
  ) {
    const snap = (n: number) => Math.round(n * pixelRatio) / pixelRatio;
    this.origin = { x: snap(exactOrigin.x), y: snap(exactOrigin.y) };
  }

  /**
   * The panel coordinates of the viewport's origin, snapped to a device pixel so that the
   * artboard's edges and the pixel grid stay sharp.
   */
  private readonly origin: Point;

  /** Device pixels per viewport unit. */
  get deviceScale() {
    return this.scale * this.pixelRatio;
  }

  /** The size of the canvases' backing stores. */
  getDeviceSize(): Size {
    return {
      w: Math.round(this.panel.w * this.pixelRatio),
      h: Math.round(this.panel.h * this.pixelRatio),
    };
  }

  /** The artboard's bounds in panel coordinates. */
  getArtboardRect(): Rect {
    return {
      x: this.origin.x,
      y: this.origin.y,
      w: this.viewport.w * this.scale,
      h: this.viewport.h * this.scale,
    };
  }

  viewportToPanel({ x, y }: Point): Point {
    return { x: this.origin.x + x * this.scale, y: this.origin.y + y * this.scale };
  }

  panelToViewport({ x, y }: Point): Point {
    return { x: (x - this.origin.x) / this.scale, y: (y - this.origin.y) / this.scale };
  }

  viewportToDevice(point: Point): Point {
    const { x, y } = this.viewportToPanel(point);
    return { x: x * this.pixelRatio, y: y * this.pixelRatio };
  }

  /** Converts a length in CSS pixels, like a hit tolerance or a line width, to viewport units. */
  toViewportLength(length: number) {
    return length / this.scale;
  }

  /** Returns the transform from viewport coordinates to device coordinates. */
  getDeviceTransform() {
    const { deviceScale, pixelRatio, origin } = this;
    return new Matrix(deviceScale, 0, 0, deviceScale, origin.x * pixelRatio, origin.y * pixelRatio);
  }

  /**
   * Returns what this camera shows as a view, e.g. to start zooming from fit. It's from before the
   * snapping, so that pans of less than half a device pixel add up.
   */
  getView(): ManualView {
    const { panel, scale, exactOrigin } = this;
    const center = {
      x: (panel.w / 2 - exactOrigin.x) / scale,
      y: (panel.h / 2 - exactOrigin.y) / scale,
    };
    return { type: 'manual', scale, center };
  }

  /** Zooms to the scale, keeping the viewport point under the panel point where it is. */
  zoomAround(panelPoint: Point, scale: number): ManualView {
    // A scale outside of the range stays there until it's zoomed back toward it, rather than
    // jumping, e.g. zooming in on a tiny viewport that fits at more than the maximum.
    scale = clamp(
      toPositive(scale),
      Math.min(MIN_SCALE, this.scale),
      Math.max(MAX_SCALE, this.scale),
    );
    const { x, y } = this.panelToViewport(panelPoint);
    const center = {
      x: x - (panelPoint.x - this.panel.w / 2) / scale,
      y: y - (panelPoint.y - this.panel.h / 2) / scale,
    };
    return { type: 'manual', scale, center: clampCenter(this.viewport, center) };
  }

  /** Zooms to the scale around the middle of the panel. */
  zoomTo(scale: number) {
    return this.zoomAround({ x: this.panel.w / 2, y: this.panel.h / 2 }, scale);
  }

  /** Moves the artboard by a distance in CSS pixels. */
  panBy(dx: number, dy: number): ManualView {
    const { center } = this.getView();
    const pannedCenter = { x: center.x - dx / this.scale, y: center.y - dy / this.scale };
    return { type: 'manual', scale: this.scale, center: clampCenter(this.viewport, pannedCenter) };
  }
}

/**
 * Keeps the middle of the panel on the artboard, so that panning can't lose it. A center that
 * isn't a number is moved to the middle of the artboard.
 */
export function clampCenter(viewport: Size, { x, y }: Point): Point {
  return {
    x: Number.isFinite(x) ? clamp(x, 0, viewport.w) : viewport.w / 2,
    y: Number.isFinite(y) ? clamp(y, 0, viewport.h) : viewport.h / 2,
  };
}

/**
 * Returns the next scale to zoom in (1) or out (-1) to. Zoom steps are powers of two, so 100% is
 * always one of them.
 */
export function getZoomStep(scale: number, direction: 1 | -1) {
  // A scale just short of a step, like 7.999, goes past it, rather than zooming by 0.01%.
  const exponent = Math.log2(scale);
  const next =
    2 ** (direction > 0 ? Math.floor(exponent + 0.01) + 1 : Math.ceil(exponent - 0.01) - 1);
  // A scale outside the range, e.g. from fitting a tiny viewport, never zooms the wrong way.
  return direction > 0
    ? Math.max(scale, Math.min(next, MAX_SCALE))
    : Math.min(scale, Math.max(next, MIN_SCALE));
}

// A panel that isn't laid out yet, or is hidden, has no size.
function toNonNegative(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Vector layers from imported files and old projects aren't validated.
function toPositive(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 1;
}
