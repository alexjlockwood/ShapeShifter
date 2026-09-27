import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import { getCanvasPixelRatio, getContext2d } from 'app/modules/editor/scripts/dom';
import { ThemeService } from 'app/modules/editor/services';

import { CanvasCamera, Rect } from './CanvasCamera';

// All dimensions are in CSS pixels.
const RULER_SIZE = 32;
const EXTRA_RULER_PADDING = 12;
const MIN_TICK_SPACING = 40;
const LABEL_OFFSET = 12;
const TICK_SIZE = 6;

// Tick intervals in viewport units. The small ones suit icons, which are often 24 units wide.
const RULER_INTERVALS: ReadonlyArray<number> = [1, 2, 4, 8, 16, 24, 48, 100, 250, 500];

/**
 * Returns the smallest tick interval, in viewport units, that leaves room for the labels at the
 * scale (CSS pixels per viewport unit).
 */
export function getRulerInterval(scale: number) {
  const minInterval = MIN_TICK_SPACING / scale;
  const interval = RULER_INTERVALS.find(i => i >= minInterval);
  if (interval !== undefined) {
    return interval;
  }
  // Past the end of the table, the intervals go 1000, 2500, 5000, 10000, and so on.
  const power = 10 ** Math.floor(Math.log10(minInterval));
  return [1, 2.5, 5, 10].map(m => m * power).find(i => i >= minInterval) ?? Infinity;
}

export interface RulerLayout {
  /** The ruler's bounds in panel coordinates. */
  readonly rect: Rect;
  /** Where the ticks are, in CSS pixels from the start of the ruler, and their labels. */
  readonly ticks: ReadonlyArray<{ readonly offset: number; readonly label: string }>;
}

/**
 * Lays the ruler out along the artboard's top or left edge, a little past each end of it. It
 * stays inside of the panel, so a ruler for an artboard that's bigger than the panel runs along
 * the panel's edge.
 */
export function getRulerLayout(camera: CanvasCamera, orientation: Orientation): RulerLayout {
  const isHorizontal = orientation === 'horizontal';
  const { x, y, w, h } = camera.getArtboardRect();
  const [artboardStart, artboardLength, artboardSide] = isHorizontal ? [x, w, y] : [y, h, x];
  const panelLength = isHorizontal ? camera.panel.w : camera.panel.h;
  const start = Math.max(0, artboardStart - EXTRA_RULER_PADDING);
  const end = Math.min(panelLength, artboardStart + artboardLength + EXTRA_RULER_PADDING);
  const length = Math.max(0, end - start);
  const side = Math.max(0, artboardSide - RULER_SIZE);
  const rect = isHorizontal
    ? { x: start, y: side, w: length, h: RULER_SIZE }
    : { x: side, y: start, w: RULER_SIZE, h: length };

  // The ticks go from 0 to the viewport's width or height, and only the ones on the ruler are
  // drawn.
  const toViewport = (offset: number) => {
    const point = camera.panelToViewport({ x: start + offset, y: start + offset });
    return isHorizontal ? point.x : point.y;
  };
  const toOffset = (t: number) => {
    const point = camera.viewportToPanel({ x: t, y: t });
    return (isHorizontal ? point.x : point.y) - start;
  };
  const ticks: { offset: number; label: string }[] = [];
  const interval = getRulerInterval(camera.scale);
  const first = Math.max(0, Math.ceil(toViewport(0) / interval) * interval);
  const last = Math.min(isHorizontal ? camera.viewport.w : camera.viewport.h, toViewport(length));
  for (let t = first; t <= last; t += interval) {
    const offset = toOffset(t);
    if (0 <= offset && offset <= length) {
      ticks.push({ offset, label: t.toString() });
    }
  }
  return { rect, ticks };
}

/**
 * Draws a ruler along one of the artboard's edges.
 */
export class CanvasRuler {
  private camera: CanvasCamera | undefined;
  // The current mouse point in viewport coordinates.
  private vpMousePoint: Point | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly orientation: Orientation,
    private readonly themeService: ThemeService,
  ) {}

  setCamera(camera: CanvasCamera) {
    this.camera = camera;
    this.draw();
  }

  hideMouse() {
    if (this.vpMousePoint) {
      this.vpMousePoint = undefined;
      this.draw();
    }
  }

  showMouse(mousePoint: Point) {
    if (!this.vpMousePoint || !MathUtil.arePointsEqual(this.vpMousePoint, mousePoint)) {
      this.vpMousePoint = mousePoint;
      this.draw();
    }
  }

  private draw() {
    const { camera } = this;
    if (!camera) {
      return;
    }
    const isHorizontal = this.orientation === 'horizontal';
    const { rect, ticks } = getRulerLayout(camera, this.orientation);
    // The ruler is inside of the artboard, so that hovering over it keeps it showing.
    const artboard = camera.getArtboardRect();
    const { style } = this.canvas;
    style.left = `${rect.x - artboard.x}px`;
    style.top = `${rect.y - artboard.y}px`;
    style.width = `${rect.w}px`;
    style.height = `${rect.h}px`;
    const pixelRatio = getCanvasPixelRatio(rect.w, rect.h);
    this.canvas.setAttribute('width', `${rect.w * pixelRatio}`);
    this.canvas.setAttribute('height', `${rect.h * pixelRatio}`);

    const ctx = getContext2d(this.canvas);
    ctx.scale(pixelRatio, pixelRatio);

    // Text labels.
    ctx.fillStyle = this.themeService.getDisabledTextColor();
    ctx.font = '10px Roboto, Helvetica Neue, sans-serif';
    if (isHorizontal) {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      for (const { offset, label } of ticks) {
        ctx.fillText(label, offset, rect.h - LABEL_OFFSET);
        ctx.fillRect(offset - 0.5, rect.h - TICK_SIZE, 1, TICK_SIZE);
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (const { offset, label } of ticks) {
        ctx.fillText(label, rect.w - LABEL_OFFSET, offset);
        ctx.fillRect(rect.w - TICK_SIZE, offset - 0.5, TICK_SIZE, 1);
      }
    }

    if (this.vpMousePoint) {
      const { x, y } = this.vpMousePoint;
      const point = camera.viewportToPanel(this.vpMousePoint);
      ctx.fillStyle = this.themeService.getSecondaryTextColor();
      if (isHorizontal) {
        ctx.fillText(x.toString(), point.x - rect.x, rect.h - LABEL_OFFSET);
      } else {
        ctx.fillText(y.toString(), rect.w - LABEL_OFFSET, point.y - rect.y);
      }
    }
  }
}

export type Orientation = 'horizontal' | 'vertical';
