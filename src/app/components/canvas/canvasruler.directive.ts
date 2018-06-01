import { Directive, ElementRef, Input } from '@angular/core';
import { MathUtil, Point } from 'app/scripts/common';
import { ThemeService } from 'app/services';
import * as $ from 'jquery';

import { CanvasLayoutMixin } from './CanvasLayoutMixin';

// All dimensions are in CSS pixels.
const RULER_SIZE = 32;
// TODO: rename to 'EXTRA_RULER_PADDING'
const EXTRA_PADDING = 12;
const GRID_INTERVALS_PX: ReadonlyArray<number> = [1, 2, 4, 8, 16, 24, 48, 100, 100, 250];
const LABEL_OFFSET = 12;
const TICK_SIZE = 6;

@Directive({
  selector: '[appCanvasRuler]',
})
export class CanvasRulerDirective extends CanvasLayoutMixin() {
  @Input() orientation: Orientation;

  private readonly $canvas: JQuery<HTMLCanvasElement>;

  // TODO: rename to 'vpMousePoint'
  // The current mouse point in viewport coordinates.
  private mousePoint: Point;

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
    if (this.mousePoint) {
      this.mousePoint = undefined;
      this.draw();
    }
  }

  // TODO: need to transform mouse point to account for zoom and translation
  showMouse(mousePoint: Point) {
    if (!this.mousePoint || !MathUtil.arePointsEqual(this.mousePoint, mousePoint)) {
      this.mousePoint = mousePoint;
      this.draw();
    }
  }

  private draw() {
    const { w: vlWidth, h: vlHeight } = this.getViewport();
    const isHorizontal = this.orientation === 'horizontal';
    const z = this.getZoom();
    const width = isHorizontal ? vlWidth * this.cssScale * z + EXTRA_PADDING * 2 : RULER_SIZE;
    const height = isHorizontal ? RULER_SIZE : vlHeight * this.cssScale * z + EXTRA_PADDING * 2;
    this.$canvas.css({ width, height });
    this.$canvas.attr({
      width: width * devicePixelRatio,
      height: height * devicePixelRatio,
    });

    const ctx = this.$canvas.get(0).getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const { tx, ty } = this.getTranslation();
    ctx.translate(isHorizontal ? tx + EXTRA_PADDING : 0, isHorizontal ? 0 : ty + EXTRA_PADDING);

    const widthMinusPadding = width - EXTRA_PADDING * 2;
    const heightMinusPadding = height - EXTRA_PADDING * 2;
    // TODO: rename 'rulerZoom'
    const zoom = Math.max(
      1,
      isHorizontal ? widthMinusPadding / vlWidth : heightMinusPadding / vlHeight,
    );

    // TODO: change the grid spacing depending on the current zoom?
    // Compute grid spacing (40 = minimum grid spacing in pixels).
    let interval = 0;
    // TODO: rename to 'spacingViewportPx'
    let spacingArtPx = GRID_INTERVALS_PX[interval];
    while (spacingArtPx * zoom < 40 || interval >= GRID_INTERVALS_PX.length) {
      interval++;
      spacingArtPx = GRID_INTERVALS_PX[interval];
    }

    const spacingRulerPx = spacingArtPx * zoom;

    const roundFn = (n: number) => MathUtil.round(n);

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
        roundFn(x) <= roundFn(width - EXTRA_PADDING * 2);
        x += spacingRulerPx, t += spacingArtPx
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
        roundFn(y) <= roundFn(height - EXTRA_PADDING * 2);
        y += spacingRulerPx, t += spacingArtPx
      ) {
        if (minY <= y && y <= maxY) {
          ctx.fillText(t.toString(), width - LABEL_OFFSET, y);
          ctx.fillRect(width - TICK_SIZE, y - 0.5, TICK_SIZE, 1);
        }
      }
    }

    if (this.mousePoint) {
      const { x, y } = this.mousePoint;
      ctx.fillStyle = this.themeService.getSecondaryTextColor();
      if (isHorizontal) {
        ctx.fillText(x.toString(), x * zoom, height - LABEL_OFFSET);
      } else {
        ctx.fillText(y.toString(), width - LABEL_OFFSET, y * zoom);
      }
    }
  }
}

export type Orientation = 'horizontal' | 'vertical';
