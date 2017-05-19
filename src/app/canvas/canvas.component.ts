import * as _ from 'lodash';
import * as $ from 'jquery';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  ViewChildren, QueryList, ChangeDetectionStrategy, Input,
} from '@angular/core';
import { CanvasOverlayDirective } from './canvasoverlay.directive';
import { Command } from '../scripts/paths';
import { PathLayer, ClipPathLayer, LayerUtil, VectorLayer } from '../scripts/layers';
import { Point, Matrix, ColorUtil } from '../scripts/common';
import { AnimatorService } from '../services';
import { Store, State, getLayerState } from '../store';
import * as CanvasConstants from './constants';
import { CanvasRulerDirective } from './canvasruler.directive';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { CanvasMixin } from './CanvasMixin';
import { DestroyableMixin } from '../scripts/mixins';
import 'rxjs/add/observable/combineLatest';

type Context = CanvasRenderingContext2D;

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent
  extends CanvasMixin(DestroyableMixin(class { }))
  implements AfterViewInit {

  @ViewChild('canvasContainer') canvasContainerRef: ElementRef;
  @ViewChild('renderingCanvas') renderingCanvasRef: ElementRef;
  @ViewChild(CanvasOverlayDirective) canvasOverlay: CanvasOverlayDirective;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;
  @Input() sizeObservable: Observable<{ w: number, h: number }>;

  private $canvasContainer: JQuery;
  private $renderingCanvas: JQuery;
  private $offscreenLayerCanvas: JQuery;
  private renderingCtx: Context;
  private offscreenLayerCtx: Context;
  private hiddenLayerIds: Set<string>;

  constructor(
    private readonly animatorService: AnimatorService,
    private readonly store: Store<State>,
  ) { super(); }

  ngAfterViewInit() {
    this.$canvasContainer = $(this.canvasContainerRef.nativeElement);
    this.$renderingCanvas = $(this.renderingCanvasRef.nativeElement);
    this.$offscreenLayerCanvas = $(document.createElement('canvas'));
    const getCtxFn = (canvas: JQuery) => {
      return (canvas.get(0) as HTMLCanvasElement).getContext('2d');
    };
    this.renderingCtx = getCtxFn(this.$renderingCanvas);
    this.offscreenLayerCtx = getCtxFn(this.$offscreenLayerCanvas);
    this.registerSubscription(
      this.store.select(getLayerState)
        .subscribe(({ vectorLayers, hiddenLayerIds }) => {
          this.setVectorLayer(vectorLayers[0]);
          this.hiddenLayerIds = hiddenLayerIds;
          this.draw();
        }));
    this.registerSubscription(
      this.sizeObservable
        .subscribe(({ w, h }) => {
          this.setDimensions(w, h);
          this.draw();
        }));
    this.registerSubscription(
      this.animatorService.asObservable().subscribe(event => {
        if (!event.vl) {
          // TODO: don't let this case happen
          return;
        }
        // TODO: how to deal with multiple vector layers?
        this.setVectorLayer(event.vl);
        this.draw();
      }));
  }

  setVectorLayer(vl: VectorLayer) {
    super.setVectorLayer(vl);
    this.canvasOverlay.setVectorLayer(vl);
    this.canvasRulers.forEach(r => r.setVectorLayer(vl));
  }

  setDimensions(w: number, h: number) {
    super.setDimensions(w, h);
    this.canvasOverlay.setDimensions(w, h);
    this.canvasRulers.forEach(r => r.setDimensions(w, h));
  }

  /**
   * Redraws all content.
   */
  draw() {
    this.resizeCanvases(
      this.$canvasContainer,
      this.$renderingCanvas,
      this.$offscreenLayerCanvas,
    );

    this.renderingCtx.save();
    this.setupCtxWithViewportCoords(this.renderingCtx);

    const currentAlpha = this.getVectorLayer() ? this.getVectorLayer().alpha : 1;
    if (currentAlpha < 1) {
      this.offscreenLayerCtx.save();
      this.setupCtxWithViewportCoords(this.offscreenLayerCtx);
    }

    // If the canvas is disabled, draw the layer to an offscreen canvas
    // so that we can draw it translucently w/o affecting the rest of
    // the layer's appearance.
    const layerCtx = currentAlpha < 1 ? this.offscreenLayerCtx : this.renderingCtx;

    this.drawLayers(layerCtx);

    if (currentAlpha < 1) {
      this.drawTranslucentOffscreenCtx(
        this.renderingCtx, this.offscreenLayerCtx, currentAlpha);
      this.offscreenLayerCtx.restore();
    }
    this.renderingCtx.restore();

    this.canvasOverlay.draw();
    this.canvasRulers.forEach(r => r.draw());
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
    this.getVectorLayer().walk(layer => {
      if (this.hiddenLayerIds.has(layer.id)) {
        return false;
      }
      if (layer instanceof ClipPathLayer) {
        if (!layer.pathData) {
          return true;
        }
        const transforms = LayerUtil.getTransformsForLayer(this.getVectorLayer(), layer.name);
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

      const transforms = LayerUtil.getTransformsForLayer(this.getVectorLayer(), layer.name);
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
    const canvasOffset = this.$canvasContainer.offset();
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

interface Size {
  readonly w: number;
  readonly h: number;
}
