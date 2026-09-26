import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import { getCanvasPixelRatio, getContext2d } from 'app/modules/editor/scripts/dom';
import { ThemeService } from 'app/modules/editor/services';

import { CanvasLayoutMixin } from './CanvasLayoutMixin';

// All dimensions are in CSS pixels.
const RULER_SIZE = 32;
const EXTRA_RULER_PADDING = 12;
const GRID_INTERVALS_PX: ReadonlyArray<number> = [1, 2, 4, 8, 16, 24, 48, 100, 100, 250];
const LABEL_OFFSET = 12;
const TICK_SIZE = 6;

/**
 * Draws a ruler along one of the canvas' edges.
 */
export class CanvasRuler extends CanvasLayoutMixin() {
  // The current mouse point in viewport coordinates.
  private vpMousePoint: Point | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly orientation: Orientation,
    private readonly themeService: ThemeService,
  ) {
    super();
  }

  // @Override
  protected onDimensionsChanged() {
    this.draw();
  }

  // @Override
  protected onZoomPanChanged() {
    this.draw();
  }

  hideMouse() {
    if (this.vpMousePoint) {
      this.vpMousePoint = undefined;
      this.draw();
    }
  }

  // TODO: need to transform mouse point to account for zoom and translation
  showMouse(mousePoint: Point) {
    if (!this.vpMousePoint || !MathUtil.arePointsEqual(this.vpMousePoint, mousePoint)) {
      this.vpMousePoint = mousePoint;
      this.draw();
    }
  }

  private draw() {
    const isHorizontal = this.orientation === 'horizontal';

    const viewport = this.getViewport();
    const zoom = this.getZoom();
    const { cssScale } = this;
    const width = isHorizontal
      ? viewport.w * cssScale * zoom + EXTRA_RULER_PADDING * 2
      : RULER_SIZE;
    const height = isHorizontal
      ? RULER_SIZE
      : viewport.h * cssScale * zoom + EXTRA_RULER_PADDING * 2;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    const pixelRatio = getCanvasPixelRatio(width, height);
    this.canvas.setAttribute('width', `${width * pixelRatio}`);
    this.canvas.setAttribute('height', `${height * pixelRatio}`);

    const ctx = getContext2d(this.canvas);
    ctx.scale(pixelRatio, pixelRatio);
    const { tx, ty } = this.getTranslation();
    ctx.translate(
      isHorizontal ? tx + EXTRA_RULER_PADDING : 0,
      isHorizontal ? 0 : ty + EXTRA_RULER_PADDING,
    );

    const widthMinusPadding = width - EXTRA_RULER_PADDING * 2;
    const heightMinusPadding = height - EXTRA_RULER_PADDING * 2;
    const rulerZoom = Math.max(
      1,
      isHorizontal ? widthMinusPadding / viewport.w : heightMinusPadding / viewport.h,
    );

    // TODO: change the grid spacing depending on the current zoom?
    // Compute grid spacing (40 = minimum grid spacing in pixels).
    let interval = 0;
    let spacingViewportPx = GRID_INTERVALS_PX[interval];
    while (spacingViewportPx * rulerZoom < 40 || interval >= GRID_INTERVALS_PX.length) {
      interval++;
      spacingViewportPx = GRID_INTERVALS_PX[interval];
    }

    const spacingRulerPx = spacingViewportPx * rulerZoom;

    // Text labels.
    ctx.fillStyle = this.themeService.getDisabledTextColor();
    ctx.font = '10px Roboto, Helvetica Neue, sans-serif';
    if (isHorizontal) {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      const minX = -tx;
      const maxX = minX + widthMinusPadding / zoom;
      for (
        let x = 0, t = 0;
        MathUtil.round(x) <= MathUtil.round(width - EXTRA_RULER_PADDING * 2);
        x += spacingRulerPx, t += spacingViewportPx
      ) {
        if (minX <= x && x <= maxX) {
          ctx.fillText(t.toString(), x, height - LABEL_OFFSET);
          ctx.fillRect(x - 0.5, height - TICK_SIZE, 1, TICK_SIZE);
        }
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      const minY = -ty;
      const maxY = minY + heightMinusPadding / zoom;
      for (
        let y = 0, t = 0;
        MathUtil.round(y) <= MathUtil.round(height - EXTRA_RULER_PADDING * 2);
        y += spacingRulerPx, t += spacingViewportPx
      ) {
        if (minY <= y && y <= maxY) {
          ctx.fillText(t.toString(), width - LABEL_OFFSET, y);
          ctx.fillRect(width - TICK_SIZE, y - 0.5, TICK_SIZE, 1);
        }
      }
    }

    if (this.vpMousePoint) {
      const { x, y } = this.vpMousePoint;
      ctx.fillStyle = this.themeService.getSecondaryTextColor();
      if (isHorizontal) {
        ctx.fillText(x.toString(), x * rulerZoom, height - LABEL_OFFSET);
      } else {
        ctx.fillText(y.toString(), width - LABEL_OFFSET, y * rulerZoom);
      }
    }
  }
}

export type Orientation = 'horizontal' | 'vertical';
