import { Directive, ElementRef, Input } from '@angular/core';
import { MathUtil, Point } from 'app/scripts/common';
import { PaperService, ThemeService } from 'app/services';
import * as $ from 'jquery';
import * as _ from 'lodash';

import { CanvasLayoutMixin } from './CanvasLayoutMixin';

// Ruler size in css pixels.
const RULER_SIZE = 32;
// Extra ruler padding in css pixels.
const EXTRA_PADDING = 12;
const GRID_INTERVALS_PX = [1, 2, 4, 8, 16, 24, 48, 100, 100, 250];
const LABEL_OFFSET = 12;
const TICK_SIZE = 6;

@Directive({
  selector: '[appCanvasRuler]',
})
export class CanvasRulerDirective extends CanvasLayoutMixin() {
  @Input() orientation: Orientation;

  private readonly $canvas: JQuery<HTMLCanvasElement>;
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

  draw() {
    const zoom = this.getZoom();
    const { w: vlWidth, h: vlHeight } = this.getViewport();
    const isHorizontal = this.orientation === 'horizontal';
    const width = isHorizontal ? vlWidth * this.cssScale * zoom + EXTRA_PADDING * 2 : RULER_SIZE;
    const height = isHorizontal ? RULER_SIZE : vlHeight * this.cssScale * zoom + EXTRA_PADDING * 2;
    this.$canvas.css({ width, height });
    this.$canvas.attr({ width: width * devicePixelRatio, height: height * devicePixelRatio });

    const ctx = this.$canvas.get(0).getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.translate(isHorizontal ? EXTRA_PADDING : 0, isHorizontal ? 0 : EXTRA_PADDING);
    const { tx, ty } = this.getTranslation();
    ctx.translate(isHorizontal ? tx : 0, isHorizontal ? 0 : ty);

    const rulerZoom = Math.max(
      1,
      isHorizontal
        ? (width - EXTRA_PADDING * 2) / vlWidth
        : (height - EXTRA_PADDING * 2) / vlHeight,
    );

    // Compute grid spacing (40 = minimum grid spacing in pixels).
    let interval = 0;
    let spacingArtPx = GRID_INTERVALS_PX[interval];
    while (spacingArtPx * rulerZoom < 40 || interval >= GRID_INTERVALS_PX.length) {
      interval++;
      spacingArtPx = GRID_INTERVALS_PX[interval];
    }

    const spacingRulerPx = spacingArtPx * rulerZoom;

    // Text labels.
    ctx.fillStyle = this.themeService.getDisabledTextColor();
    ctx.font = '10px Roboto, Helvetica Neue, sans-serif';
    if (isHorizontal) {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      for (
        let x = 0, t = 0;
        MathUtil.round(x) <= MathUtil.round(width - EXTRA_PADDING * 2);
        x += spacingRulerPx, t += spacingArtPx
      ) {
        ctx.fillText(t.toString(), x, height - LABEL_OFFSET);
        ctx.fillRect(x - 0.5, height - TICK_SIZE, 1, TICK_SIZE);
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (
        let y = 0, t = 0;
        MathUtil.round(y) <= MathUtil.round(height - EXTRA_PADDING * 2);
        y += spacingRulerPx, t += spacingArtPx
      ) {
        ctx.fillText(t.toString(), width - LABEL_OFFSET, y);
        ctx.fillRect(width - TICK_SIZE, y - 0.5, TICK_SIZE, 1);
      }
    }

    ctx.fillStyle = this.themeService.getSecondaryTextColor();
    const mouseX = this.mousePoint ? this.mousePoint.x : -1;
    const mouseY = this.mousePoint ? this.mousePoint.y : -1;
    if (isHorizontal && mouseX >= 0) {
      ctx.fillText(mouseX.toString(), mouseX * rulerZoom, height - LABEL_OFFSET);
    } else if (!isHorizontal && mouseY >= 0) {
      ctx.fillText(mouseY.toString(), width - LABEL_OFFSET, mouseY * rulerZoom);
    }
  }
}

export type Orientation = 'horizontal' | 'vertical';
