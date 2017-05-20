import * as $ from 'jquery';
import { Directive, ElementRef, AfterViewInit, Input } from '@angular/core';
import { CanvasSizeMixin, Size } from './CanvasSizeMixin';
import { DestroyableMixin } from '../scripts/mixins';
import { Observable } from 'rxjs/Observable';

const SPLIT_POINT_RADIUS_FACTOR = 0.8;
// const SELECTED_POINT_RADIUS_FACTOR = 1.25;
// const POINT_BORDER_FACTOR = 1.075;
// const DISABLED_ALPHA = 0.38;

// The line width of a highlight in css pixels.
const HIGHLIGHT_LINE_WIDTH = 6;
// The distance of a mouse gesture that triggers a drag, in css pixels.
const DRAG_TRIGGER_TOUCH_SLOP = 6;
// The minimum distance between a point and a path that causes a snap.
const MIN_SNAP_THRESHOLD = 12;
// The radius of a medium point in css pixels.
const MEDIUM_POINT_RADIUS = 8;
// The radius of a small point in css pixels.
const SMALL_POINT_RADIUS = MEDIUM_POINT_RADIUS / 1.7;

// const NORMAL_POINT_COLOR = '#2962FF'; // Blue A400
// const SPLIT_POINT_COLOR = '#E65100'; // Orange 900
// const HIGHLIGHT_COLOR = '#448AFF';
// const POINT_BORDER_COLOR = '#000';
// const POINT_TEXT_COLOR = '#fff';

type Context = CanvasRenderingContext2D;

@Directive({
  selector: '[appCanvasOverlay]',
})
export class CanvasOverlayDirective
  extends CanvasSizeMixin(DestroyableMixin(class { })) {

  private readonly $canvas: JQuery;

  constructor(readonly elementRef: ElementRef) {
    super();
    this.$canvas = $(elementRef.nativeElement);
  }

  private get smallPointRadius() {
    return SMALL_POINT_RADIUS / this.cssScale;
  }

  private get mediumPointRadius() {
    return MEDIUM_POINT_RADIUS / this.cssScale;
  }

  private get splitPointRadius() {
    return this.mediumPointRadius * SPLIT_POINT_RADIUS_FACTOR;
  }

  private get highlightLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale;
  }

  private get selectedSegmentLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale / 1.9;
  }

  private get unselectedSegmentLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale / 3;
  }

  private get minSnapThreshold() {
    return MIN_SNAP_THRESHOLD / this.cssScale;
  }

  get dragTriggerTouchSlop() {
    return DRAG_TRIGGER_TOUCH_SLOP / this.cssScale;
  }

  onDimensionsChanged() {
    const { w: vlWidth, h: vlHeight } = this.getViewport();
    this.$canvas
      .attr({
        width: vlWidth * this.attrScale,
        height: vlHeight * this.attrScale,
      })
      .css({
        width: vlWidth * this.cssScale,
        height: vlHeight * this.cssScale,
      });
    this.draw();
  }

  draw() {
    // Draw labeled points, highlights, selections, the pixel grid, etc.
    const overlayCtx = (this.$canvas.get(0) as HTMLCanvasElement).getContext('2d');
    overlayCtx.save();
    this.setupCtxWithViewportCoords(overlayCtx);

    // TODO: implement this

    overlayCtx.restore();

    // Draw the pixel grid in terms of physical pixels, not viewport pixels.
    if (this.cssScale > 4) {
      overlayCtx.save();
      overlayCtx.fillStyle = 'rgba(128, 128, 128, .25)';
      const devicePixelRatio = window.devicePixelRatio || 1;
      const { w: vlWidth, h: vlHeight } = this.getViewport();
      for (let x = 1; x < vlWidth; x++) {
        overlayCtx.fillRect(
          x * this.attrScale - devicePixelRatio / 2,
          0,
          devicePixelRatio,
          vlHeight * this.attrScale);
      }
      for (let y = 1; y < vlHeight; y++) {
        overlayCtx.fillRect(
          0,
          y * this.attrScale - devicePixelRatio / 2,
          vlWidth * this.attrScale,
          devicePixelRatio);
      }
      overlayCtx.restore();
    }
  }

  // Scale the canvas so that everything from this point forward is drawn
  // in terms of the SVG's viewport coordinates.
  private setupCtxWithViewportCoords = (ctx: Context) => {
    ctx.scale(this.attrScale, this.attrScale);
    const { w, h } = this.getViewport();
    ctx.clearRect(0, 0, w, h);
  }

  // private executeHighlights(ctx: Context, color: string, lineWidth: number) {
  //   ctx.save();
  //   ctx.lineCap = 'round';
  //   ctx.strokeStyle = color;
  //   ctx.lineWidth = lineWidth;
  //   ctx.stroke();
  //   ctx.restore();
  // }

  // Draws a labeled point with optional text.
  // private executeLabeledPoint(
  //   ctx: Context,
  //   point: Point,
  //   radius: number,
  //   color: string,
  //   text?: string) {

  //   // Convert the point and the radius to physical pixel coordinates.
  //   // We do this to avoid fractional font sizes less than 1px, which
  //   // show up OK on Chrome but not on Firefox or Safari.
  //   point = MathUtil.transformPoint(
  //     point, Matrix.fromScaling(this.attrScale, this.attrScale));
  //   radius *= this.attrScale;

  //   ctx.save();
  //   ctx.beginPath();
  //   ctx.arc(point.x, point.y, radius * POINT_BORDER_FACTOR, 0, 2 * Math.PI, false);
  //   ctx.fillStyle = POINT_BORDER_COLOR;
  //   ctx.fill();

  //   ctx.beginPath();
  //   ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
  //   ctx.fillStyle = color;
  //   ctx.fill();

  //   if (text) {
  //     ctx.beginPath();
  //     ctx.fillStyle = POINT_TEXT_COLOR;
  //     ctx.font = radius + 'px Roboto, Helvetica Neue, sans-serif';
  //     const width = ctx.measureText(text).width;
  //     // TODO: is there a better way to get the height?
  //     const height = ctx.measureText('o').width;
  //     ctx.fillText(text, point.x - width / 2, point.y + height / 2);
  //     ctx.fill();
  //   }
  //   ctx.restore();
  // }
}
