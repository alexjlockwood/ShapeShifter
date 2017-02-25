import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  Input, ViewChildren, QueryList
} from '@angular/core';
import {
  PathCommand, SubPathCommand, Command, Index as CommandIndex, Projection
} from '../scripts/commands';
import { PathLayer, ClipPathLayer, VectorLayer } from '../scripts/layers';
import { CanvasType } from '../CanvasType';
import * as $ from 'jquery';
import { Point, Matrix, MathUtil, ColorUtil } from '../scripts/common';
import { AnimatorService } from '../services/animator.service';
import { LayerStateService, MorphabilityStatus } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { SelectionStateService } from '../services/selectionstate.service';
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

// Canvas margin in pixels.
export const CANVAS_MARGIN = 36;
export const DEFAULT_VIEWPORT_SIZE = 24;

const MOVE_POINT_COLOR = '#2962FF'; // Blue A400
const NORMAL_POINT_COLOR = '#2962FF'; // Blue A400
const SPLIT_POINT_COLOR = '#E65100'; // Orange 900

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() canvasType: CanvasType;
  @ViewChild('renderingCanvas') private renderingCanvasRef: ElementRef;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;

  private vectorLayer: VectorLayer;
  // TODO: make use of this variable (i.e. only show labeled points for active path, etc.)
  private activePathId: string;
  private componentWidth = 1;
  private componentHeight = 1;
  private element: JQuery;
  private canvas: JQuery;
  private offscreenCanvas: JQuery;
  private cssScale: number;
  private attrScale: number;
  private isViewInit: boolean;
  private pathPointRadius: number;
  private splitPathPointRadius: number;
  private currentHover: Hover;
  private pointSelector: PointSelector;
  private shouldLabelPoints = false;
  private shouldDrawLayer = false;
  private shouldDisableLayer = false;
  private readonly subscriptions: Subscription[] = [];

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
      this.layerStateService.getVectorLayerObservable(this.canvasType).subscribe(vl => {
        const oldWidth = this.viewportWidth;
        const oldHeight = this.viewportHeight;
        this.vectorLayer = vl;
        this.shouldDrawLayer = !!this.vectorLayer && !!this.activePathId;
        const newWidth = this.viewportWidth;
        const newHeight = this.viewportHeight;
        const didSizeChange = oldWidth !== newWidth || oldHeight !== newHeight;
        if (didSizeChange) {
          this.resizeAndDraw();
        } else {
          this.draw();
        }
      }));
    this.canvasResizeService.getCanvasResizeObservable().subscribe(size => {
      const oldWidth = this.componentWidth;
      const oldHeight = this.componentHeight;
      this.componentWidth = Math.max(1, size.width - CANVAS_MARGIN * 2);
      this.componentHeight = Math.max(1, size.height - CANVAS_MARGIN * 2);
      if (this.componentWidth !== oldWidth || this.componentHeight !== oldHeight) {
        this.resizeAndDraw();
      }
    });
    if (this.canvasType === CanvasType.Preview) {
      // Preview canvas specific setup.
      const interpolatePreview = (fraction: number) => {
        const startPathLayer = this.layerStateService.getActivePathLayer(CanvasType.Start);
        const previewPathLayer = this.layerStateService.getActivePathLayer(CanvasType.Preview);
        const endPathLayer = this.layerStateService.getActivePathLayer(CanvasType.End);
        if (startPathLayer && previewPathLayer && endPathLayer) {
          // Note that there is no need to broadcast layer state changes
          // for the preview canvas.
          previewPathLayer.interpolate(startPathLayer, endPathLayer, fraction);
        }
        const startGroupLayer = this.layerStateService.getActiveRotationLayer(CanvasType.Start);
        const previewGroupLayer = this.layerStateService.getActiveRotationLayer(CanvasType.Preview);
        const endGroupLayer = this.layerStateService.getActiveRotationLayer(CanvasType.End);
        if (startGroupLayer && previewGroupLayer && endGroupLayer) {
          previewGroupLayer.interpolate(startGroupLayer, endGroupLayer, fraction);
        }
      };
      let currentAnimatedFraction = 0;
      this.subscriptions.push(
        this.layerStateService.getActivePathIdObservable(this.canvasType).subscribe(activePathId => {
          this.activePathId = activePathId;
          this.shouldDrawLayer = !!this.vectorLayer && !!this.activePathId;
          interpolatePreview(currentAnimatedFraction);
          this.draw();
        }));
      this.subscriptions.push(
        this.animatorService.getAnimatedValueObservable().subscribe(fraction => {
          currentAnimatedFraction = fraction;
          interpolatePreview(fraction);
          this.draw();
        }));
      this.subscriptions.push(
        this.settingsService.getSettingsObservable().subscribe(settings => {
          if (this.shouldLabelPoints !== settings.shouldLabelPoints) {
            this.shouldLabelPoints = settings.shouldLabelPoints;
            this.draw();
          }
        }));
      this.subscriptions.push(
        this.layerStateService.getMorphabilityStatusObservable().subscribe(status => {
          this.shouldDisableLayer = status !== MorphabilityStatus.Morphable;
          this.draw();
        }));
    } else {
      // Non-preview canvas specific setup.
      this.subscriptions.push(
        this.layerStateService.getActivePathIdObservable(this.canvasType).subscribe(activePathId => {
          this.activePathId = activePathId;
          this.shouldDrawLayer = !!this.vectorLayer && !!this.activePathId;
          this.draw();
        }));
      this.subscriptions.push(
        this.selectionStateService.getSelectionsObservable().subscribe(() => this.draw()));
      const setCurrentHoverFn = hover => {
        this.currentHover = hover;
        this.draw();
      };
      this.subscriptions.push(
        this.hoverStateService.getHoverObservable().subscribe(hover => {
          if (!hover) {
            // Clear the current hover.
            setCurrentHoverFn(undefined);
            return;
          }
          if (!(hover.type === HoverType.Command
            || hover.type === HoverType.Split
            || hover.type === HoverType.Unsplit)) {
            // TODO: support reverse/shift back/shift forward? it would be pretty easy...
            setCurrentHoverFn(undefined);
            return;
          }
          if (hover.source !== this.canvasType
            && (hover.type === HoverType.Split || hover.type === HoverType.Unsplit)) {
            // If the hover source isn't of this type and the hover type is a split
            // or an unsplit, then don't draw any hover events to the canvas.
            setCurrentHoverFn(undefined);
            return;
          }
          setCurrentHoverFn(hover);
        }));
    }
    this.resizeAndDraw();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  get viewportWidth() {
    return this.vectorLayer ? this.vectorLayer.width : DEFAULT_VIEWPORT_SIZE;
  }

  get viewportHeight() {
    return this.vectorLayer ? this.vectorLayer.height : DEFAULT_VIEWPORT_SIZE;
  }

  private resizeAndDraw() {
    if (!this.isViewInit) {
      return;
    }
    const vectorAspectRatio = this.viewportWidth / this.viewportHeight;
    const containerAspectRatio = this.componentWidth / this.componentHeight;

    // The 'cssScale' represents the number of CSS pixels per SVG viewport pixel.
    if (vectorAspectRatio > containerAspectRatio) {
      this.cssScale = this.componentWidth / this.viewportWidth;
    } else {
      this.cssScale = this.componentHeight / this.viewportHeight;
    }

    // The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
    this.attrScale = this.cssScale * devicePixelRatio;

    const cssWidth = this.viewportWidth * this.cssScale;
    const cssHeight = this.viewportHeight * this.cssScale;
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
    const size = Math.min(this.componentWidth, this.componentHeight);
    this.pathPointRadius = size * SIZE_TO_POINT_RADIUS_FACTOR / Math.max(2, this.cssScale);
    this.splitPathPointRadius = this.pathPointRadius * SPLIT_POINT_RADIUS_FACTOR;
    this.draw();
    this.canvasRulers.forEach(r => r.draw());
  }

  private draw() {
    if (!this.isViewInit) {
      return;
    }
    const ctx = (this.canvas.get(0) as HTMLCanvasElement).getContext('2d');
    const offscreenCtx = (this.offscreenCanvas.get(0) as HTMLCanvasElement).getContext('2d');

    ctx.save();
    ctx.scale(this.attrScale, this.attrScale);
    ctx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

    const currentAlpha = this.shouldDisableLayer ? DISABLED_LAYER_ALPHA : 1;
    if (currentAlpha < 1) {
      offscreenCtx.save();
      offscreenCtx.scale(this.attrScale, this.attrScale);
      offscreenCtx.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
    }

    const drawingCtx = currentAlpha < 1 ? offscreenCtx : ctx;
    if (this.shouldDrawLayer) {
      this.drawVectorLayer(drawingCtx);
      this.drawSelections(drawingCtx);
      this.drawLabeledPoints(drawingCtx);
      this.drawDraggingPoints(drawingCtx);
    }

    if (currentAlpha < 1) {
      ctx.save();
      ctx.globalAlpha = currentAlpha;
      ctx.scale(1 / this.attrScale, 1 / this.attrScale);
      ctx.drawImage(offscreenCtx.canvas, 0, 0);
      ctx.restore();
      offscreenCtx.restore();
    }
    ctx.restore();

    this.drawPixelGrid(ctx);
  }

  // Draw the layers to the canvas.
  private drawVectorLayer(ctx: CanvasRenderingContext2D) {
    this.vectorLayer.walk((layer, transforms) => {
      if (layer instanceof ClipPathLayer) {
        executePathData(layer, ctx, transforms);
        ctx.clip();
        return;
      }
      if (!(layer instanceof PathLayer) || (layer.id !== this.activePathId)) {
        return;
      }

      // TODO: update layer.pathData.length so that it reflects scale transforms
      ctx.save();
      executePathData(layer, ctx, transforms);

      // TODO: confirm this stroke multiplier thing works...
      const strokeWidthMultiplier = MathUtil.flattenTransforms(transforms).getScale();
      ctx.strokeStyle = ColorUtil.androidToCssColor(layer.strokeColor, layer.strokeAlpha);
      ctx.lineWidth = layer.strokeWidth * strokeWidthMultiplier;
      ctx.fillStyle = ColorUtil.androidToCssColor(layer.fillColor, layer.fillAlpha);
      ctx.lineCap = layer.strokeLinecap;
      ctx.lineJoin = layer.strokeLinejoin;
      ctx.miterLimit = layer.strokeMiterLimit || 4;

      // Note that trim paths aren't currently being used... but maybe someday
      // it will be useful (i.e. if we want to support importing AVDs from Roman's
      // AndroidIconAnimator tool).
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
          shownFraction * layer.pathData.pathLength,
          (1 - shownFraction + 0.001) * layer.pathData.pathLength
        ]);
        // The amount to offset the path is equal to the trimPathStart plus
        // trimPathOffset. We mod the result because the trimmed path
        // should wrap around once it reaches 1.
        ctx.lineDashOffset = layer.pathData.pathLength
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

  // Draw any selected commands.
  private drawSelections(ctx: CanvasRenderingContext2D) {
    const selections =
      this.selectionStateService.getSelections()
        .filter(sel => sel.source === this.canvasType);
    if (!selections.length) {
      return;
    }
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer) || (layer.id !== this.activePathId)) {
        return;
      }

      const pathSelections =
        selections.filter(sel => sel.commandId.pathId === layer.id);
      const selectedCmds = pathSelections.map(selection => {
        const subPathCommands = layer.pathData.getSubPaths();
        return subPathCommands[selection.commandId.subIdx]
          .getCommands()[selection.commandId.cmdIdx];
      });

      if (!selectedCmds.length) {
        return;
      }

      executeCommands(selectedCmds, ctx, transforms, true);

      ctx.save();
      ctx.lineWidth = 6 / this.cssScale;
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#2196f3';
      ctx.lineWidth = 3 / this.cssScale;
      ctx.stroke();
      ctx.restore();
    });
  }

  // Draw any labeled points.
  private drawLabeledPoints(ctx: CanvasRenderingContext2D) {
    if (this.canvasType === CanvasType.Preview && !this.shouldLabelPoints) {
      return;
    }

    const currentHover = this.currentHover;
    const currentSelections =
      this.selectionStateService.getSelections()
        .filter(s => s.source === this.canvasType);
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer) || (layer.id !== this.activePathId)) {
        return;
      }
      transforms.reverse();

      const pathId = layer.id;
      let pathCommand = layer.pathData;
      if (currentHover
        && currentHover.type === HoverType.Split
        && currentHover.commandId.pathId === pathId) {
        // If the user is hovering over the inspector split button, then build
        // a snapshot of what the path would look like after the action
        // and display the result. Note that after the split action,
        // the hover's cmdIdx can be used to identify the new split point.
        pathCommand =
          layer.pathData.splitInHalf(
            currentHover.commandId.subIdx,
            currentHover.commandId.cmdIdx);
      }

      // Build a list containing all necessary information needed in
      // order to draw the labeled points.
      const activelyDraggedPointId =
        this.pointSelector
          && this.pointSelector.isDragging()
          && this.pointSelector.isActive()
          && this.pointSelector.isSelectedPointSplit
          ? this.pointSelector.selectedPointId
          : undefined;
      const pathDataPointInfos =
        _.chain(pathCommand.getSubPaths())
          .map((subCmd: SubPathCommand, subIdx: number) => {
            return subCmd.getCommands().map((cmd, cmdIdx) => {
              const commandId = { pathId, subIdx, cmdIdx } as CommandIndex;
              const isSplit = cmd.isSplit;
              const isMove = cmd.svgChar === 'M';
              const isHoverOrSelection =
                (currentHover
                  && currentHover.commandId.subIdx === subIdx
                  && currentHover.commandId.cmdIdx === cmdIdx)
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
          radius = this.splitPathPointRadius;
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
    });
  }

  // Draw any actively dragged points along the path.
  private drawDraggingPoints(ctx: CanvasRenderingContext2D) {
    if (!this.pointSelector
      || !this.pointSelector.isActive()
      || !this.pointSelector.isDragging()
      || !this.pointSelector.isSelectedPointSplit) {
      return;
    }
    const activelyDraggedPointId = this.pointSelector.selectedPointId;
    const lastKnownLocation = this.pointSelector.getLastKnownLocation();
    const projectionOntoPath =
      this.calculateProjectionOntoPath(lastKnownLocation, activelyDraggedPointId.pathId);
    const projection = projectionOntoPath.projection;
    let point;
    if (projection.d < MIN_SNAP_THRESHOLD) {
      point = new Point(projection.x, projection.y);
      point = MathUtil.transformPoint(
        point, MathUtil.flattenTransforms(this.getTransformsForActiveLayer().reverse()));
    } else {
      point = lastKnownLocation;
    }
    this.drawLabeledPoint(
      ctx, point, this.splitPathPointRadius, SPLIT_POINT_COLOR);
  }

  /**
   * Draw a single labeled point with optional text.
   * TODO: move this into a utility module and share with inspector UI
   */
  private drawLabeledPoint(
    ctx: CanvasRenderingContext2D,
    point: Point,
    radius: number,
    color: string,
    text?: string) {

    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * POINT_BORDER_FACTOR, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#000';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();

    if (text) {
      ctx.beginPath();
      ctx.fillStyle = 'white';
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
    if (this.cssScale > 4) {
      const devicePixelRatio = window.devicePixelRatio || 1;
      ctx.fillStyle = 'rgba(128, 128, 128, .25)';
      for (let x = 1; x < this.viewportWidth; x++) {
        ctx.fillRect(
          x * this.attrScale - 0.5 * devicePixelRatio,
          0,
          devicePixelRatio,
          this.viewportHeight * this.attrScale);
      }
      for (let y = 1; y < this.viewportHeight; y++) {
        ctx.fillRect(
          0,
          y * this.attrScale - 0.5 * devicePixelRatio,
          this.viewportWidth * this.attrScale,
          devicePixelRatio);
      }
    }
    ctx.restore();
  }

  onMouseDown(event: MouseEvent) {
    if (this.canvasType === CanvasType.Preview
      || !this.layerStateService.getActivePathId(this.canvasType)) {
      return;
    }
    const mouseDown = this.mouseEventToPoint(event);
    const selectedPointId = this.findPathPointId(mouseDown);
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
    const mouseMove = this.mouseEventToPoint(event);
    const roundedMouseMove = new Point(_.round(mouseMove.x), _.round(mouseMove.y));
    this.canvasRulers.forEach(r => r.showMouse(roundedMouseMove));

    if (this.canvasType === CanvasType.Preview || !this.activePathId) {
      return;
    }

    let isDraggingSplitPoint = false;
    if (this.pointSelector) {
      this.pointSelector.onMouseMove(mouseMove);
      isDraggingSplitPoint =
        this.pointSelector.isSelectedPointSplit && this.pointSelector.isDragging();
      if (isDraggingSplitPoint) {
        this.draw();
      }
    }

    if (isDraggingSplitPoint) {
      // Don't draw hover events if we are dragging.
      return;
    }

    const hoverPointId = this.findPathPointId(mouseMove);
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

      const selectedPointId = this.pointSelector.selectedPointId;
      if (this.pointSelector.isDragging()) {
        if (this.pointSelector.isSelectedPointSplit) {
          if (selectedPointId.pathId !== this.activePathId) {
            throw new Error('Attempt to modify the non-active path');
          }

          // TODO: use layerStateService to get the active path id instead
          const activeLayer =
            this.vectorLayer.findLayer(selectedPointId.pathId) as PathLayer;

          // Delete the old drag point from the path.
          activeLayer.pathData =
            activeLayer.pathData.unsplit(
              selectedPointId.subIdx, selectedPointId.cmdIdx);

          // Re-split the path at the projection point.
          activeLayer.pathData =
            this.calculateProjectionOntoPath(
              mousePoint, selectedPointId.pathId).split();

          // Notify the global layer state service about the change and draw.
          // Clear any existing selections and/or hovers as well.
          this.hoverStateService.reset();
          this.selectionStateService.reset();
          this.layerStateService.updateActivePathCommand(
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

  /**
   * Finds the path point closest to the specified mouse point, with a max
   * distance specified by radius. Draggable points are returned with higher
   * priority than non-draggable points.
   */
  private findPathPointId(mousePoint: Point): CommandIndex | undefined {
    const minPathPoints = [];
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer) || (layer.id !== this.activePathId)) {
        return;
      }
      transforms.reverse();
      const pathId = layer.id;
      const transformedMousePoint =
        MathUtil.transformPoint(
          mousePoint,
          MathUtil.flattenTransforms(transforms).invert());
      const minPathPoint =
        _.chain(layer.pathData.getSubPaths())
          .map((subCmd: SubPathCommand, subIdx: number) => {
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
              pathPoint.isSplit
                ? this.splitPathPointRadius
                : this.pathPointRadius;
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
      if (minPathPoint) {
        minPathPoints.push(minPathPoint);
      }
    });
    // Reverse so that sub paths drawn with higher z-orders are preferred.
    return minPathPoints.reverse().reduce((prev, curr) => {
      return prev && prev.distance < curr.distance ? prev : curr;
    }, undefined);
  }

  /**
   * Calculates the projection onto the path with the specified path ID.
   * The resulting projection is our way of determining the on-curve point
   * closest to the specified off-curve mouse point.
   */
  private calculateProjectionOntoPath(
    mousePoint: Point,
    pathId: string): ProjectionOntoPath | undefined {

    let projectionOntoPath: ProjectionOntoPath;
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer) || pathId !== layer.id) {
        return;
      }
      transforms.reverse();
      const transformedMousePoint =
        MathUtil.transformPoint(
          mousePoint,
          MathUtil.flattenTransforms(transforms).invert());
      const projectionInfo = layer.pathData.project(transformedMousePoint);
      if (!projectionInfo) {
        return;
      }
      projectionOntoPath = {
        pathId: layer.id,
        projection: projectionInfo.projection,
        split: projectionInfo.split,
      };
    });
    return projectionOntoPath;
  }

  /**
   * Returns a point in the canvas' coordinate space.
   */
  private mouseEventToPoint(event: MouseEvent) {
    // TODO: cssScale < 1 causes weird ruler alignment issues
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.cssScale;
    const y = (event.pageY - canvasOffset.top) / this.cssScale;
    return new Point(x, y);
  }

  /**
   * Returns a list of parent transforms for the active layer. The transforms
   * are returned in top-down order (i.e. the transform for the active layer's
   * immediate parent will be the very last matrix in the returned list).
   */
  private getTransformsForActiveLayer() {
    let matrices: Matrix[] = [];
    this.vectorLayer.walk((layer, transforms) => {
      if (layer.id === this.activePathId) {
        matrices = transforms.slice();
      }
    });
    return matrices;
  }
}

/**
 * Draws an command on the specified canvas context.
 */
function executePathData(
  layer: PathLayer | ClipPathLayer,
  ctx: CanvasRenderingContext2D,
  transforms: Matrix[],
  isDrawingSelection?: boolean) {

  const commands =
    _.flatMap(
      layer.pathData.getSubPaths(),
      subCmd => subCmd.getCommands() as Command[]);
  executeCommands(commands, ctx, transforms, isDrawingSelection);
}

function executeCommands(
  commands: Command[],
  ctx: CanvasRenderingContext2D,
  transforms: Matrix[],
  isDrawingSelection?: boolean) {

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

/** Contains information about a projection onto a path. */
interface ProjectionOntoPath {
  pathId: string;
  projection: Projection;
  split: () => PathCommand;
}

/**
 * Helper class that tracks information about a user's mouse gesture.
 */
class PointSelector {
  private lastKnownLocation: Point;
  private isDragTriggered = false;
  private isGestureActive = true;

  constructor(
    public readonly mouseDown: Point,
    public readonly selectedPointId: CommandIndex,
    public readonly isSelectedPointSplit: boolean) {
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
}
