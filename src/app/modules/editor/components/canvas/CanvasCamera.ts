import { Matrix, Point } from 'app/modules/editor/scripts/common';

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

interface FitOptions {
  /** The panel's size in CSS pixels. */
  readonly panel: Size;
  /** The vector layer's width and height. */
  readonly viewport: Size;
  /** Device pixels per CSS pixel in the canvases' backing stores. */
  readonly pixelRatio: number;
  readonly margin?: number;
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
 * Only fitting the artboard to the panel is supported for now.
 */
export class CanvasCamera {
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
    const snap = (n: number) => Math.round(n * pixelRatio) / pixelRatio;
    const origin = {
      x: snap((panel.w - viewport.w * scale) / 2),
      y: snap((panel.h - viewport.h * scale) / 2),
    };
    return new CanvasCamera(panel, viewport, pixelRatio, scale, origin);
  }

  private constructor(
    readonly panel: Size,
    readonly viewport: Size,
    readonly pixelRatio: number,
    /** CSS pixels per viewport unit. */
    readonly scale: number,
    /** The panel coordinates of the viewport's origin. */
    private readonly origin: Point,
  ) {}

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
}

// A panel that isn't laid out yet, or is hidden, has no size.
function toNonNegative(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Vector layers from imported files and old projects aren't validated.
function toPositive(n: number) {
  return Number.isFinite(n) && n > 0 ? n : 1;
}
