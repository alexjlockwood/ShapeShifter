import * as $ from 'jquery';
import { Directive, ElementRef, AfterViewInit } from '@angular/core';
import { CanvasMixin } from './CanvasMixin';

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
export class CanvasOverlayDirective extends CanvasMixin(class { }) implements AfterViewInit {
  private $overlayCanvas: JQuery;
  private overlayCtx: Context;

  constructor(private readonly elementRef: ElementRef) {
    super();
    this.$overlayCanvas = $(this.elementRef.nativeElement);
  }

  ngAfterViewInit() {
    this.overlayCtx = (this.$overlayCanvas.get(0) as HTMLCanvasElement).getContext('2d');
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

  draw() {
    this.resizeCanvases(this.$overlayCanvas);

    // Draw labeled points, highlights, selections, the pixel grid, etc.
    this.overlayCtx.save();
    this.setupCtxWithViewportCoords(this.overlayCtx);

    // TODO: implement this

    this.overlayCtx.restore();

    // Draw the pixel grid in terms of physical pixels, not viewport pixels.
    if (this.cssScale > 4) {
      this.overlayCtx.save();
      this.overlayCtx.fillStyle = 'rgba(128, 128, 128, .25)';
      const devicePixelRatio = window.devicePixelRatio || 1;
      const { w: vlWidth, h: vlHeight } = this.getViewport();
      for (let x = 1; x < vlWidth; x++) {
        this.overlayCtx.fillRect(
          x * this.attrScale - devicePixelRatio / 2,
          0,
          devicePixelRatio,
          vlHeight * this.attrScale);
      }
      for (let y = 1; y < vlHeight; y++) {
        this.overlayCtx.fillRect(
          0,
          y * this.attrScale - devicePixelRatio / 2,
          vlWidth * this.attrScale,
          devicePixelRatio);
      }
      this.overlayCtx.restore();
    }
  }
}
