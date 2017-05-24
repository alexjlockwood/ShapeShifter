import * as $ from 'jquery';
import { Directive, ElementRef } from '@angular/core';
import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';
import {
  Layer, PathLayer, ClipPathLayer, LayerUtil, VectorLayer,
} from '../scripts/layers';
import { ColorUtil } from '../scripts/common';
import * as CanvasUtil from './CanvasUtil';

type Context = CanvasRenderingContext2D;

@Directive({
  selector: '[appCanvasLayers]',
})
export class CanvasLayersDirective extends CanvasLayoutMixin() {

  private readonly $renderingCanvas: JQuery;
  private readonly $offscreenLayerCanvas: JQuery;
  private readonly renderingCtx: Context;
  private readonly offscreenLayerCtx: Context;
  private vectorLayer: VectorLayer;
  private hiddenLayerIds = new Set<string>();

  constructor(readonly elementRef: ElementRef) {
    super();
    this.$renderingCanvas = $(elementRef.nativeElement);
    this.$offscreenLayerCanvas = $(document.createElement('canvas'));
    const getCtxFn = (canvas: JQuery) => {
      return (canvas.get(0) as HTMLCanvasElement).getContext('2d');
    };
    this.renderingCtx = getCtxFn(this.$renderingCanvas);
    this.offscreenLayerCtx = getCtxFn(this.$offscreenLayerCanvas);
  }

  // @Override
  protected onDimensionsChanged(bounds: Size, viewport: Size) {
    const { w, h } = this.getViewport();
    [this.$renderingCanvas, this.$offscreenLayerCanvas]
      .forEach(canvas => {
        canvas.attr({ width: w * this.attrScale, height: h * this.attrScale });
        canvas.css({ width: w * this.cssScale, height: h * this.cssScale });
      });
    this.draw();
  }

  setVectorLayer(vl: VectorLayer) {
    this.vectorLayer = vl;
    this.draw();
  }

  setLayerState(vl: VectorLayer, hiddenLayerIds: Set<string>) {
    this.vectorLayer = vl;
    this.hiddenLayerIds = hiddenLayerIds;
    this.draw();
  }

  draw() {
    if (!this.vectorLayer) {
      return;
    }

    // Scale the canvas so that everything from this point forward is drawn
    // in terms of the SVG's viewport coordinates.
    const setupCtxWithViewportCoordsFn = (ctx: Context) => {
      ctx.scale(this.attrScale, this.attrScale);
      const { w, h } = this.getViewport();
      ctx.clearRect(0, 0, w, h);
    }

    this.renderingCtx.save();
    setupCtxWithViewportCoordsFn(this.renderingCtx);

    const currentAlpha = this.vectorLayer ? this.vectorLayer.alpha : 1;
    if (currentAlpha < 1) {
      this.offscreenLayerCtx.save();
      setupCtxWithViewportCoordsFn(this.offscreenLayerCtx);
    }

    // If the canvas is disabled, draw the layer to an offscreen canvas
    // so that we can draw it translucently w/ o affecting the rest of
    // the layer's appearance.
    const layerCtx = currentAlpha < 1 ? this.offscreenLayerCtx : this.renderingCtx;
    this.drawLayer(this.vectorLayer, this.vectorLayer, layerCtx);

    if (currentAlpha < 1) {
      this.renderingCtx.save();
      this.renderingCtx.globalAlpha = currentAlpha;
      // Bring the canvas back to its original coordinates before
      // drawing the offscreen canvas contents.
      this.renderingCtx.scale(1 / this.attrScale, 1 / this.attrScale);
      this.renderingCtx.drawImage(this.offscreenLayerCtx.canvas, 0, 0);
      this.renderingCtx.restore();
      this.offscreenLayerCtx.restore();
    }
    this.renderingCtx.restore();
  }

  private drawLayer(vl: VectorLayer, layer: Layer, ctx: Context) {
    if (this.hiddenLayerIds.has(layer.id)) {
      return;
    }
    if (layer instanceof ClipPathLayer) {
      this.drawClipPathLayer(vl, layer, ctx);
    } else if (layer instanceof PathLayer) {
      this.drawPathLayer(vl, layer, ctx);
    } else {
      layer.children.forEach(child => this.drawLayer(vl, child, ctx));
    }
  }

  private drawClipPathLayer(vl: VectorLayer, layer: ClipPathLayer, ctx: Context) {
    if (!layer.pathData || !layer.pathData.getCommands().length) {
      return;
    }
    const flattenedTransform = LayerUtil.getFlattenedTransformForLayer(vl, layer.id);
    CanvasUtil.executeCommands(ctx, layer.pathData.getCommands(), flattenedTransform);
    ctx.clip();
  }

  private drawPathLayer(vl: VectorLayer, layer: PathLayer, ctx: Context) {
    if (!layer.pathData || !layer.pathData.getCommands().length) {
      return;
    }
    ctx.save();

    const flattenedTransform = LayerUtil.getFlattenedTransformForLayer(vl, layer.id);
    CanvasUtil.executeCommands(ctx, layer.pathData.getCommands(), flattenedTransform);

    const strokeWidthMultiplier = flattenedTransform.getScale();
    ctx.strokeStyle = ColorUtil.androidToCssRgbaColor(layer.strokeColor, layer.strokeAlpha);
    ctx.lineWidth = layer.strokeWidth * strokeWidthMultiplier;
    ctx.fillStyle = ColorUtil.androidToCssRgbaColor(layer.fillColor, layer.fillAlpha);
    ctx.lineCap = layer.strokeLinecap;
    ctx.lineJoin = layer.strokeLinejoin;
    ctx.miterLimit = layer.strokeMiterLimit;

    if (layer.trimPathStart !== 0
      || layer.trimPathEnd !== 1
      || layer.trimPathOffset !== 0) {
      const { a, d } = flattenedTransform;
      let pathLength: number;
      if (a !== 1 || d !== 1) {
        // Then recompute the scaled path length.
        pathLength = layer.pathData.mutate()
          .addTransforms([flattenedTransform])
          .build()
          .getPathLength();
      } else {
        pathLength = layer.pathData.getPathLength();
      }

      // Calculate the visible fraction of the trimmed path. If trimPathStart
      // is greater than trimPathEnd, then the result should be the combined
      // length of the two line segments: [trimPathStart,1] and [0,trimPathEnd].
      let shownFraction = layer.trimPathEnd - layer.trimPathStart;
      if (layer.trimPathStart > layer.trimPathEnd) {
        shownFraction += 1;
      }
      // Calculate the dash array. The first array element is the length of
      // the trimmed path and the second element is the gap, which is the
      // difference in length between the total path length and the visible
      // trimmed path length.
      ctx.setLineDash([
        shownFraction * pathLength,
        (1 - shownFraction + 0.001) * pathLength,
      ]);
      // The amount to offset the path is equal to the trimPathStart plus
      // trimPathOffset. We mod the result because the trimmed path
      // should wrap around once it reaches 1.
      ctx.lineDashOffset = pathLength
        * (1 - ((layer.trimPathStart + layer.trimPathOffset) % 1));
    } else {
      ctx.setLineDash([]);
    }
    if (layer.isStroked()
      && layer.strokeWidth
      && layer.trimPathStart !== layer.trimPathEnd) {
      ctx.stroke();
    }
    if (layer.isFilled()) {
      if (layer.fillType === 'evenOdd') {
        // Unlike VectorDrawables, SVGs spell 'evenodd' with a lowercase 'o'.
        ctx.fill('evenodd');
      } else {
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
