import * as $ from 'jquery';
import { Directive, ElementRef, AfterViewInit, Input } from '@angular/core';
import { CanvasSizeMixin, Size } from './CanvasSizeMixin';
import { DestroyableMixin } from '../scripts/mixins';
import { Observable } from 'rxjs/Observable';
import {
  Layer, VectorLayer, LayerUtil, PathLayer, ClipPathLayer, GroupLayer,
} from '../scripts/layers';
import * as CanvasUtil from './CanvasUtil';

const SPLIT_POINT_RADIUS_FACTOR = 0.8;
// const SELECTED_POINT_RADIUS_FACTOR = 1.25;
// const POINT_BORDER_FACTOR = 1.075;
// const DISABLED_ALPHA = 0.38;

// The line width of a highlight in css pixels.
const HIGHLIGHT_LINE_WIDTH = 6;
// The line dash of a highlight in css pixels.
const HIGHLIGHT_LINE_DASH = 5;
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
const HIGHLIGHT_COLOR = '#448AFF';
// const POINT_BORDER_COLOR = '#000';
// const POINT_TEXT_COLOR = '#fff';

type Context = CanvasRenderingContext2D;

@Directive({
  selector: '[appCanvasOverlay]',
})
export class CanvasOverlayDirective extends CanvasSizeMixin() {

  private readonly $canvas: JQuery;
  private readonly overlayCtx: Context;
  private vectorLayer: VectorLayer;
  private hiddenLayerIds = new Set<string>();
  private selectedLayerIds = new Set<string>();

  constructor(readonly elementRef: ElementRef) {
    super();
    this.$canvas = $(elementRef.nativeElement);
    this.overlayCtx = (this.$canvas.get(0) as HTMLCanvasElement).getContext('2d');
  }

  private get highlightLineWidth() {
    return HIGHLIGHT_LINE_WIDTH / this.cssScale;
  }

  private get highlightLineDash() {
    return [
      HIGHLIGHT_LINE_DASH / this.cssScale,
      HIGHLIGHT_LINE_DASH / this.cssScale,
    ];
  }

  // @Override
  onDimensionsChanged() {
    const { w, h } = this.getViewport();
    this.$canvas.attr({ width: w * this.attrScale, height: h * this.attrScale });
    this.$canvas.css({ width: w * this.cssScale, height: h * this.cssScale });
    this.draw();
  }

  setLayerState(vl: VectorLayer, hiddenLayerIds: Set<string>, selectedLayerIds: Set<string>) {
    this.vectorLayer = vl;
    this.hiddenLayerIds = hiddenLayerIds;
    this.selectedLayerIds = selectedLayerIds;
    this.draw();
  }

  draw() {
    if (this.vectorLayer) {
      const { w, h } = this.getViewport();
      this.overlayCtx.save();
      this.overlayCtx.scale(this.attrScale, this.attrScale);
      this.overlayCtx.clearRect(0, 0, w, h);
      this.drawLayer(this.vectorLayer, this.vectorLayer, this.overlayCtx);
      this.overlayCtx.restore();
    }
    this.drawPixelGrid();
  }

  private drawLayer(vl: VectorLayer, curr: Layer, ctx: Context) {
    if (this.hiddenLayerIds.has(curr.id)) {
      return;
    }
    if (this.selectedLayerIds.has(curr.id)) {
      if (curr instanceof ClipPathLayer) {
        this.drawClipPathHighlights(vl, curr, ctx);
      } else if (curr instanceof PathLayer) {
        this.drawPathHighlights(vl, curr, ctx);
      } else if (curr instanceof VectorLayer || curr instanceof GroupLayer) {
        this.drawGroupHighlights(vl, curr, ctx);
      }
    }
    curr.children.forEach(child => this.drawLayer(vl, child, ctx));
  }

  private drawGroupHighlights(
    vl: VectorLayer,
    layer: VectorLayer | GroupLayer,
    ctx: Context,
  ) {
    const bounds = layer.getBoundingBox();
    if (bounds) {
      ctx.save();
      const transforms = LayerUtil.getTransformsForLayer(vl, layer.id);
      transforms.forEach(m => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f));
      ctx.beginPath();
      ctx.rect(bounds.l, bounds.t, bounds.r - bounds.l, bounds.b - bounds.t);
      ctx.restore();
      executeHighlights(ctx, HIGHLIGHT_COLOR, this.highlightLineWidth);
    }
  }

  private drawClipPathHighlights(vl: VectorLayer, layer: ClipPathLayer, ctx: Context) {
    if (!layer.pathData || !layer.pathData.getCommands().length) {
      return;
    }
    const transforms = LayerUtil.getTransformsForLayer(vl, layer.id);
    CanvasUtil.executeCommands(ctx, layer.pathData.getCommands(), transforms);
    executeHighlights(ctx, HIGHLIGHT_COLOR, this.highlightLineWidth, this.highlightLineDash);
    ctx.clip();
  }

  private drawPathHighlights(vl: VectorLayer, layer: PathLayer, ctx: Context) {
    if (!layer.pathData || !layer.pathData.getCommands().length) {
      return;
    }
    ctx.save();
    const transforms = LayerUtil.getTransformsForLayer(vl, layer.id);
    CanvasUtil.executeCommands(ctx, layer.pathData.getCommands(), transforms);
    executeHighlights(ctx, HIGHLIGHT_COLOR, this.highlightLineWidth);
    ctx.restore();
  }

  private drawPixelGrid() {
    // Note that we draw the pixel grid in terms of physical pixels,
    // not viewport pixels.
    if (this.cssScale > 4) {
      this.overlayCtx.save();
      this.overlayCtx.fillStyle = 'rgba(128, 128, 128, .25)';
      const devicePixelRatio = window.devicePixelRatio || 1;
      const viewport = this.getViewport();
      for (let x = 1; x < viewport.w; x++) {
        this.overlayCtx.fillRect(
          x * this.attrScale - devicePixelRatio / 2,
          0,
          devicePixelRatio,
          viewport.h * this.attrScale);
      }
      for (let y = 1; y < viewport.h; y++) {
        this.overlayCtx.fillRect(
          0,
          y * this.attrScale - devicePixelRatio / 2,
          viewport.w * this.attrScale,
          devicePixelRatio);
      }
      this.overlayCtx.restore();
    }
  }
}

function executeHighlights(
  ctx: Context,
  color: string,
  lineWidth: number,
  lineDash: number[] = [],
) {
  ctx.save();
  ctx.setLineDash(lineDash);
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}
