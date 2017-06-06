import 'rxjs/add/observable/combineLatest';

import { AnimatorService } from '../animator';
import { ColorUtil } from '../scripts/common';
import {
  ClipPathLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from '../scripts/layers';
import { DestroyableMixin } from '../scripts/mixins';
import {
  ActionSource,
  State,
  Store,
} from '../store';
import {
  getActionModeEndState,
  getActionModeStartState,
} from '../store/actionmode/selectors';
import { getCanvasLayersState } from '../store/common/selectors';
import {
  CanvasLayoutMixin,
  Size,
} from './CanvasLayoutMixin';
import * as CanvasUtil from './CanvasUtil';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
} from '@angular/core';
import * as $ from 'jquery';
import { Observable } from 'rxjs/Observable';

type Context = CanvasRenderingContext2D;

/**
 * Directive that draws the current vector layer to the canvas.
 */
@Directive({ selector: '[appCanvasLayers]' })
export class CanvasLayersDirective
  extends CanvasLayoutMixin(DestroyableMixin())
  implements AfterViewInit {

  @Input() actionSource: ActionSource;

  private readonly $renderingCanvas: JQuery;
  private readonly $offscreenCanvas: JQuery;
  private vectorLayer: VectorLayer;
  private hiddenLayerIds = new Set<string>();

  constructor(
    readonly elementRef: ElementRef,
    private readonly animatorService: AnimatorService,
    private readonly store: Store<State>,
  ) {
    super();
    this.$renderingCanvas = $(elementRef.nativeElement);
    this.$offscreenCanvas = $(document.createElement('canvas'));
  }

  private get renderingCtx() {
    return (this.$renderingCanvas.get(0) as HTMLCanvasElement).getContext('2d');
  }

  private get offscreenCtx() {
    return (this.$offscreenCanvas.get(0) as HTMLCanvasElement).getContext('2d');
  }

  ngAfterViewInit() {
    if (this.actionSource === ActionSource.Animated) {
      // Preview canvas specific setup.
      this.registerSubscription(
        Observable.combineLatest(
          this.animatorService.asObservable().map(event => event.vl),
          this.store.select(getCanvasLayersState),
        ).subscribe(([animatedVl, { vectorLayer, hiddenLayerIds }]) => {
          this.vectorLayer = animatedVl || vectorLayer;
          this.hiddenLayerIds = hiddenLayerIds;
          this.draw();
        }));
    } else {
      // Start & end canvas specific setup.
      const actionModeSelector =
        this.actionSource === ActionSource.From
          ? getActionModeStartState
          : getActionModeEndState;
      this.registerSubscription(
        this.store.select(actionModeSelector)
          .subscribe(({ vectorLayer }) => {
            this.vectorLayer = vectorLayer;
            this.draw();
          }),
      );
    }
  }

  // @Override
  onDimensionsChanged(bounds: Size, viewport: Size) {
    const { w, h } = this.getViewport();
    [this.$renderingCanvas, this.$offscreenCanvas]
      .forEach(canvas => {
        canvas.attr({ width: w * this.attrScale, height: h * this.attrScale });
        canvas.css({ width: w * this.cssScale, height: h * this.cssScale });
      });
    this.draw();
  }

  private draw() {
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
      this.offscreenCtx.save();
      setupCtxWithViewportCoordsFn(this.offscreenCtx);
    }

    // If the canvas is disabled, draw the layer to an offscreen canvas
    // so that we can draw it translucently w/ o affecting the rest of
    // the layer's appearance.
    const layerCtx = currentAlpha < 1 ? this.offscreenCtx : this.renderingCtx;
    this.drawLayer(this.vectorLayer, this.vectorLayer, layerCtx);

    if (currentAlpha < 1) {
      this.renderingCtx.save();
      this.renderingCtx.globalAlpha = currentAlpha;
      // Bring the canvas back to its original coordinates before
      // drawing the offscreen canvas contents.
      this.renderingCtx.scale(1 / this.attrScale, 1 / this.attrScale);
      this.renderingCtx.drawImage(this.offscreenCtx.canvas, 0, 0);
      this.renderingCtx.restore();
      this.offscreenCtx.restore();
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
