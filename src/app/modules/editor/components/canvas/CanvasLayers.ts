import { ActionSource } from 'app/modules/editor/model/actionmode';
import {
  ClipPathLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { ColorUtil } from 'app/modules/editor/scripts/common';
import { getContext2d } from 'app/modules/editor/scripts/dom';
import { DestroyableMixin } from 'app/modules/editor/scripts/mixins';
import { State, Store } from 'app/modules/editor/store';
import {
  getActionModeEndState,
  getActionModeStartState,
} from 'app/modules/editor/store/actionmode/selectors';
import { getHiddenLayerIds } from 'app/modules/editor/store/layers/selectors';
import { getAnimatedVectorLayer } from 'app/modules/editor/store/playback/selectors';
import { combineLatest, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { CanvasCamera } from './CanvasCamera';
import type { CanvasPreview } from './CanvasPreview';
import * as CanvasUtil from './CanvasUtil';

type Context = CanvasRenderingContext2D;

/**
 * Draws the current vector layer to the canvas.
 */
export class CanvasLayers extends DestroyableMixin() {
  private readonly offscreenCanvas = document.createElement('canvas');
  private camera: CanvasCamera | undefined;
  private vectorLayer: VectorLayer | undefined;
  private hiddenLayerIds: ReadonlySet<string> = new Set<string>();

  constructor(
    private readonly renderingCanvas: HTMLCanvasElement,
    private readonly actionSource: ActionSource,
    private readonly store: Store<State>,
    // Edits in progress, which only the animated canvas shows.
    private readonly preview?: CanvasPreview,
  ) {
    super();
  }

  init() {
    if (this.actionSource === ActionSource.Animated) {
      // Preview canvas specific setup.
      const { preview } = this;
      this.registerSubscription(
        combineLatest([
          this.store.select(getAnimatedVectorLayer),
          this.store.select(getHiddenLayerIds),
          preview ? preview.asObservable().pipe(startWith(undefined)) : of(undefined),
        ]).subscribe(([{ vl, currentTime }, hiddenLayerIds]) => {
          this.vectorLayer = preview ? preview.apply(vl, currentTime) : vl;
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
    return getContext2d(this.renderingCanvas);
  }

  private get offscreenCtx() {
    return getContext2d(this.offscreenCanvas);
  }

  setCamera(camera: CanvasCamera) {
    this.camera = camera;
    CanvasUtil.setCanvasSize(this.renderingCanvas, camera);
    this.draw();
  }

  private draw() {
    const { camera } = this;
    // A canvas side shorter than a pixel rounds down to 0 (e.g. a collapsed panel). There's
    // nothing to see then, and compositing a canvas with no width or height throws.
    if (
      !this.vectorLayer ||
      !camera ||
      !this.renderingCanvas.width ||
      !this.renderingCanvas.height
    ) {
      return;
    }

    // Only the artboard is drawn, and everything from this point forward is drawn in terms of
    // the SVG's viewport coordinates.
    const setupCtxWithViewportCoordsFn = (ctx: Context) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      CanvasUtil.clipToArtboard(ctx, camera);
      const { a, b, c, d, e, f } = camera.getDeviceTransform();
      ctx.setTransform(a, b, c, d, e, f);
    };

    this.renderingCtx.save();
    setupCtxWithViewportCoordsFn(this.renderingCtx);
    if (this.vectorLayer.canvasColor) {
      this.renderingCtx.fillStyle = ColorUtil.androidToCssRgbaColor(this.vectorLayer.canvasColor);
      this.renderingCtx.fillRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);
    }

    const currentAlpha = this.vectorLayer ? this.vectorLayer.alpha : 1;
    if (currentAlpha < 1) {
      // It's only sized when it's needed, since it's as big as the panel.
      CanvasUtil.setCanvasSize(this.offscreenCanvas, camera);
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
      // Bring the canvas back to device coordinates before
      // drawing the offscreen canvas contents.
      this.renderingCtx.resetTransform();
      this.renderingCtx.drawImage(this.offscreenCtx.canvas, 0, 0);
      this.renderingCtx.restore();
      this.offscreenCtx.restore();
    } else if (this.offscreenCanvas.width) {
      // Frees its memory.
      this.offscreenCanvas.width = 0;
      this.offscreenCanvas.height = 0;
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
