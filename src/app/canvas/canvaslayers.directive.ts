import * as $ from 'jquery';
import { Directive, ElementRef, Input, AfterViewInit } from '@angular/core';
import { CanvasSizeMixin, Size } from './CanvasSizeMixin';
import { DestroyableMixin } from '../scripts/mixins';
import { Store, State, getLayerState } from '../store';
import { Layer, PathLayer, ClipPathLayer, LayerUtil, VectorLayer } from '../scripts/layers';
import { Matrix, ColorUtil, Point } from '../scripts/common';
import { Command } from '../scripts/paths';
import { Observable } from 'rxjs/Observable';

type Context = CanvasRenderingContext2D;

@Directive({
  selector: '[appCanvasLayers]',
})
export class CanvasLayersDirective extends CanvasSizeMixin() {

  private readonly $renderingCanvas: JQuery;
  private readonly $offscreenLayerCanvas: JQuery;
  private readonly renderingCtx: Context;
  private readonly offscreenLayerCtx: Context;
  private vectorLayers: ReadonlyArray<VectorLayer> = [];
  private hiddenLayerIds = new Set<string>();

  constructor(
    readonly elementRef: ElementRef,
    readonly store: Store<State>,
  ) {
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
  onDimensionsChanged(bounds: Size, viewport: Size) {
    const { w: vlWidth, h: vlHeight } = this.getViewport();
    [this.$renderingCanvas, this.$offscreenLayerCanvas]
      .forEach(canvas => {
        canvas
          .attr({
            width: vlWidth * this.attrScale,
            height: vlHeight * this.attrScale,
          })
          .css({
            width: vlWidth * this.cssScale,
            height: vlHeight * this.cssScale,
          });
      });
    this.draw();
  }

  setVectorLayers(vls: ReadonlyArray<VectorLayer>) {
    this.vectorLayers = vls;
    this.draw();
  }

  setLayerState(vls: ReadonlyArray<VectorLayer>, hiddenLayerIds: Set<string>) {
    this.vectorLayers = vls;
    this.hiddenLayerIds = hiddenLayerIds;
    this.draw();
  }

  draw() {
    if (!this.vectorLayers.length) {
      return;
    }

    this.renderingCtx.save();
    this.setupCtxWithViewportCoords(this.renderingCtx);

    const currentAlpha = this.vectorLayers[0] ? this.vectorLayers[0].alpha : 1;
    if (currentAlpha < 1) {
      this.offscreenLayerCtx.save();
      this.setupCtxWithViewportCoords(this.offscreenLayerCtx);
    }

    // If the canvas is disabled, draw the layer to an offscreen canvas
    // so that we can draw it translucently w/ o affecting the rest of
    // the layer's appearance.
    const layerCtx = currentAlpha < 1 ? this.offscreenLayerCtx : this.renderingCtx;

    this.drawLayers(layerCtx);

    if (currentAlpha < 1) {
      this.drawTranslucentOffscreenCtx(
        this.renderingCtx, this.offscreenLayerCtx, currentAlpha);
      this.offscreenLayerCtx.restore();
    }
    this.renderingCtx.restore();
  }

  // Scale the canvas so that everything from this point forward is drawn
  // in terms of the SVG's viewport coordinates.
  private setupCtxWithViewportCoords = (ctx: Context) => {
    ctx.scale(this.attrScale, this.attrScale);
    const { w, h } = this.getViewport();
    ctx.clearRect(0, 0, w, h);
  }

  private drawTranslucentOffscreenCtx(ctx: Context, offscreenCtx: Context, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;
    // Bring the canvas back to its original coordinates before
    // drawing the offscreen canvas contents.
    ctx.scale(1 / this.attrScale, 1 / this.attrScale);
    ctx.drawImage(offscreenCtx.canvas, 0, 0);
    ctx.restore();
  }

  // Draws any PathLayers to the canvas.
  private drawLayers(ctx: Context) {
    this.vectorLayers[0].walk(layer => {
      if (this.hiddenLayerIds.has(layer.id)) {
        return false;
      }
      if (layer instanceof ClipPathLayer) {
        if (!layer.pathData) {
          return true;
        }
        const transforms = LayerUtil.getTransformsForLayer(this.vectorLayers[0], layer.name);
        executeCommands(ctx, layer.pathData.getCommands(), transforms);
        ctx.clip();
        return true;
      }
      if (!(layer instanceof PathLayer) || !layer.pathData) {
        return true;
      }
      const commands = layer.pathData.getCommands();
      if (!commands.length) {
        return true;
      }

      ctx.save();

      const transforms = LayerUtil.getTransformsForLayer(this.vectorLayers[0], layer.name);
      executeCommands(ctx, commands, transforms);

      // TODO: confirm this stroke multiplier thing works...
      const strokeWidthMultiplier = Matrix.flatten(...transforms).getScale();
      ctx.strokeStyle = ColorUtil.androidToCssRgbaColor(layer.strokeColor, layer.strokeAlpha);
      ctx.lineWidth = layer.strokeWidth * strokeWidthMultiplier;
      ctx.fillStyle = ColorUtil.androidToCssRgbaColor(layer.fillColor, layer.fillAlpha);
      ctx.lineCap = layer.strokeLinecap;
      ctx.lineJoin = layer.strokeLinejoin;
      ctx.miterLimit = layer.strokeMiterLimit;

      // TODO: update layer.pathData.length so that it reflects scale transforms
      // TODO: update layer.pathData.length so that it reflects scale transforms
      // TODO: update layer.pathData.length so that it reflects scale transforms
      // TODO: update layer.pathData.length so that it reflects scale transforms
      // TODO: update layer.pathData.length so that it reflects scale transforms
      if (layer.trimPathStart !== 0
        || layer.trimPathEnd !== 1
        || layer.trimPathOffset !== 0) {
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
          shownFraction * layer.pathData.getPathLength(),
          (1 - shownFraction + 0.001) * layer.pathData.getPathLength(),
        ]);
        // The amount to offset the path is equal to the trimPathStart plus
        // trimPathOffset. We mod the result because the trimmed path
        // should wrap around once it reaches 1.
        ctx.lineDashOffset = layer.pathData.getPathLength()
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

      return true;
    });
  }
}

function executeCommands(
  ctx: Context,
  commands: ReadonlyArray<Command>,
  transforms: Matrix[]) {

  ctx.save();
  transforms.forEach(m => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f));
  ctx.beginPath();

  if (commands.length === 1 && commands[0].getSvgChar() !== 'M') {
    ctx.moveTo(commands[0].getStart().x, commands[0].getStart().y);
  }

  let previousEndPoint: Point;
  commands.forEach(cmd => {
    const start = cmd.getStart();
    const end = cmd.getEnd();

    if (start && !start.equals(previousEndPoint)) {
      // This is to support the case where the list of commands
      // is size fragmented.
      ctx.moveTo(start.x, start.y);
    }

    if (cmd.getSvgChar() === 'M') {
      ctx.moveTo(end.x, end.y);
    } else if (cmd.getSvgChar() === 'L') {
      ctx.lineTo(end.x, end.y);
    } else if (cmd.getSvgChar() === 'Q') {
      ctx.quadraticCurveTo(
        cmd.getPoints()[1].x, cmd.getPoints()[1].y,
        cmd.getPoints()[2].x, cmd.getPoints()[2].y);
    } else if (cmd.getSvgChar() === 'C') {
      ctx.bezierCurveTo(
        cmd.getPoints()[1].x, cmd.getPoints()[1].y,
        cmd.getPoints()[2].x, cmd.getPoints()[2].y,
        cmd.getPoints()[3].x, cmd.getPoints()[3].y);
    } else if (cmd.getSvgChar() === 'Z') {
      if (start.equals(previousEndPoint)) {
        ctx.closePath();
      } else {
        // This is to support the case where the list of commands
        // is size fragmented.
        ctx.lineTo(end.x, end.y);
      }
    }
    previousEndPoint = end;
  });
  ctx.restore();
}
