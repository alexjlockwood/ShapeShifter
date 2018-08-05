import { Directive, ElementRef, Input } from '@angular/core';
import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import { ThemeService } from 'app/modules/editor/services';
import * as $ from 'jquery';

import { CanvasLayoutMixin } from './CanvasLayoutMixin';

// All dimensions are in CSS pixels.
const RULER_SIZE = 32;
const EXTRA_RULER_PADDING = 12;
const GRID_INTERVALS_PX: ReadonlyArray<number> = [1, 2, 4, 8, 16, 24, 48, 100, 100, 250];
const LABEL_OFFSET = 12;
const TICK_SIZE = 6;

@Directive({ selector: '[appCanvasRuler]' })
export class CanvasRulerDirective extends CanvasLayoutMixin() {
  @Input()
  orientation: Orientation;

  private readonly $canvas: JQuery<HTMLCanvasElement>;

  // The current mouse point in viewport coordinates.
  private vpMousePoint: Point;

  constructor(elementRef: ElementRef, private readonly themeService: ThemeService) {
    super();
    this.$canvas = $(elementRef.nativeElement) as JQuery<HTMLCanvasElement>;
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
    this.$canvas.css({ width, height });
    this.$canvas.attr({ width: width * devicePixelRatio, height: height * devicePixelRatio });

    const ctx = this.$canvas.get(0).getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);
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
