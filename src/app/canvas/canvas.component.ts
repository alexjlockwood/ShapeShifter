import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  ViewChildren, QueryList, ChangeDetectionStrategy
} from '@angular/core';
import { Command } from '../scripts/paths';
import { PathLayer, ClipPathLayer, LayerUtil, VectorLayer } from '../scripts/layers';
import { Point, Matrix, ColorUtil } from '../scripts/common';
import {
  AnimatorService,
  CanvasResizeService,
} from '../services';
import {
  Store,
  State,
  getVectorLayers,
} from '../store';
import { CanvasRulerDirective } from './canvasruler.directive';
import { Subscription } from 'rxjs/Subscription';
import 'rxjs/add/observable/combineLatest';

const SPLIT_POINT_RADIUS_FACTOR = 0.8;
// const SELECTED_POINT_RADIUS_FACTOR = 1.25;
// const POINT_BORDER_FACTOR = 1.075;
// const DISABLED_ALPHA = 0.38;

// Canvas margin in css pixels.
export const CANVAS_MARGIN = 36;
// Default viewport size in viewport pixels.
export const DEFAULT_VIEWPORT_SIZE = 24;
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

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent implements AfterViewInit, OnDestroy {

  @ViewChild('canvasContainer') canvasContainerRef: ElementRef;
  @ViewChild('renderingCanvas') renderingCanvasRef: ElementRef;
  @ViewChild('overlayCanvas') overlayCanvasRef: ElementRef;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;

  private canvasContainer: JQuery;
  private renderingCanvas: JQuery;
  private overlayCanvas: JQuery;
  private offscreenLayerCanvas: JQuery;
  private renderingCtx: Context;
  private overlayCtx: Context;
  private offscreenLayerCtx: Context;
  private cssContainerWidth = 1;
  private cssContainerHeight = 1;
  private vlSize = { width: DEFAULT_VIEWPORT_SIZE, height: DEFAULT_VIEWPORT_SIZE };
  private readonly subscriptions: Subscription[] = [];
  private vectorLayer_: VectorLayer;

  constructor(
    private readonly animatorService: AnimatorService,
    private readonly canvasResizeService: CanvasResizeService,
    private readonly store: Store<State>,
  ) { }

  ngAfterViewInit() {
    this.canvasContainer = $(this.canvasContainerRef.nativeElement);
    this.renderingCanvas = $(this.renderingCanvasRef.nativeElement);
    this.overlayCanvas = $(this.overlayCanvasRef.nativeElement);
    this.offscreenLayerCanvas = $(document.createElement('canvas'));
    const getCtxFn = (canvas: JQuery) => {
      return (canvas.get(0) as HTMLCanvasElement).getContext('2d');
    };
    this.renderingCtx = getCtxFn(this.renderingCanvas);
    this.overlayCtx = getCtxFn(this.overlayCanvas);
    this.offscreenLayerCtx = getCtxFn(this.offscreenLayerCanvas);
    this.subscriptions.push(
      this.store.select(getVectorLayers).subscribe(vls => {
        if (!vls.length) {
          // TODO: how to handle 0 vector layers? should this ever be possible?
          return;
        }
        // TODO: how to handle multiple vector layers?
        const vl = vls[0];
        this.vectorLayer = vl;
        const newWidth = vl ? vl.width : DEFAULT_VIEWPORT_SIZE;
        const newHeight = vl ? vl.height : DEFAULT_VIEWPORT_SIZE;
        const didSizeChange =
          this.vlSize.width !== newWidth || this.vlSize.height !== newHeight;
        this.vlSize = { width: newWidth, height: newHeight };
        if (didSizeChange) {
          this.resizeAndDraw();
        } else {
          this.draw();
        }
      }));
    this.subscriptions.push(
      this.canvasResizeService.asObservable()
        .subscribe(size => {
          const oldWidth = this.cssContainerWidth;
          const oldHeight = this.cssContainerHeight;
          this.cssContainerWidth = Math.max(1, size.width - CANVAS_MARGIN * 2);
          this.cssContainerHeight = Math.max(1, size.height - CANVAS_MARGIN * 2);
          if (this.cssContainerWidth !== oldWidth
            || this.cssContainerHeight !== oldHeight) {
            this.resizeAndDraw();
          }
        }));
    this.subscriptions.push(
      this.animatorService.asObservable().subscribe(event => {
        if (!event.vl) {
          // TODO: don't let this case happen
          return;
        }
        this.vectorLayer = event.vl;
        this.draw();
      }));
    this.resizeAndDraw();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  /**
   * The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
   */
  private get attrScale() {
    return this.cssScale * devicePixelRatio;
  }

  /**
   * The 'cssScale' represents the number of CSS pixels per SVG viewport pixel.
   */
  private get cssScale() {
    const { width: vlWidth, height: vlHeight } = this.vlSize;
    const vectorAspectRatio = vlWidth / vlHeight;
    const containerAspectRatio = this.cssContainerWidth / this.cssContainerHeight;
    if (vectorAspectRatio > containerAspectRatio) {
      return this.cssContainerWidth / vlWidth;
    } else {
      return this.cssContainerHeight / vlHeight;
    }
  }

  private get vectorLayer() {
    return this.vectorLayer_;
  }

  private set vectorLayer(vl: VectorLayer) {
    this.vectorLayer_ = vl;
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

  /**
   * Resizes the canvas and redraws all content.
   */
  private resizeAndDraw() {
    const canvases = [
      this.canvasContainer,
      this.renderingCanvas,
      this.overlayCanvas,
      this.offscreenLayerCanvas,
    ];
    const { width: vlWidth, height: vlHeight } = this.vlSize;
    canvases.forEach(canvas => {
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
    this.canvasRulers.forEach(r => r.draw());
  }

  /**
   * Redraws all content.
   */
  draw() {
    this.renderingCtx.save();
    this.setupCtxWithViewportCoords(this.renderingCtx);

    const currentAlpha = this.vectorLayer ? this.vectorLayer.alpha : 1;
    if (currentAlpha < 1) {
      this.offscreenLayerCtx.save();
      this.setupCtxWithViewportCoords(this.offscreenLayerCtx);
    }

    // If the canvas is disabled, draw the layer to an offscreen canvas
    // so that we can draw it translucently w/o affecting the rest of
    // the layer's appearance.
    const layerCtx = currentAlpha < 1 ? this.offscreenLayerCtx : this.renderingCtx;

    this.drawPaths(layerCtx, layer => layer.pathData.getCommands());

    if (currentAlpha < 1) {
      this.drawTranslucentOffscreenCtx(
        this.renderingCtx, this.offscreenLayerCtx, currentAlpha);
      this.offscreenLayerCtx.restore();
    }
    this.renderingCtx.restore();

    this.drawOverlays();
  }

  // Scale the canvas so that everything from this point forward is drawn
  // in terms of the SVG's viewport coordinates.
  private setupCtxWithViewportCoords = (ctx: Context) => {
    ctx.scale(this.attrScale, this.attrScale);
    ctx.clearRect(0, 0, this.vlSize.width, this.vlSize.height);
  }

  private drawTranslucentOffscreenCtx(
    ctx: Context,
    offscreenCtx: Context,
    alpha: number) {

    ctx.save();
    ctx.globalAlpha = alpha;
    // Bring the canvas back to its original coordinates before
    // drawing the offscreen canvas contents.
    ctx.scale(1 / this.attrScale, 1 / this.attrScale);
    ctx.drawImage(offscreenCtx.canvas, 0, 0);
    ctx.restore();
  }

  // Draws any PathLayers to the canvas.
  private drawPaths(
    ctx: Context,
    extractDrawingCommandsFn: (layer: PathLayer) => ReadonlyArray<Command>,
  ) {
    this.vectorLayer.walk(layer => {
      if (layer instanceof ClipPathLayer) {
        if (!layer.pathData) {
          return;
        }
        const transforms = LayerUtil.getTransformsForLayer(this.vectorLayer, layer.name);
        executeCommands(ctx, layer.pathData.getCommands(), transforms);
        ctx.clip();
        return;
      }
      if (!(layer instanceof PathLayer) || !layer.pathData) {
        return;
      }
      const commands = extractDrawingCommandsFn(layer);
      if (!commands.length) {
        return;
      }

      ctx.save();

      const transforms = LayerUtil.getTransformsForLayer(this.vectorLayer, layer.name);
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
    });
  }

  // Draw labeled points, highlights, selections, the pixel grid, etc.
  drawOverlays() {
    this.overlayCtx.save();
    this.setupCtxWithViewportCoords(this.overlayCtx);
    this.overlayCtx.restore();

    // Draw the pixel grid in terms of physical pixels, not viewport pixels.
    if (this.cssScale > 4) {
      this.overlayCtx.save();
      this.overlayCtx.fillStyle = 'rgba(128, 128, 128, .25)';
      const devicePixelRatio = window.devicePixelRatio || 1;
      for (let x = 1; x < this.vlSize.width; x++) {
        this.overlayCtx.fillRect(
          x * this.attrScale - devicePixelRatio / 2,
          0,
          devicePixelRatio,
          this.vlSize.height * this.attrScale);
      }
      for (let y = 1; y < this.vlSize.height; y++) {
        this.overlayCtx.fillRect(
          0,
          y * this.attrScale - devicePixelRatio / 2,
          this.vlSize.width * this.attrScale,
          devicePixelRatio);
      }
      this.overlayCtx.restore();
    }
  }

  // MOUSE DOWN
  onMouseDown(event: MouseEvent) {
    this.showRuler(event);
  }

  // MOUSE MOVE
  onMouseMove(event: MouseEvent) {
    this.showRuler(event);
  }

  // MOUSE UP
  onMouseUp(event: MouseEvent) {
    this.showRuler(event);
  }

  // MOUSE LEAVE
  onMouseLeave() {
    this.canvasRulers.forEach(r => r.hideMouse());
  }

  onClick(event: MouseEvent) {
    // TODO: re-enable click canvas to import file?

    // TODO: is this hacky? should we be using onBlur() to reset the app mode?
    // This ensures that parents won't also receive the same click event.
    event.cancelBubble = true;
  }

  /**
   * Converts a mouse point's CSS coordinates into vector layer viewport coordinates.
   */
  // private mouseEventToPoint(event: MouseEvent) {
  //   const canvasOffset = this.canvasContainer.offset();
  //   const x = (event.pageX - canvasOffset.left) / this.cssScale;
  //   const y = (event.pageY - canvasOffset.top) / this.cssScale;
  //   return new Point(x, y);
  // }

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

  /**
   * Sends a signal that the canvas rulers should be redrawn.
   */
  private showRuler(event: MouseEvent) {
    const canvasOffset = this.canvasContainer.offset();
    const x = (event.pageX - canvasOffset.left) / Math.max(1, this.cssScale);
    const y = (event.pageY - canvasOffset.top) / Math.max(1, this.cssScale);
    this.canvasRulers.forEach(r => r.showMouse(new Point(_.round(x), _.round(y))));
  }
}

// Takes a path point and transforms it so that its coordinates are in terms
// of the VectorLayer's viewport coordinates.
// function applyGroupTransforms(mousePoint: Point, transforms: Matrix[]) {
//   return MathUtil.transformPoint(
//     mousePoint,
//     Matrix.flatten(...transforms.slice().reverse()));
// }

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
