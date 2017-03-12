import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  Input, ViewChildren, QueryList, ChangeDetectionStrategy
} from '@angular/core';
import {
  Path, SubPath, Command, Index as CommandIndex, Projection
} from '../scripts/commands';
import { PathLayer, ClipPathLayer, VectorLayer, GroupLayer, Layer } from '../scripts/layers';
import { CanvasType } from '../CanvasType';
import * as $ from 'jquery';
import { Point, Matrix, MathUtil, ColorUtil } from '../scripts/common';
import { AnimatorService } from '../services/animator.service';
import { LayerStateService, MorphabilityStatus } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { SelectionStateService, Selection } from '../services/selectionstate.service';
import { HoverStateService, Type as HoverType, Hover } from '../services/hoverstate.service';
import { CanvasResizeService } from '../services/canvasresize.service';
import { CanvasRulerDirective } from './canvasruler.directive';
import { SettingsService } from '../services/settings.service';

const MIN_SNAP_THRESHOLD = 1.5;
const DRAG_TRIGGER_TOUCH_SLOP = 1;
const SIZE_TO_POINT_RADIUS_FACTOR = 1 / 50;
const SPLIT_POINT_RADIUS_FACTOR = 0.8;
const SELECTED_POINT_RADIUS_FACTOR = 1.25;
const POINT_BORDER_FACTOR = 1.075;
const DISABLED_LAYER_ALPHA = 0.38;

// Canvas margin in css pixels.
export const CANVAS_MARGIN = 36;

// Default viewport size in viewport pixels.
export const DEFAULT_VIEWPORT_SIZE = 24;

// The line width of a selection in css pixels.
const SELECTION_LINE_WIDTH = 6;

const MOVE_POINT_COLOR = '#2962FF'; // Blue A400
const NORMAL_POINT_COLOR = '#2962FF'; // Blue A400
const SPLIT_POINT_COLOR = '#E65100'; // Orange 900

const POINT_BORDER_COLOR = '#000';
const POINT_TEXT_COLOR = '#fff';
const SELECTION_OUTER_COLOR = '#fff';
const SELECTION_INNER_COLOR = '#2196f3';

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() canvasType: CanvasType;
  @ViewChild('renderingCanvas') private renderingCanvasRef: ElementRef;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;

  private cssContainerWidth = 1;
  private cssContainerHeight = 1;
  private vlWidth = DEFAULT_VIEWPORT_SIZE;
  private vlHeight = DEFAULT_VIEWPORT_SIZE;
  private element: JQuery;
  private canvas: JQuery;
  private offscreenCanvas: JQuery;
  private cssScale: number;
  private attrScale: number;
  private isViewInit: boolean;
  private pathPointRadius: number;
  private currentHover: Hover;
  private currentHoverSplitPreviewPath: Path;
  private shouldLabelPoints = false;
  private shouldDisableLayer = false;
  private readonly subscriptions: Subscription[] = [];

  // If present, then a mouse gesture is currently in progress.
  private pointSelector: PointSelector | undefined;

  constructor(
    private elementRef: ElementRef,
    private canvasResizeService: CanvasResizeService,
    private hoverStateService: HoverStateService,
    private layerStateService: LayerStateService,
    private animatorService: AnimatorService,
    private selectionStateService: SelectionStateService,
    private settingsService: SettingsService) { }

  ngAfterViewInit() {
    this.isViewInit = true;
    this.element = $(this.elementRef.nativeElement);
    this.canvas = $(this.renderingCanvasRef.nativeElement);
    this.offscreenCanvas = $(document.createElement('canvas'));
    this.subscriptions.push(
      this.layerStateService.getVectorLayerObservable(this.canvasType)
        .subscribe(vl => {
          const newWidth = vl ? vl.width : DEFAULT_VIEWPORT_SIZE;
          const newHeight = vl ? vl.height : DEFAULT_VIEWPORT_SIZE;
          const didSizeChange = this.vlWidth !== newWidth || this.vlHeight !== newHeight;
          this.vlWidth = newWidth;
          this.vlHeight = newHeight;
          if (didSizeChange) {
            this.resizeAndDraw();
          } else {
            this.draw();
          }
        }));
    this.canvasResizeService.getCanvasResizeObservable()
      .subscribe(size => {
        const oldWidth = this.cssContainerWidth;
        const oldHeight = this.cssContainerHeight;
        this.cssContainerWidth = Math.max(1, size.width - CANVAS_MARGIN * 2);
        this.cssContainerHeight = Math.max(1, size.height - CANVAS_MARGIN * 2);
        if (this.cssContainerWidth !== oldWidth || this.cssContainerHeight !== oldHeight) {
          this.resizeAndDraw();
        }
      });
    if (this.canvasType === CanvasType.Preview) {
      // Preview canvas specific setup.
      const interpolatePreview = (fraction: number) => {
        const startPathLayer =
          this.layerStateService.getActivePathLayer(CanvasType.Start);
        const previewPathLayer =
          this.layerStateService.getActivePathLayer(CanvasType.Preview);
        const endPathLayer =
          this.layerStateService.getActivePathLayer(CanvasType.End);
        if (startPathLayer && previewPathLayer && endPathLayer) {
          // Note that there is no need to broadcast layer state changes
          // for the preview canvas.
          previewPathLayer.interpolate(startPathLayer, endPathLayer, fraction);
        }
        const startGroupLayer =
          this.layerStateService.getActiveRotationLayer(CanvasType.Start);
        const previewGroupLayer =
          this.layerStateService.getActiveRotationLayer(CanvasType.Preview);
        const endGroupLayer =
          this.layerStateService.getActiveRotationLayer(CanvasType.End);
        if (startGroupLayer && previewGroupLayer && endGroupLayer) {
          previewGroupLayer.interpolate(startGroupLayer, endGroupLayer, fraction);
        }
      };
      let currentAnimatedFraction = 0;
      this.subscriptions.push(
        this.layerStateService.getActivePathIdObservable(this.canvasType)
          .subscribe(activePathId => {
            interpolatePreview(currentAnimatedFraction);
            this.draw();
          }));
      this.subscriptions.push(
        this.animatorService.getAnimatedValueObservable()
          .subscribe(fraction => {
            currentAnimatedFraction = fraction;
            interpolatePreview(fraction);
            this.draw();
          }));
      this.subscriptions.push(
        this.settingsService.getSettingsObservable()
          .subscribe(settings => {
            if (this.shouldLabelPoints !== settings.shouldLabelPoints) {
              this.shouldLabelPoints = settings.shouldLabelPoints;
              this.draw();
            }
          }));
      this.subscriptions.push(
        this.layerStateService.getMorphabilityStatusObservable()
          .subscribe(status => {
            this.shouldDisableLayer = status !== MorphabilityStatus.Morphable;
            this.draw();
          }));
    } else {
      // Non-preview canvas specific setup.
      this.subscriptions.push(
        this.layerStateService.getActivePathIdObservable(this.canvasType)
          .subscribe(activePathId => {
            this.draw();
          }));
      this.subscriptions.push(
        this.selectionStateService.getSelectionsObservable()
          .subscribe(() => this.draw()));
      const updateCurrentHoverFn = (hover: Hover) => {
        this.currentHover = hover;
        if (hover
          && hover.type === HoverType.Split
          && hover.commandId.pathId === this.activePathId) {
          // If the user is hovering over the inspector split button, then build
          // a snapshot of what the path would look like after the action
          // and display the result. Note that after the split action,
          // the hover's cmdIdx can be used to identify the new split point.
          const activePathLayer =
            this.layerStateService.getActivePathLayer(this.canvasType);
          this.currentHoverSplitPreviewPath =
            activePathLayer.pathData.splitInHalf(
              hover.commandId.subIdx,
              hover.commandId.cmdIdx);
        } else {
          this.currentHoverSplitPreviewPath = undefined;
        }
        this.draw();
      };
      this.subscriptions.push(
        this.hoverStateService.getHoverObservable()
          .subscribe(hover => {
            if (!hover) {
              // Clear the current hover.
              updateCurrentHoverFn(undefined);
              return;
            }
            if (!(hover.type === HoverType.Command
              || hover.type === HoverType.Split
              || hover.type === HoverType.Unsplit)) {
              // TODO: support reverse/shift back/shift forward? it would be pretty easy...
              updateCurrentHoverFn(undefined);
              return;
            }
            if (hover.source !== this.canvasType
              && (hover.type === HoverType.Split || hover.type === HoverType.Unsplit)) {
              // If the hover source isn't of this type and the hover type is a split
              // or an unsplit, then don't draw any hover events to the canvas.
              updateCurrentHoverFn(undefined);
              return;
            }
            updateCurrentHoverFn(hover);
          }));
    }
    this.resizeAndDraw();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private get vectorLayer() {
    return this.layerStateService.getVectorLayer(this.canvasType);
  }

  private get activePathId() {
    return this.layerStateService.getActivePathId(this.canvasType);
  }

  private get shouldDrawLayer() {
    return !!this.vectorLayer && !!this.activePathId;
  }

  private resizeAndDraw() {
    if (!this.isViewInit) {
      return;
    }
    const vectorAspectRatio = this.vlWidth / this.vlHeight;
    const containerAspectRatio = this.cssContainerWidth / this.cssContainerHeight;

    // The 'cssScale' represents the number of CSS pixels per SVG viewport pixel.
    if (vectorAspectRatio > containerAspectRatio) {
      this.cssScale = this.cssContainerWidth / this.vlWidth;
    } else {
      this.cssScale = this.cssContainerHeight / this.vlHeight;
    }

    // The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
    this.attrScale = this.cssScale * devicePixelRatio;

    const cssWidth = this.vlWidth * this.cssScale;
    const cssHeight = this.vlHeight * this.cssScale;
    [this.canvas, this.offscreenCanvas].forEach(canvas => {
      canvas
        .attr({
          width: cssWidth * devicePixelRatio,
          height: cssHeight * devicePixelRatio,
        })
        .css({
          width: cssWidth,
          height: cssHeight,
        });
    });

    // TODO: set a min amount of pixels to use as the radius.
    const size = Math.min(this.cssContainerWidth, this.cssContainerHeight);
    this.pathPointRadius =
      size * SIZE_TO_POINT_RADIUS_FACTOR / Math.max(2, this.cssScale);
    this.draw();
    this.canvasRulers.forEach(r => r.draw());
  }

  private draw() {
    if (!this.isViewInit) {
      return;
    }
    const ctx = (this.canvas.get(0) as HTMLCanvasElement).getContext('2d');
    const offscreenCtx =
      (this.offscreenCanvas.get(0) as HTMLCanvasElement).getContext('2d');

    ctx.save();

    // Scale the canvas so that everything from this point forward is drawn
    // in terms of viewport coordinates.
    ctx.scale(this.attrScale, this.attrScale);
    ctx.clearRect(0, 0, this.vlWidth, this.vlHeight);

    const currentAlpha = this.shouldDisableLayer ? DISABLED_LAYER_ALPHA : 1;
    // TODO: draw vector layer's alpha property w/o fading out selections/points
    // if (this.shouldDrawLayer) {
    //   currentAlpha *= this.vectorLayer.alpha;
    // }
    if (currentAlpha < 1) {
      offscreenCtx.save();
      offscreenCtx.scale(this.attrScale, this.attrScale);
      offscreenCtx.clearRect(0, 0, this.vlWidth, this.vlHeight);
    }

    // If the canvas is disabled, draw the layer to an offscreen canvas
    // so that we can draw it translucently below.
    const drawingCtx = currentAlpha < 1 ? offscreenCtx : ctx;
    if (this.shouldDrawLayer) {
      drawPathLayer(drawingCtx, this.vectorLayer, layer => layer.id === this.activePathId);
      const selections =
        this.selectionStateService.getSelections().filter(selection => {
          return selection.source === this.canvasType
            && selection.commandId.pathId === this.activePathId;
        });
      drawSelections(
        drawingCtx, this.vectorLayer, selections, SELECTION_LINE_WIDTH / this.cssScale);
      this.drawLabeledPoints(drawingCtx);
      this.drawDraggingPoints(drawingCtx);
    }

    if (currentAlpha < 1) {
      ctx.save();
      ctx.globalAlpha = currentAlpha;
      // Bring the canvas back to its original coordinates before
      // drawing the offscreen canvas contents.
      ctx.scale(1 / this.attrScale, 1 / this.attrScale);
      ctx.drawImage(offscreenCtx.canvas, 0, 0);
      ctx.restore();
      offscreenCtx.restore();
    }
    ctx.restore();

    // Note that we do not draw the pixel grid in viewport coordinates
    // as we do above.
    if (this.cssScale > 4) {
      this.drawPixelGrid(ctx);
    }
  }

  // Draw any labeled points.
  private drawLabeledPoints(ctx: CanvasRenderingContext2D) {
    if (this.canvasType === CanvasType.Preview && !this.shouldLabelPoints) {
      return;
    }
    const activePathLayer =
      this.layerStateService.getActivePathLayer(this.canvasType);
    if (!activePathLayer) {
      return;
    }

    const pathId = activePathLayer.id;
    let path = activePathLayer.pathData;
    if (this.currentHoverSplitPreviewPath) {
      path = this.currentHoverSplitPreviewPath;
    }

    // Build a list containing all necessary information needed in
    // order to draw the labeled points.
    const activelyDraggedPointId =
      this.pointSelector
        && this.pointSelector.isDragging()
        && this.pointSelector.isActive()
        && this.pointSelector.isSelectedPointSplit()
        ? this.pointSelector.getSelectedPointId()
        : undefined;
    const transforms =
      getTransformsForLayer(this.vectorLayer, activePathLayer.id).reverse();
    const currentSelections =
      this.selectionStateService.getSelections()
        .filter(s => s.source === this.canvasType);
    const pathDataPointInfos =
      _.chain(path.getSubPaths())
        .map((subCmd: SubPath, subIdx: number) => {
          return subCmd.getCommands().map((cmd, cmdIdx) => {
            const commandId = { pathId, subIdx, cmdIdx } as CommandIndex;
            const isSplit = cmd.isSplit;
            const isMove = cmd.svgChar === 'M';
            const isHoverOrSelection =
              (this.currentHover
                && this.currentHover.commandId.subIdx === subIdx
                && this.currentHover.commandId.cmdIdx === cmdIdx)
              || currentSelections.some(sel => _.isMatch(sel.commandId, commandId));
            const isDrag =
              activelyDraggedPointId && _.isMatch(activelyDraggedPointId, commandId);
            const point = MathUtil.transformPoint(_.last(cmd.points), ...transforms);
            const position = cmdIdx + 1;
            return { commandId, isSplit, isMove, isHoverOrSelection, isDrag, point, position };
          });
        })
        .flatMap(pointInfos => pointInfos)
        // Skip the currently dragged point, if it exists.
        // We'll draw that separately next.
        .filter(pointInfo => !pointInfo.isDrag)
        .value();

    const hoverSelectionPoints = [];
    const splitPoints = [];
    const movePoints = [];
    const normalPoints = [];

    for (const pointInfo of pathDataPointInfos) {
      let pointList;
      if (pointInfo.isHoverOrSelection) {
        pointList = hoverSelectionPoints;
      } else if (pointInfo.isSplit) {
        pointList = splitPoints;
      } else if (pointInfo.isMove) {
        pointList = movePoints;
      } else {
        pointList = normalPoints;
      }
      pointList.push(pointInfo);
    }

    const drawnPoints =
      [].concat(normalPoints, movePoints, splitPoints, hoverSelectionPoints);

    for (const pointInfo of drawnPoints) {
      let color, radius;
      if (pointInfo.isMove) {
        color = MOVE_POINT_COLOR;
        radius = this.pathPointRadius;
      } else if (pointInfo.isSplit && this.canvasType !== CanvasType.Preview) {
        color = SPLIT_POINT_COLOR;
        radius = this.pathPointRadius * SPLIT_POINT_RADIUS_FACTOR;
      } else {
        color = NORMAL_POINT_COLOR;
        radius = this.pathPointRadius;
      }
      if (pointInfo.isHoverOrSelection) {
        radius = this.pathPointRadius * SELECTED_POINT_RADIUS_FACTOR;
      }
      // TODO: figure out when to hide the point text from the user?
      const text =
        this.cssScale > 4 || pointInfo.isHoverOrSelection
          ? pointInfo.position
          : undefined;
      this.drawLabeledPoint(ctx, pointInfo.point, radius, color, text);
    }
  }

  // Draw any actively dragged points along the path.
  private drawDraggingPoints(ctx: CanvasRenderingContext2D) {
    if (!this.pointSelector
      || !this.pointSelector.isActive()
      || !this.pointSelector.isDragging()
      || !this.pointSelector.isSelectedPointSplit()) {
      return;
    }
    const lastKnownLocation = this.pointSelector.getLastKnownLocation();
    const projectionOntoPath =
      calculateProjectionOntoPath(this.vectorLayer, this.activePathId, lastKnownLocation);
    const projection = projectionOntoPath.projection;
    let point;
    if (projection.d < MIN_SNAP_THRESHOLD) {
      point = new Point(projection.x, projection.y);
      point = MathUtil.transformPoint(
        point, MathUtil.flattenTransforms(
          getTransformsForLayer(this.vectorLayer, this.activePathId).reverse()));
    } else {
      point = lastKnownLocation;
    }
    this.drawLabeledPoint(
      ctx, point, this.pathPointRadius * SPLIT_POINT_RADIUS_FACTOR, SPLIT_POINT_COLOR);
  }

  // Draws a labeled point with optional text.
  private drawLabeledPoint(
    ctx: CanvasRenderingContext2D,
    point: Point,
    radius: number,
    color: string,
    text?: string) {

    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * POINT_BORDER_FACTOR, 0, 2 * Math.PI, false);
    ctx.fillStyle = POINT_BORDER_COLOR;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();

    if (text) {
      ctx.beginPath();
      ctx.fillStyle = POINT_TEXT_COLOR;
      ctx.font = radius + 'px Roboto, Helvetica Neue, sans-serif';
      const width = ctx.measureText(text).width;
      // TODO: is there a better way to get the height?
      const height = ctx.measureText('o').width;
      ctx.fillText(text, point.x - width / 2, point.y + height / 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw the pixel grid.
  private drawPixelGrid(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const devicePixelRatio = window.devicePixelRatio || 1;
    ctx.fillStyle = 'rgba(128, 128, 128, .25)';
    for (let x = 1; x < this.vlWidth; x++) {
      ctx.fillRect(
        x * this.attrScale - 0.5 * devicePixelRatio,
        0,
        devicePixelRatio,
        this.vlHeight * this.attrScale);
    }
    for (let y = 1; y < this.vlHeight; y++) {
      ctx.fillRect(
        0,
        y * this.attrScale - 0.5 * devicePixelRatio,
        this.vlWidth * this.attrScale,
        devicePixelRatio);
    }
    ctx.restore();
  }

  onMouseDown(event: MouseEvent) {
    if (this.canvasType === CanvasType.Preview || !this.activePathId) {
      return;
    }
    const mouseDown = this.mouseEventToPoint(event);
    const selectedPointId =
      findPathLayerPoint(
        this.vectorLayer, this.activePathId, mouseDown, this.pathPointRadius);
    if (selectedPointId && selectedPointId.pathId === this.activePathId) {
      // A mouse down event ocurred on top of a point. Create a point selector
      // and track that sh!at.
      const selectedCmd =
        (this.vectorLayer.findLayer(selectedPointId.pathId) as PathLayer)
          .pathData
          .getSubPaths()[selectedPointId.subIdx]
          .getCommands()[selectedPointId.cmdIdx];
      this.pointSelector =
        new PointSelector(mouseDown, selectedPointId, selectedCmd.isSplit);
    } else if (!event.shiftKey && !event.metaKey) {
      // If the mouse down event didn't occur on top of a point, then
      // clear any existing selections, but only if the user isn't in
      // the middle of selecting multiple points at once.
      this.selectionStateService.reset();
    }
  }

  onMouseMove(event: MouseEvent) {
    this.showRuler(event);

    if (this.canvasType === CanvasType.Preview || !this.activePathId) {
      return;
    }

    const mouseMove = this.mouseEventToPoint(event);
    let isDraggingSplitPoint = false;
    if (this.pointSelector) {
      this.pointSelector.onMouseMove(mouseMove);
      isDraggingSplitPoint =
        this.pointSelector.isSelectedPointSplit() && this.pointSelector.isDragging();
      if (isDraggingSplitPoint) {
        this.draw();
      }
    }

    if (isDraggingSplitPoint) {
      // Don't draw hover events if we are dragging.
      return;
    }

    const hoverPointId =
      findPathLayerPoint(
        this.vectorLayer, this.activePathId, mouseMove, this.pathPointRadius);
    if (hoverPointId) {
      this.hoverStateService.setHover({
        type: HoverType.Command,
        source: this.canvasType,
        commandId: hoverPointId,
      });
    } else {
      this.hoverStateService.reset();
    }
  }

  onMouseUp(event: MouseEvent) {
    if (this.canvasType === CanvasType.Preview || !this.activePathId) {
      return;
    }
    if (this.pointSelector) {
      const mousePoint = this.mouseEventToPoint(event);
      this.pointSelector.onMouseUp(mousePoint);

      const selectedPointId = this.pointSelector.getSelectedPointId();
      if (this.pointSelector.isDragging()) {
        if (this.pointSelector.isSelectedPointSplit()) {
          const activeLayer =
            this.vectorLayer.findLayer(selectedPointId.pathId) as PathLayer;

          // Delete the old drag point from the path.
          activeLayer.pathData =
            activeLayer.pathData.unsplit(
              selectedPointId.subIdx, selectedPointId.cmdIdx);

          // Re-split the path at the projection point.
          activeLayer.pathData =
            calculateProjectionOntoPath(this.vectorLayer, this.activePathId, mousePoint)
              .splitFn();

          // Notify the global layer state service about the change and draw.
          // Clear any existing selections and/or hovers as well.
          this.hoverStateService.reset();
          this.selectionStateService.reset();
          this.layerStateService.updateActivePath(
            this.canvasType, activeLayer.pathData, selectedPointId.subIdx);
        }
      } else {
        // If we haven't started dragging a point, then we should select
        // the point instead.
        this.selectionStateService.toggle({
          source: this.canvasType,
          commandId: selectedPointId,
        }, event.shiftKey || event.metaKey);
      }

      // Draw and complete the gesture.
      this.draw();
      this.pointSelector = undefined;
    }
  }

  onMouseLeave(event) {
    this.canvasRulers.forEach(r => r.hideMouse());

    if (this.canvasType === CanvasType.Preview || !this.activePathId) {
      return;
    }
    if (this.pointSelector) {
      this.pointSelector.onMouseLeave(this.mouseEventToPoint(event));
      this.draw();
    }
  }

  private showRuler(event: MouseEvent) {
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / Math.max(1, this.cssScale);
    const y = (event.pageY - canvasOffset.top) / Math.max(1, this.cssScale);
    this.canvasRulers.forEach(r => r.showMouse(new Point(_.round(x), _.round(y))));
  }

  /**
   * Converts a mouse point's CSS coordinates into vector layer viewport coordinates.
   */
  private mouseEventToPoint(event: MouseEvent) {
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.cssScale;
    const y = (event.pageY - canvasOffset.top) / this.cssScale;
    return new Point(x, y);
  }
}

/**
 * Draws the specified layer ID to the canvas.
 */
function drawPathLayer(
  ctx: CanvasRenderingContext2D,
  vectorLayer: VectorLayer,
  shouldDrawPathLayerFn: (layer: PathLayer) => boolean) {

  const executeCommandsFn = (
    layer: PathLayer | ClipPathLayer,
    transforms: Matrix[]) => {

    const cmds = _.flatMap(
      layer.pathData.getSubPaths(),
      subCmd => subCmd.getCommands() as Command[]);
    executeCommands(cmds, ctx, transforms);
  };

  vectorLayer.walk(layer => {
    const transforms = getTransformsForLayer(vectorLayer, layer.id);
    if (layer instanceof ClipPathLayer) {
      executeCommandsFn(layer, transforms);
      ctx.clip();
      return;
    }
    if (!(layer instanceof PathLayer)) {
      return;
    }
    if (!shouldDrawPathLayerFn(layer)) {
      return;
    }

    // TODO: update layer.pathData.length so that it reflects scale transforms
    ctx.save();
    executeCommandsFn(layer, transforms);

    // TODO: confirm this stroke multiplier thing works...
    const strokeWidthMultiplier = MathUtil.flattenTransforms(transforms).getScale();
    ctx.strokeStyle = ColorUtil.androidToCssColor(layer.strokeColor, layer.strokeAlpha);
    ctx.lineWidth = layer.strokeWidth * strokeWidthMultiplier;
    ctx.fillStyle = ColorUtil.androidToCssColor(layer.fillColor, layer.fillAlpha);
    ctx.lineCap = layer.strokeLinecap;
    ctx.lineJoin = layer.strokeLinejoin;
    ctx.miterLimit = layer.strokeMiterLimit || 4;

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
        (1 - shownFraction + 0.001) * layer.pathData.getPathLength()
      ]);
      // The amount to offset the path is equal to the trimPathStart plus
      // trimPathOffset. We mod the result because the trimmed path
      // should wrap around once it reaches 1.
      ctx.lineDashOffset = layer.pathData.getPathLength()
        * (1 - ((layer.trimPathStart + layer.trimPathOffset) % 1));
    } else {
      ctx.setLineDash([]);
    }
    if (layer.strokeColor
      && layer.strokeWidth
      && layer.trimPathStart !== layer.trimPathEnd) {
      ctx.stroke();
    }
    if (layer.fillColor) {
      ctx.fill();
    }
    ctx.restore();
  });
}

/**
 * Draws any selected commands to the canvas.
 */
function drawSelections(
  ctx: CanvasRenderingContext2D,
  vectorLayer: VectorLayer,
  selections: Selection[],
  lineWidth: number) {

  if (!selections.length) {
    return;
  }

  // Group the selections by path ID so we can draw them in their
  // correct order below.
  const groupedSelectedCmds =
    _.chain(selections)
      .groupBy(selection => selection.commandId.pathId)
      .mapValues((values: Selection[], pathId: string) => {
        const selectedCmds: Command[] = [];
        const pathLayer = vectorLayer.findLayer(pathId) as PathLayer;
        if (pathLayer) {
          selectedCmds.push(...values.map(
            selection => pathLayer.pathData
              .getSubPaths()[selection.commandId.subIdx]
              .getCommands()[selection.commandId.cmdIdx]));
        }
        return selectedCmds;
      })
      .value();

  // Draw the selections while walking the vector layer to ensure
  // the proper z-order is displayed.
  vectorLayer.walk(layer => {
    const selectedCmds = groupedSelectedCmds[layer.id];
    if (!selectedCmds) {
      return;
    }
    const transforms = getTransformsForLayer(vectorLayer, layer.id);
    executeCommands(selectedCmds, ctx, transforms, true);

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = SELECTION_OUTER_COLOR;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = SELECTION_INNER_COLOR;
    ctx.lineWidth = lineWidth / 2;
    ctx.stroke();
    ctx.restore();
  });
}

/**
 * Returns a list of parent transforms for the specified layer ID. The transforms
 * are returned in top-down order (i.e. the transform for the layer's
 * immediate parent will be the very last matrix in the returned list). This
 * function returns undefined if the layer is not found in the vector layer.
 */
function getTransformsForLayer(vectorLayer: VectorLayer, layerId: string) {
  const getTransformsFn = (parents: Layer[], current: Layer) => {
    if (current.id === layerId) {
      return _.flatMap(parents, layer => {
        if (!(layer instanceof GroupLayer)) {
          return [];
        }
        return [
          Matrix.fromTranslation(layer.pivotX, layer.pivotY),
          Matrix.fromTranslation(layer.translateX, layer.translateY),
          Matrix.fromRotation(layer.rotation),
          Matrix.fromScaling(layer.scaleX, layer.scaleY),
          Matrix.fromTranslation(-layer.pivotX, -layer.pivotY),
        ];
      });
    }
    if (current.children) {
      for (const child of current.children) {
        const transforms = getTransformsFn(parents.concat([current]), child);
        if (transforms) {
          return transforms;
        }
      }
    }
    return undefined;
  };
  return getTransformsFn([], vectorLayer);
}

/**
 * Finds the path point closest to the specified mouse point, with a max
 * distance specified by radius. Draggable points are returned with higher
 * priority than non-draggable points. Returns undefined if no point is found.
 */
function findPathLayerPoint(
  vectorLayer: VectorLayer,
  pathId: string,
  mousePoint: Point,
  pointRadius: number): CommandIndex | undefined {

  const pathLayer = vectorLayer.findLayer(pathId) as PathLayer;
  if (!pathLayer) {
    return undefined;
  }
  const transforms = getTransformsForLayer(vectorLayer, pathId).reverse();
  const transformedMousePoint =
    MathUtil.transformPoint(
      mousePoint,
      MathUtil.flattenTransforms(transforms).invert());
  return _.chain(pathLayer.pathData.getSubPaths())
    .map((subCmd: SubPath, subIdx: number) => {
      return subCmd.getCommands()
        .map((cmd, cmdIdx) => {
          const distance = MathUtil.distance(cmd.end, transformedMousePoint);
          const isSplit = cmd.isSplit;
          return { pathId, subIdx, cmdIdx, distance, isSplit };
        });
    })
    .flatMap(pathPoints => pathPoints)
    .filter(pathPoint => {
      const radius =
        pathPoint.isSplit ? pointRadius * SPLIT_POINT_RADIUS_FACTOR : pointRadius;
      return pathPoint.distance <= radius;
    })
    // Reverse so that points drawn with higher z-orders are preferred.
    .reverse()
    .reduce((prev, curr) => {
      if (!prev) {
        return curr;
      }
      if (prev.isSplit !== curr.isSplit) {
        // Always return split points that are in range before
        // returning non-split points. This way we can guarantee that
        // split points will never be obstructed by non-split points.
        return prev.isSplit ? prev : curr;
      }
      return prev.distance < curr.distance ? prev : curr;
    }, undefined)
    .value();
}

function executeCommands(
  commands: Command[],
  ctx: CanvasRenderingContext2D,
  transforms: Matrix[],
  isDrawingSelection = false) {

  ctx.save();
  transforms.forEach(m => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f));
  ctx.beginPath();
  commands.forEach(cmd => {
    const start = cmd.start;
    const end = cmd.end;

    // TODO: remove this... or at least only use it for selections?
    // this probably doesn't work for close path commands too?
    if (isDrawingSelection && cmd.svgChar !== 'M') {
      ctx.moveTo(start.x, start.y);
    }

    if (cmd.svgChar === 'M') {
      ctx.moveTo(end.x, end.y);
    } else if (cmd.svgChar === 'L') {
      ctx.lineTo(end.x, end.y);
    } else if (cmd.svgChar === 'Q') {
      ctx.quadraticCurveTo(
        cmd.points[1].x, cmd.points[1].y,
        cmd.points[2].x, cmd.points[2].y);
    } else if (cmd.svgChar === 'C') {
      ctx.bezierCurveTo(
        cmd.points[1].x, cmd.points[1].y,
        cmd.points[2].x, cmd.points[2].y,
        cmd.points[3].x, cmd.points[3].y);
    } else if (cmd.svgChar === 'Z') {
      ctx.closePath();
    }
  });
  ctx.restore();
}

/**
 * Calculates the projection onto the path with the specified path ID.
 * The resulting projection is our way of determining the on-curve point
 * closest to the specified off-curve mouse point.
 */
function calculateProjectionOntoPath(
  vectorLayer: VectorLayer,
  pathId: string,
  mousePoint: Point): ProjectionOntoPath | undefined {

  const pathLayer = vectorLayer.findLayer(pathId) as PathLayer;
  if (!pathLayer) {
    return undefined;
  }
  const transforms = getTransformsForLayer(vectorLayer, pathId).reverse();
  const transformedMousePoint =
    MathUtil.transformPoint(
      mousePoint,
      MathUtil.flattenTransforms(transforms).invert());
  const projectionInfo = pathLayer.pathData.project(transformedMousePoint);
  if (!projectionInfo) {
    return undefined;
  }
  return {
    pathId: pathLayer.id,
    projection: projectionInfo.projection,
    splitFn: projectionInfo.splitFn,
  };
}

/**
 * Contains information about a projection onto a path.
 */
interface ProjectionOntoPath {
  pathId: string;
  projection: Projection;
  splitFn: () => Path;
}

/**
 * Helper class that tracks information about a user's mouse gesture.
 */
class PointSelector {
  private lastKnownLocation: Point;
  private isDragTriggered = false;
  private isGestureActive = true;

  constructor(
    private readonly mouseDown: Point,
    private readonly selectedPointId: CommandIndex,
    private readonly selectedPointSplit: boolean) {
    this.lastKnownLocation = mouseDown;
  }

  onMouseMove(mouseMove: Point) {
    this.lastKnownLocation = mouseMove;
    const distance = MathUtil.distance(this.mouseDown, mouseMove);
    if (DRAG_TRIGGER_TOUCH_SLOP < distance) {
      this.isDragTriggered = true;
    }
  }

  onMouseUp(mouseUp: Point) {
    this.lastKnownLocation = mouseUp;
    this.isGestureActive = false;
  }

  onMouseLeave(mouseLeave: Point) {
    this.lastKnownLocation = mouseLeave;
  }

  isDragging() {
    return this.isDragTriggered;
  }

  isActive() {
    return this.isGestureActive;
  }

  getLastKnownLocation() {
    return this.lastKnownLocation;
  }

  getSelectedPointId() {
    return this.selectedPointId;
  }

  isSelectedPointSplit() {
    return this.selectedPointSplit;
  }
}
