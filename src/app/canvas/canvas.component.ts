import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, ViewChild,
  Input, ViewChildren, QueryList
} from '@angular/core';
import {
  PathCommand, SubPathCommand, Command, Id as CommandId, Projection
} from '../scripts/commands';
import {
  Layer, PathLayer, ClipPathLayer, GroupLayer, VectorLayer
} from '../scripts/layers';
import { EditorType } from '../EditorType';
import * as $ from 'jquery';
import { Point, Matrix, MathUtil, ColorUtil, SvgUtil } from '../scripts/common';
import { TimelineService } from '../timeline/timeline.service';
import { LayerStateService } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { SelectionStateService, Selection } from '../services/selectionstate.service';
import { HoverStateService, Type as HoverType, Hover } from '../services/hoverstate.service';
import { CanvasResizeService } from '../services/canvasresize.service';
import { CanvasRulerDirective } from './ruler.directive';


// TODO: make these viewport/density-independent
const MIN_SNAP_THRESHOLD = 1.5;
const DRAG_TRIGGER_TOUCH_SLOP = 1;

// Canvas margin in pixels.
const CANVAS_MARGIN = 36;

@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() editorType: EditorType;
  @ViewChild('renderingCanvas') private renderingCanvasRef: ElementRef;
  @ViewChildren(CanvasRulerDirective) canvasRulers: QueryList<CanvasRulerDirective>;

  private vectorLayer: VectorLayer;
  private componentSize = 0;
  private element: JQuery;
  private canvas: JQuery;
  private offscreenCanvas: JQuery;
  private cssScale: number;
  private attrScale: number;
  private isViewInit: boolean;
  private readonly subscriptions: Subscription[] = [];
  private pathPointRadius: number;
  private splitPathPointRadius: number;
  private currentHover: Hover;
  private pointSelector: PointSelector;

  constructor(
    private elementRef: ElementRef,
    private canvasResizeService: CanvasResizeService,
    private hoverStateService: HoverStateService,
    private layerStateService: LayerStateService,
    private timelineService: TimelineService,
    private selectionStateService: SelectionStateService) { }

  ngAfterViewInit() {
    this.isViewInit = true;
    this.element = $(this.elementRef.nativeElement);
    this.canvas = $(this.renderingCanvasRef.nativeElement);
    this.offscreenCanvas = $(document.createElement('canvas'));
    this.subscriptions.push(
      this.layerStateService.addListener(
        this.editorType, vl => {
          if (!vl) {
            return;
          }
          const oldVl = this.vectorLayer;
          const didWidthChange = !oldVl || oldVl.width !== vl.width;
          const didHeightChange = !oldVl || oldVl.height !== vl.height;
          this.vectorLayer = vl;
          if (didWidthChange || didHeightChange) {
            this.resizeAndDraw();
          } else {
            this.draw();
          }
        }));
    this.canvasResizeService.addListener(size => {
      const width = size.width - CANVAS_MARGIN * 2;
      const height = size.height - CANVAS_MARGIN * 2;
      const containerSize = Math.min(width, height);
      if (this.componentSize !== containerSize) {
        this.componentSize = containerSize;
        this.resizeAndDraw();
      }
    });
    if (this.editorType === EditorType.Preview) {
      // Preview canvas specific setup.
      this.subscriptions.push(
        this.timelineService.animationFractionStream.subscribe(fraction => {
          if (!this.vectorLayer) {
            return;
          }
          // TODO: if vector layer is undefined, then clear the canvas
          const startLayer = this.layerStateService.getLayer(EditorType.Start);
          const endLayer = this.layerStateService.getLayer(EditorType.End);
          this.vectorLayer.walk(layer => {
            if (!(layer instanceof PathLayer)) {
              return;
            }
            const start = startLayer.findLayerById(layer.id) as PathLayer;
            const end = endLayer.findLayerById(layer.id) as PathLayer;
            layer.pathData =
              layer.pathData.interpolate(start.pathData, end.pathData, fraction);
          });
          this.draw();
        }));
    } else {
      // Non-preview canvas specific setup.
      this.subscriptions.push(
        this.selectionStateService.stream.subscribe(() => this.draw()));
      this.subscriptions.push(
        this.timelineService.shouldLabelPointsStream.subscribe(() => this.draw()));
      const setCurrentHoverFn = hover => {
        this.currentHover = hover;
        this.draw();
      };
      this.subscriptions.push(
        this.hoverStateService.stream.subscribe(hover => {
          if (!hover) {
            // Clear the current hover.
            setCurrentHoverFn(undefined);
            return;
          }
          if (hover.source !== this.editorType
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

  private resizeAndDraw() {
    if (!this.isViewInit) {
      return;
    }
    const containerWidth = Math.max(1, this.componentSize);
    const containerHeight = Math.max(1, this.componentSize);
    const containerAspectRatio = containerWidth / containerHeight;
    const vlWidth = !this.vectorLayer ? 1 : this.vectorLayer.width || 1;
    const vlHeight = !this.vectorLayer ? 1 : this.vectorLayer.height || 1;
    const vectorAspectRatio = vlWidth / vlHeight;

    // The 'cssScale' represents the number of CSS pixels per SVG viewport pixel.
    if (vectorAspectRatio > containerAspectRatio) {
      this.cssScale = containerWidth / vlWidth;
    } else {
      this.cssScale = containerHeight / vlHeight;
    }

    // The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
    this.attrScale = this.cssScale * devicePixelRatio;

    const cssWidth = vlWidth * this.cssScale;
    const cssHeight = vlHeight * this.cssScale;
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

    // TODO: this still doesn't work very well for small/large viewports and/or on resizing
    this.pathPointRadius = 10 / this.cssScale;
    this.splitPathPointRadius = this.pathPointRadius * 0.8;
    this.draw();
    this.canvasRulers.forEach(r => r.draw());
  }

  private draw() {
    if (!this.isViewInit || !this.vectorLayer) {
      return;
    }
    const ctx =
      (this.canvas.get(0) as HTMLCanvasElement).getContext('2d');
    const offscreenCtx =
      (this.offscreenCanvas.get(0) as HTMLCanvasElement).getContext('2d');

    ctx.save();
    ctx.scale(this.attrScale, this.attrScale);
    ctx.clearRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);

    // TODO: use this offscreen context in the future somehow...
    const currentAlpha = 1;
    if (currentAlpha < 1) {
      offscreenCtx.save();
      offscreenCtx.scale(this.attrScale, this.attrScale);
      offscreenCtx.clearRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);
    }

    const drawingCtx = currentAlpha < 1 ? offscreenCtx : ctx;
    this.drawVectorLayer(drawingCtx);
    this.drawSelections(drawingCtx);
    this.drawLabeledPoints(drawingCtx);
    this.drawDraggingPoints(drawingCtx);

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
      if (!(layer instanceof PathLayer)) {
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
        .filter(sel => sel.source === this.editorType);
    if (!selections.length) {
      return;
    }
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer)) {
        return;
      }

      const pathSelections =
        selections.filter(sel => sel.commandId.pathId === layer.id);
      const selectedCmds = pathSelections.map(selection => {
        const subPathCommands = layer.pathData.subPathCommands;
        return subPathCommands[selection.commandId.subIdx]
          .commands[selection.commandId.cmdIdx];
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
    if (!this.timelineService.getShouldLabelPoints()
      || this.editorType === EditorType.Preview) {
      return;
    }

    const currentHover = this.currentHover;
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer)) {
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
          && this.pointSelector.isSelectedPointSplit
          ? this.pointSelector.selectedPointId
          : undefined;
      const pathDataPointInfos =
        _.chain(pathCommand.subPathCommands)
          .map((subCmd: SubPathCommand, subIdx: number) => {
            return subCmd.commands.map((cmd, cmdIdx) => {
              const commandId = { pathId, subIdx, cmdIdx } as CommandId;
              const isSplit = cmd.isSplit;
              const isMove = cmd.svgChar === 'M';
              const isHover =
                currentHover && _.isMatch(currentHover.commandId, commandId);
              const isDrag =
                activelyDraggedPointId && _.isMatch(activelyDraggedPointId, commandId);
              const point = MathUtil.transformPoint(_.last(cmd.points), ...transforms);
              return { commandId, isSplit, isMove, isHover, isDrag, point };
            });
          })
          .flatMap(pointInfos => pointInfos)
          .map((pointInfo, i) => _.assign({}, pointInfo, { position: i + 1 }))
          // Skip the currently dragged point, if it exists.
          // We'll draw that separately next.
          .filter(pointInfo => !pointInfo.isDrag)
          .value();

      const hoverPoints = [];
      const splitPoints = [];
      const movePoints = [];
      const normalPoints = [];

      for (const pointInfo of pathDataPointInfos) {
        let pointList;
        if (pointInfo.isHover) {
          pointList = hoverPoints;
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
        [].concat(normalPoints, movePoints, splitPoints, hoverPoints);

      for (const pointInfo of drawnPoints) {
        let color, radius;
        if (pointInfo.isMove) {
          color = ColorUtil.MOVE_POINT_COLOR;
          radius = this.pathPointRadius;
        } else if (pointInfo.isSplit) {
          color = ColorUtil.SPLIT_POINT_COLOR;
          radius = this.splitPathPointRadius;
        } else {
          color = ColorUtil.NORMAL_POINT_COLOR;
          radius = this.pathPointRadius;
        }
        if (pointInfo.isHover) {
          // TODO: update this number to something more reasonable?
          radius = this.pathPointRadius * 1.25;
        }
        this.drawLabeledPoint(
          ctx, pointInfo.point, radius, color, pointInfo.position);
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
    const projectionOntoPath =
      this.calculateProjectionOntoPath(
        this.pointSelector.getLastKnownLocation(), activelyDraggedPointId.pathId);
    this.vectorLayer.walk((layer, transforms) => {
      if (layer.id !== activelyDraggedPointId.pathId) {
        return;
      }
      const projection = projectionOntoPath.projection;
      let point;
      if (projection.d < MIN_SNAP_THRESHOLD) {
        point = new Point(projection.x, projection.y);
      } else {
        point = this.pointSelector.getLastKnownLocation();
      }
      point = MathUtil.transformPoint(point, ...transforms.reverse());
      this.drawLabeledPoint(
        ctx, point, this.splitPathPointRadius, ColorUtil.SPLIT_POINT_COLOR);
    });
  }

  // Draw a single labeled point with optional text.
  private drawLabeledPoint(
    ctx: CanvasRenderingContext2D,
    point: Point,
    radius: number,
    color: string,
    text?: string) {

    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();

    if (text) {
      ctx.beginPath();
      ctx.fillStyle = 'white';
      ctx.font = radius + 'px Roboto';
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
      for (let x = 1; x < this.vectorLayer.width; x++) {
        ctx.fillRect(
          x * this.attrScale - 0.5 * devicePixelRatio,
          0,
          devicePixelRatio,
          this.vectorLayer.height * this.attrScale);
      }
      for (let y = 1; y < this.vectorLayer.height; y++) {
        ctx.fillRect(
          0,
          y * this.attrScale - 0.5 * devicePixelRatio,
          this.vectorLayer.width * this.attrScale,
          devicePixelRatio);
      }
    }
    ctx.restore();
  }

  onMouseDown(event: MouseEvent) {
    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
    const mouseDown = this.mouseEventToPoint(event);
    const selectedPointId = this.findPathPointId(mouseDown);
    if (selectedPointId) {
      // A mouse down event ocurred on top of a point. Create a point selector
      // and track that sh!at.
      const selectedCmd =
        (this.vectorLayer.findLayerById(selectedPointId.pathId) as PathLayer)
          .pathData
          .subPathCommands[selectedPointId.subIdx]
          .commands[selectedPointId.cmdIdx];
      this.pointSelector =
        new PointSelector(mouseDown, selectedPointId, selectedCmd.isSplit);
    } else {
      // If the mouse down event didn't occur on top of a point, then
      // clear any existing selections.
      this.selectionStateService.clear();
    }
  }

  onMouseMove(event: MouseEvent) {
    const mouseMove = this.mouseEventToPoint(event);
    const roundedMouseMove = new Point(_.round(mouseMove.x), _.round(mouseMove.y));
    this.canvasRulers.forEach(r => r.showMouse(roundedMouseMove));

    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
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
        source: this.editorType,
        commandId: hoverPointId,
      });
    } else {
      this.hoverStateService.clearHover();
    }
  }

  onMouseUp(event: MouseEvent) {
    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
    if (this.pointSelector) {
      const mouseUp = this.mouseEventToPoint(event);
      this.pointSelector.onMouseUp(mouseUp);

      const selectedPointId = this.pointSelector.selectedPointId;
      if (this.pointSelector.isDragging()) {
        if (this.pointSelector.isSelectedPointSplit) {
          const activeLayer =
            this.vectorLayer.findLayerById(selectedPointId.pathId) as PathLayer;

          // Delete the old drag point from the path.
          activeLayer.pathData =
            activeLayer.pathData.unsplit(
              selectedPointId.subIdx, selectedPointId.cmdIdx);

          // Re-split the path at the projection point.
          activeLayer.pathData =
            this.calculateProjectionOntoPath(
              mouseUp, selectedPointId.pathId).split();

          // Notify the global layer state service about the change and draw.
          this.layerStateService.setLayer(this.editorType, this.vectorLayer);
        }
      } else {
        // If we haven't started dragging a point, then we should select
        // the point instead.
        this.selectionStateService.toggle({
          source: this.editorType,
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

    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
    if (this.pointSelector) {
      this.pointSelector.onMouseLeave(this.mouseEventToPoint(event));
      this.draw();
    }
  }

  /**
   * Finds the path point closest to the specified mouse point, with a max
   * distance specified by radius. By default, non-split path points are ignored.
   */
  private findPathPointId(mousePoint: Point): CommandId | undefined {
    const minPathPoints = [];
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer)) {
        return;
      }
      const pathId = layer.id;
      const transformedMousePoint =
        MathUtil.transformPoint(mousePoint, ...transforms.reverse());
      const minPathPoint =
        _.chain(layer.pathData.subPathCommands)
          .map((subCmd: SubPathCommand, subIdx: number) => {
            return subCmd.commands
              .map((cmd, cmdIdx) => {
                const distance = MathUtil.distance(cmd.end, transformedMousePoint);
                const isSplit = cmd.isSplit;
                return { pathId, subIdx, cmdIdx, distance, isSplit };
              });
          })
          .flatMap(pathPoints => pathPoints)
          // TODO: confirm that using the attrScale here is correct...?
          .filter(pathPoint => {
            const radius =
              pathPoint.isSplit ? this.splitPathPointRadius : this.pathPointRadius;
            return pathPoint.distance <= radius;
          })
          // Reverse so that points drawn with higher z-orders are preferred.
          .reverse()
          .reduce((prev, curr) => {
            return prev && prev.distance < curr.distance ? prev : curr;
          }, undefined)
          .value();
      if (minPathPoint) {
        minPathPoints.push(minPathPoint);
      }
    });
    // TODO: should we reverse here similar to above as well?
    return minPathPoints.reduce((prev, curr) => {
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
      const transformedPoint =
        MathUtil.transformPoint(mousePoint, ...transforms.reverse());
      const projectionInfo = layer.pathData.project(transformedPoint);
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
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.cssScale;
    const y = (event.pageY - canvasOffset.top) / this.cssScale;
    return new Point(x, y);
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
    _.flatMap(layer.pathData.subPathCommands, s => s.commands as Command[]);
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
    } else if (cmd.svgChar === 'A') {
      executeArcCommand(ctx, cmd.args);
    }
  });
  ctx.restore();
}

/**
 * Draws an elliptical arc on the specified canvas context.
 */
function executeArcCommand(
  ctx: CanvasRenderingContext2D,
  arcArgs: ReadonlyArray<number>) {

  const [currentPointX, currentPointY,
    rx, ry, xAxisRotation,
    largeArcFlag, sweepFlag,
    tempPoint1X, tempPoint1Y] = arcArgs;

  if (currentPointX === tempPoint1X && currentPointY === tempPoint1Y) {
    // Degenerate to point.
    return;
  }

  if (rx === 0 || ry === 0) {
    // Degenerate to line.
    ctx.lineTo(tempPoint1X, tempPoint1Y);
    return;
  }

  // Approximate the arc as one or more bezier curves.
  const bezierCoords = SvgUtil.arcToBeziers({
    startX: currentPointX,
    startY: currentPointY,
    rx, ry, xAxisRotation,
    largeArcFlag, sweepFlag,
    endX: tempPoint1X,
    endY: tempPoint1Y,
  });

  for (let i = 0; i < bezierCoords.length; i += 8) {
    ctx.bezierCurveTo(
      bezierCoords[i + 2], bezierCoords[i + 3],
      bezierCoords[i + 4], bezierCoords[i + 5],
      bezierCoords[i + 6], bezierCoords[i + 7]);
  }
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
    public readonly selectedPointId: CommandId,
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
