import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  Input, ViewChildren, QueryList, ChangeDetectionStrategy
} from '@angular/core';
import {
  Path,
  SubPath,
  Command,
  Index as CommandIndex,
  ProjectionOntoPath,
} from '../scripts/commands';
import { PathLayer, ClipPathLayer, VectorLayer, GroupLayer, Layer } from '../scripts/layers';
import { CanvasType } from '../CanvasType';
import * as $ from 'jquery';
import { Point, Matrix, MathUtil, ColorUtil } from '../scripts/common';
import { Subscription } from 'rxjs/Subscription';
import { HoverStateService, Type as HoverType, Hover } from '../services/hoverstate.service';
import {
  AnimatorService,
  CanvasResizeService,
  CanvasModeService,
  CanvasMode,
  SelectionStateService,
  Selection,
  LayerStateService,
  MorphabilityStatus,
} from '../services';
import { CanvasRulerDirective } from './canvasruler.directive';
import { SettingsService } from '../services/settings.service';

// TODO: need to update this value... doesn't work for large viewports very well
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

  // If present, then the user is in selection mode and a
  // mouse gesture is currently in progress.
  private pointSelector: PointSelector | undefined;
  // If true, then the user is in add points mode and a mouse
  // down event occurred close enough to the path to allow a
  // a point to be created on the next mouse up event (assuming
  // the mouse's location is still within range of the path).
  private shouldCreatePointOnMouseUp = false;
  // The last known location of the mouse.
  private lastKnownMouseLocation: Point | undefined;

  constructor(
    private readonly elementRef: ElementRef,
    private readonly canvasModeService: CanvasModeService,
    private readonly canvasResizeService: CanvasResizeService,
    private readonly hoverStateService: HoverStateService,
    private readonly layerStateService: LayerStateService,
    private readonly animatorService: AnimatorService,
    private readonly selectionStateService: SelectionStateService,
    private readonly settingsService: SettingsService) { }

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
    this.subscriptions.push(
      this.canvasResizeService.getCanvasResizeObservable()
        .subscribe(size => {
          const oldWidth = this.cssContainerWidth;
          const oldHeight = this.cssContainerHeight;
          this.cssContainerWidth = Math.max(1, size.width - CANVAS_MARGIN * 2);
          this.cssContainerHeight = Math.max(1, size.height - CANVAS_MARGIN * 2);
          if (this.cssContainerWidth !== oldWidth || this.cssContainerHeight !== oldHeight) {
            this.resizeAndDraw();
          }
        }));
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
          .subscribe(_ => this.draw()));
      this.subscriptions.push(
        this.selectionStateService.getSelectionsObservable()
          .subscribe(() => this.draw()));
      this.subscriptions.push(
        this.canvasModeService.getCanvasModeObservable()
          .subscribe(canvasMode => {
            this.selectionStateService.reset();
            this.hoverStateService.reset();
            this.pointSelector = undefined;
            this.shouldCreatePointOnMouseUp = false;
            this.lastKnownMouseLocation = undefined;
            this.draw();
          }));
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
            activePathLayer.pathData.mutate()
              .splitCommandInHalf(hover.commandId.subIdx, hover.commandId.cmdIdx)
              .build();
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

  private get activePath() {
    if (!this.activePathId) {
      return undefined;
    }
    return this.layerStateService.getActivePathLayer(this.canvasType).pathData;
  }

  private get shouldDrawLayer() {
    return !!this.vectorLayer && !!this.activePathId;
  }

  private get canvasMode() {
    return this.canvasModeService.getCanvasMode();
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
      this.drawAddPointPreview(drawingCtx);
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
    const pathId = this.activePathId;
    if (!pathId) {
      return;
    }

    let path = this.activePath;
    if (this.currentHoverSplitPreviewPath) {
      path = this.currentHoverSplitPreviewPath;
    }

    // Build a list containing all necessary information needed in
    // order to draw the labeled points.
    const activelyDraggedCommandIndex =
      this.pointSelector
        && this.pointSelector.isDragging()
        && this.pointSelector.isMousePressedDown()
        && this.pointSelector.isSelectedPointSplit()
        ? this.pointSelector.getSelectedCommandIndex()
        : undefined;
    const transforms =
      getTransformsForLayer(this.vectorLayer, this.activePathId).reverse();
    const currentSelections =
      this.selectionStateService.getSelections()
        .filter(s => s.source === this.canvasType);
    const pathDataPointInfos =
      _.chain(path.getSubPaths() as SubPath[])
        .map((subCmd, subIdx) => {
          return subCmd.getCommands().map((cmd, cmdIdx) => {
            const commandId = { pathId, subIdx, cmdIdx } as CommandIndex;
            const isSplit = cmd.isSplit();
            const isMove = cmd.getSvgChar() === 'M';
            const isHoverOrSelection =
              (this.currentHover
                && this.currentHover.commandId.subIdx === subIdx
                && this.currentHover.commandId.cmdIdx === cmdIdx)
              || currentSelections.some(sel => _.isMatch(sel.commandId, commandId));
            const isDrag =
              activelyDraggedCommandIndex && _.isMatch(activelyDraggedCommandIndex, commandId);
            const point = MathUtil.transformPoint(_.last(cmd.getPoints()), ...transforms);
            const position = cmdIdx + 1;
            return { commandId, isSplit, isMove, isHoverOrSelection, isDrag, point, position };
          });
        })
        .flatMap(pointInfos => pointInfos)
        // Skip the currently dragged point, if it exists.
        // We'll draw that separately next.
        .filter(pointInfo => !pointInfo.isDrag)
        .value();

    interface PointInfo {
      isMove: boolean;
      isSplit: boolean;
      isHoverOrSelection: boolean;
      point: Point;
      position: number;
    }

    const hoverSelectionPoints: PointInfo[] = [];
    const splitPoints: PointInfo[] = [];
    const movePoints: PointInfo[] = [];
    const normalPoints: PointInfo[] = [];

    for (const pointInfo of pathDataPointInfos) {
      let pointList: PointInfo[];
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

    const drawnPoints: PointInfo[] =
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
          ? pointInfo.position.toString()
          : undefined;
      this.drawLabeledPoint(ctx, pointInfo.point, radius, color, text);
    }
  }

  // Draw any actively dragged points along the path (selection mode only).
  private drawDraggingPoints(ctx: CanvasRenderingContext2D) {
    if (this.canvasMode !== CanvasMode.SelectPoints
      || !this.lastKnownMouseLocation
      || !this.pointSelector
      || !this.pointSelector.isMousePressedDown()
      || !this.pointSelector.isDragging()
      || !this.pointSelector.isSelectedPointSplit()) {
      return;
    }
    // TODO: reuse this code
    const projectionOntoPath =
      calculateProjectionOntoPath(
        this.vectorLayer, this.activePathId, this.lastKnownMouseLocation);
    const projection = projectionOntoPath.projection;
    let point;
    if (projection.d < MIN_SNAP_THRESHOLD) {
      point = new Point(projection.x, projection.y);
      point = MathUtil.transformPoint(
        point, MathUtil.flattenTransforms(
          getTransformsForLayer(this.vectorLayer, this.activePathId).reverse()));
    } else {
      point = this.lastKnownMouseLocation;
    }
    this.drawLabeledPoint(
      ctx, point, this.pathPointRadius * SPLIT_POINT_RADIUS_FACTOR, SPLIT_POINT_COLOR);
  }

  // Draw a preview of the newly added point (add points mode only).
  private drawAddPointPreview(ctx: CanvasRenderingContext2D) {
    if (this.canvasMode !== CanvasMode.AddPoints || !this.lastKnownMouseLocation) {
      return;
    }
    // TODO: reuse this code
    const projectionOntoPath =
      calculateProjectionOntoPath(
        this.vectorLayer, this.activePathId, this.lastKnownMouseLocation);
    const projection = projectionOntoPath.projection;
    let point;
    if (projection.d < MIN_SNAP_THRESHOLD) {
      point = new Point(projection.x, projection.y);
      point = MathUtil.transformPoint(
        point, MathUtil.flattenTransforms(
          getTransformsForLayer(this.vectorLayer, this.activePathId).reverse()));
      this.drawLabeledPoint(
        ctx, point, this.pathPointRadius * SPLIT_POINT_RADIUS_FACTOR, SPLIT_POINT_COLOR);
    }
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
    this.lastKnownMouseLocation = mouseDown;

    if (this.canvasMode === CanvasMode.SelectPoints) {
      const selectedCommandIndex =
        performPointHitTest(
          this.vectorLayer, this.activePathId, mouseDown, this.pathPointRadius);
      if (selectedCommandIndex) {
        // A mouse down event ocurred on top of a point. Create a point selector
        // and track that sh!at.
        const selectedCmd =
          (this.vectorLayer.findLayer(this.activePathId) as PathLayer)
            .pathData
            .getSubPaths()[selectedCommandIndex.subIdx]
            .getCommands()[selectedCommandIndex.cmdIdx];
        this.pointSelector =
          new PointSelector(mouseDown, selectedCommandIndex, selectedCmd.isSplit());
      } else if (!event.shiftKey && !event.metaKey) {
        // If the mouse down event didn't occur on top of a point, then
        // clear any existing selections, but only if the user isn't in
        // the middle of selecting multiple points at once.
        this.selectionStateService.reset();
      }
    } else if (this.canvasMode === CanvasMode.AddPoints) {
      const projectionOntoPath =
        calculateProjectionOntoPath(
          this.vectorLayer, this.activePathId, this.lastKnownMouseLocation);

      // Create a new point if the mouse down event occurred
      // close to the path's outer boundaries.
      const projection = projectionOntoPath.projection;
      this.shouldCreatePointOnMouseUp = projection.d < MIN_SNAP_THRESHOLD;

      // TODO: avoid redrawing on every frame... often times it will be unnecessary
      this.draw();
    } else if (this.canvasMode === CanvasMode.PairSubPaths) {
      const selectedSubIdx =
        performSubPathHitTest(this.vectorLayer, this.activePathId, mouseDown);
      if (selectedSubIdx !== undefined) {
        const selections = this.selectionStateService.getSelections();
        const oppositeCanvasType =
          this.canvasType === CanvasType.Start ? CanvasType.End : CanvasType.Start;
        this.selectionStateService.reset();
        if (selections.length && selections[0].source !== this.canvasType) {
          // TODO: this UX should be improved before release...
          // TODO: keep the subpaths selected until all have been paired?
          // Then a subpath is currently selected in the canvas, so pair
          // the two selected subpaths together.
          const activePath = this.activePath;
          const oppositeActivePath =
            this.layerStateService.getActivePathLayer(oppositeCanvasType).pathData;
          const currSelectedSubIdx = selectedSubIdx;
          const oppositeSelectedSubIdx = selections[0].commandId.subIdx;
          this.layerStateService.updateActivePath(
            this.canvasType,
            activePath.mutate().moveSubPath(currSelectedSubIdx, 0).build(),
            false);
          this.layerStateService.updateActivePath(
            oppositeCanvasType,
            oppositeActivePath.mutate().moveSubPath(oppositeSelectedSubIdx, 0).build(),
            false);
          this.layerStateService.notifyChange(CanvasType.Preview);
          this.layerStateService.notifyChange(CanvasType.Start);
          this.layerStateService.notifyChange(CanvasType.End);
        } else if (!selections.length || selections[0].source === oppositeCanvasType) {
          const subPath = this.activePath.getSubPaths()[selectedSubIdx];
          for (let cmdIdx = 0; cmdIdx < subPath.getCommands().length; cmdIdx++) {
            this.selectionStateService.toggle({
              commandId: {
                pathId: this.activePathId,
                subIdx: selectedSubIdx,
                cmdIdx
              },
              source: this.canvasType
            }, true);
          }
        }
      }
    }
  }

  onMouseMove(event: MouseEvent) {
    this.showRuler(event);

    if (this.canvasType === CanvasType.Preview || !this.activePathId) {
      return;
    }

    const mouseMove = this.mouseEventToPoint(event);
    this.lastKnownMouseLocation = mouseMove;

    if (this.canvasMode === CanvasMode.SelectPoints) {
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

      const hoverCommandIndex =
        performPointHitTest(
          this.vectorLayer, this.activePathId, mouseMove, this.pathPointRadius);
      if (hoverCommandIndex) {
        this.hoverStateService.setHover({
          type: HoverType.Command,
          source: this.canvasType,
          commandId: hoverCommandIndex,
        });
      } else {
        this.hoverStateService.reset();
      }
    } else if (this.canvasMode === CanvasMode.AddPoints) {
      // TODO: avoid redrawing on every frame... often times it will be unnecessary
      this.draw();
    }
  }

  onMouseUp(event: MouseEvent) {
    if (this.canvasType === CanvasType.Preview || !this.activePathId) {
      return;
    }

    const mouseUp = this.mouseEventToPoint(event);
    this.lastKnownMouseLocation = mouseUp;

    if (this.canvasMode === CanvasMode.SelectPoints) {
      if (this.pointSelector) {
        this.pointSelector.onMouseUp(mouseUp);

        const selectedCommandIndex = this.pointSelector.getSelectedCommandIndex();
        if (this.pointSelector.isDragging()) {
          if (this.pointSelector.isSelectedPointSplit()) {
            const activeLayer =
              this.vectorLayer.findLayer(this.activePathId) as PathLayer;

            // Delete the old drag point from the path.
            activeLayer.pathData =
              activeLayer.pathData.mutate()
                .unsplitCommand(selectedCommandIndex.subIdx, selectedCommandIndex.cmdIdx)
                .build();

            // Re-split the path at the projection point.
            const projOntoPath =
              calculateProjectionOntoPath(this.vectorLayer, this.activePathId, mouseUp);
            const pathData = activeLayer.pathData.mutate()
              .splitCommand(projOntoPath.subIdx, projOntoPath.cmdIdx, projOntoPath.projection.t)
              .build();
            activeLayer.pathData = pathData;

            // Notify the global layer state service about the change and draw.
            // Clear any existing selections and/or hovers as well.
            this.hoverStateService.reset();
            this.selectionStateService.reset();
            this.layerStateService.updateActivePath(this.canvasType, activeLayer.pathData);
          }
        } else {
          // If we haven't started dragging a point, then we should select
          // the point instead.
          this.selectionStateService.toggle({
            source: this.canvasType,
            commandId: selectedCommandIndex,
          }, event.shiftKey || event.metaKey);
        }

        // Draw and complete the gesture.
        this.draw();
        this.pointSelector = undefined;
      }
    } else if (this.canvasMode === CanvasMode.AddPoints) {
      if (this.shouldCreatePointOnMouseUp) {
        const projectionOntoPath =
          calculateProjectionOntoPath(
            this.vectorLayer, this.activePathId, this.lastKnownMouseLocation);
        const projection = projectionOntoPath.projection;
        if (projection.d < MIN_SNAP_THRESHOLD) {
          // We're in range, so split the path!
          const activePathLayer = this.layerStateService.getActivePathLayer(this.canvasType);
          const splitPath = activePathLayer.pathData.mutate()
            .splitCommand(projectionOntoPath.subIdx, projectionOntoPath.cmdIdx, projection.t)
            .build();
          this.layerStateService.updateActivePath(this.canvasType, splitPath);
        }
        this.shouldCreatePointOnMouseUp = false;
      }
      // TODO: avoid redrawing on every frame... often times it will be unnecessary
      this.draw();
    }
  }

  onMouseLeave(event: MouseEvent) {
    this.canvasRulers.forEach(r => r.hideMouse());

    if (this.canvasType === CanvasType.Preview || !this.activePathId) {
      return;
    }

    const mouseLeave = this.mouseEventToPoint(event);
    this.lastKnownMouseLocation = mouseLeave;

    if (this.canvasMode === CanvasMode.SelectPoints) {
      // TODO: how to handle the case where the mouse leaves and re-enters mid-gesture?
      if (this.pointSelector) {
        this.pointSelector.onMouseLeave(mouseLeave);
        this.draw();
      }
    } else if (this.canvasMode === CanvasMode.AddPoints) {
      // If the user clicks to create a point but the mouse leaves the
      // canvas before mouse up is registered, then just cancel the event.
      // This way we can avoid some otherwise confusing behavior.
      this.shouldCreatePointOnMouseUp = false;
      // TODO: avoid redrawing on every frame... often times it will be unnecessary
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

  const executeCommandsFn = (layer: PathLayer | ClipPathLayer, transforms: Matrix[]) => {
    executeCommands(layer.pathData.getCommands(), ctx, transforms);
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
      if (layer.fillType === 'evenOdd') {
        // Note that SVG doesn't use a capital 'O' like VectorDrawables do.
        ctx.fill('evenodd');
      } else {
        ctx.fill();
      }
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
  const getTransformsFn = (parents: Layer[], current: Layer): Matrix[] => {
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
 * If a point is not found, then a hit test for one of the path's subpaths
 * will be performed as well.
 */
function performPointHitTest(
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
  const isPointInRangeFn = (distance: number, isSplit: boolean) => {
    return distance <= (isSplit ? pointRadius * SPLIT_POINT_RADIUS_FACTOR : pointRadius);
  };
  const hitResult = pathLayer.pathData.hitTest(transformedMousePoint, {
    isPointInRangeFn,
    hitTestPointsOnly: true,
  });
  if (!hitResult.isHit) {
    return undefined;
  }
  return {
    pathId: pathLayer.id,
    subIdx: hitResult.subIdx,
    cmdIdx: hitResult.cmdIdx,
  };
}

function performSubPathHitTest(
  vectorLayer: VectorLayer,
  pathId: string,
  mousePoint: Point): number | undefined {

  const pathLayer = vectorLayer.findLayer(pathId) as PathLayer;
  if (!pathLayer) {
    return undefined;
  }
  const transforms = getTransformsForLayer(vectorLayer, pathId).reverse();
  const transformedMousePoint =
    MathUtil.transformPoint(
      mousePoint,
      MathUtil.flattenTransforms(transforms).invert());
  const isStrokeInRangeFn = pathLayer.fillColor || !pathLayer.strokeColor
    ? undefined
    : (distance: number) => {
      return distance <= pathLayer.strokeWidth / 2;
    };
  const hitResult =
    pathLayer.pathData.hitTest(transformedMousePoint, { isStrokeInRangeFn, });
  if (!hitResult.isHit) {
    return undefined;
  }
  return hitResult.subIdx;
}

function executeCommands(
  commands: ReadonlyArray<Command>,
  ctx: CanvasRenderingContext2D,
  transforms: Matrix[],
  isDrawingSelection = false) {

  ctx.save();
  transforms.forEach(m => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f));
  ctx.beginPath();
  commands.forEach(cmd => {
    const start = cmd.getStart();
    const end = cmd.getEnd();

    if (isDrawingSelection && cmd.getSvgChar() !== 'M') {
      // TODO: optimize things by only doing move commands when needed?
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
      if (isDrawingSelection) {
        // Selections are broken up line segments, so we need to use
        // lines instead of closepath commands here.
        ctx.lineTo(end.x, end.y);
      } else {
        ctx.closePath();
      }
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
  const projInfo = pathLayer.pathData.project(transformedMousePoint);
  if (!projInfo) {
    return undefined;
  }
  return {
    subIdx: projInfo.subIdx,
    cmdIdx: projInfo.cmdIdx,
    projection: projInfo.projection,
  };
}

/**
 * Helper class that tracks information about a user's mouse gesture.
 */
class PointSelector {
  private isDragTriggered = false;
  private isMouseDown = true;

  constructor(
    private readonly mouseDown: Point,
    private readonly selectedCommandIndex: CommandIndex,
    private readonly selectedPointSplit: boolean,
  ) { }

  onMouseMove(mouseMove: Point) {
    const distance = MathUtil.distance(this.mouseDown, mouseMove);
    if (DRAG_TRIGGER_TOUCH_SLOP < distance) {
      this.isDragTriggered = true;
    }
  }

  onMouseUp(mouseUp: Point) {
    this.isMouseDown = false;
  }

  onMouseLeave(mouseLeave: Point) { }

  isDragging() {
    return this.isDragTriggered;
  }

  isMousePressedDown() {
    return this.isMouseDown;
  }

  getSelectedCommandIndex() {
    return this.selectedCommandIndex;
  }

  isSelectedPointSplit() {
    return this.selectedPointSplit;
  }
}
