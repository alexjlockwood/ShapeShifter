import { AfterViewInit, Directive, ElementRef, Input } from '@angular/core';
import { ActionSource } from 'app/modules/editor/model/actionmode';
import {
  ClipPathLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { ColorUtil } from 'app/modules/editor/scripts/common';
import { DestroyableMixin } from 'app/modules/editor/scripts/mixins';
import { PlaybackService } from 'app/modules/editor/services';
import { State, Store } from 'app/modules/editor/store';
import {
  getActionModeEndState,
  getActionModeStartState,
} from 'app/modules/editor/store/actionmode/selectors';
import { getHiddenLayerIds, getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import * as $ from 'jquery';
import { combineLatest, merge } from 'rxjs';
import { map } from 'rxjs/operators';

import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';
import * as CanvasUtil from './CanvasUtil';

type Context = CanvasRenderingContext2D;

/**
 * Directive that draws the current vector layer to the canvas.
 */
@Directive({ selector: '[appCanvasLayers]' })
export class CanvasLayersDirective extends CanvasLayoutMixin(DestroyableMixin())
  implements AfterViewInit {
  @Input()
  actionSource: ActionSource;

  private readonly $renderingCanvas: JQuery<HTMLCanvasElement>;
  private readonly $offscreenCanvas: JQuery<HTMLCanvasElement>;
  private vectorLayer: VectorLayer;
  private hiddenLayerIds: ReadonlySet<string> = new Set<string>();

  constructor(
    elementRef: ElementRef,
    private readonly playbackService: PlaybackService,
    private readonly store: Store<State>,
  ) {
    super();
    this.$renderingCanvas = $(elementRef.nativeElement) as JQuery<HTMLCanvasElement>;
    this.$offscreenCanvas = $(document.createElement('canvas')) as JQuery<HTMLCanvasElement>;
  }

  ngAfterViewInit() {
    if (this.actionSource === ActionSource.Animated) {
      // Preview canvas specific setup.
      this.registerSubscription(
        combineLatest(
          // TODO: don't think this is necessary anymore? only need to query playback service now?
          merge(
            this.playbackService.asObservable().pipe(map(event => event.vl)),
            this.store.select(getVectorLayer),
          ),
          this.store.select(getHiddenLayerIds),
        ).subscribe(([vectorLayer, hiddenLayerIds]) => {
          this.vectorLayer = vectorLayer;
          this.hiddenLayerIds = hiddenLayerIds;
          this.draw();
        }),
      );
    } else {
      // Start & end canvas specific setup.
      const actionModeSelector =
        this.actionSource === ActionSource.From ? getActionModeStartState : getActionModeEndState;
      this.registerSubscription(
        this.store.select(actionModeSelector).subscribe(({ vectorLayer, hiddenLayerIds }) => {
          this.vectorLayer = vectorLayer;
          this.hiddenLayerIds = hiddenLayerIds;
          this.draw();
        }),
      );
    }
  }

  private get renderingCtx() {
    return this.$renderingCanvas.get(0).getContext('2d');
  }

  private get offscreenCtx() {
    return this.$offscreenCanvas.get(0).getContext('2d');
  }

  // @Override
  protected onDimensionsChanged(bounds: Size, viewport: Size) {
    const { w, h } = this.getViewport();
    [this.$renderingCanvas, this.$offscreenCanvas].forEach(canvas => {
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
    };

    this.renderingCtx.save();
    setupCtxWithViewportCoordsFn(this.renderingCtx);
    if (this.vectorLayer.canvasColor) {
      this.renderingCtx.fillStyle = ColorUtil.androidToCssRgbaColor(this.vectorLayer.canvasColor);
      this.renderingCtx.fillRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);
    }

    const currentAlpha = this.vectorLayer ? this.vectorLayer.alpha : 1;
    if (currentAlpha < 1) {
      this.offscreenCtx.save();
      setupCtxWithViewportCoordsFn(this.offscreenCtx);
    }

    // If the canvas is disabled, draw the layer to an offscreen canvas
    // so that we can draw it translucently w/o affecting the rest of
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
      ctx.save();
      layer.children.forEach(child => this.drawLayer(vl, child, ctx));
      ctx.restore();
    }
  }

  private drawClipPathLayer(vl: VectorLayer, layer: ClipPathLayer, ctx: Context) {
    if (!layer.pathData || !layer.pathData.getCommands().length) {
      return;
    }
    const flattenedTransform = LayerUtil.getCanvasTransformForLayer(vl, layer.id);
    CanvasUtil.executeCommands(ctx, layer.pathData.getCommands(), flattenedTransform);
    ctx.clip();
  }

  private drawPathLayer(vl: VectorLayer, layer: PathLayer, ctx: Context) {
    if (!layer.pathData || !layer.pathData.getCommands().length) {
      return;
    }
    const layerToCanvasMatrix = LayerUtil.getCanvasTransformForLayer(vl, layer.id);
    const canvasToLayerMatrix = layerToCanvasMatrix.invert();
    if (!canvasToLayerMatrix) {
      // Do nothing if matrix is non-invertible.
      return;
    }

    ctx.save();
    CanvasUtil.executeCommands(ctx, layer.pathData.getCommands(), layerToCanvasMatrix);

    const strokeWidthMultiplier = canvasToLayerMatrix.getScaleFactor();
    ctx.strokeStyle = ColorUtil.androidToCssRgbaColor(layer.strokeColor, layer.strokeAlpha);
    ctx.lineWidth = layer.strokeWidth * strokeWidthMultiplier;
    ctx.fillStyle = ColorUtil.androidToCssRgbaColor(layer.fillColor, layer.fillAlpha);
    ctx.lineCap = layer.strokeLinecap;
    ctx.lineJoin = layer.strokeLinejoin;
    ctx.miterLimit = layer.strokeMiterLimit;

    if (layer.trimPathStart !== 0 || layer.trimPathEnd !== 1 || layer.trimPathOffset !== 0) {
      const { a, d } = canvasToLayerMatrix;
      // Note that we only return the length of the first sub path due to
      // https://code.google.com/p/android/issues/detail?id=172547
      let pathLength: number;
      if (Math.abs(a) !== 1 || Math.abs(d) !== 1) {
        // Then recompute the scaled path length.
        pathLength = layer.pathData
          .mutate()
          .transform(canvasToLayerMatrix)
          .build()
          .getSubPathLength(0);
      } else {
        pathLength = layer.pathData.getSubPathLength(0);
      }

      const strokeDashArray = LayerUtil.toStrokeDashArray(
        layer.trimPathStart,
        layer.trimPathEnd,
        layer.trimPathOffset,
        pathLength,
        0.001,
      );
      const strokeDashOffset = LayerUtil.toStrokeDashOffset(
        layer.trimPathStart,
        layer.trimPathEnd,
        layer.trimPathOffset,
        pathLength,
      );
      ctx.setLineDash(strokeDashArray);
      ctx.lineDashOffset = strokeDashOffset;
    } else {
      ctx.setLineDash([]);
    }
    if (layer.isStroked() && layer.strokeWidth && layer.trimPathStart !== layer.trimPathEnd) {
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
