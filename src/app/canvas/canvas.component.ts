import * as _ from 'lodash';
import {
  Component, OnInit, OnDestroy, ElementRef, HostListener,
  ViewChild, ViewChildren, Input, Output, EventEmitter
} from '@angular/core';
import {
  Layer, PathLayer, ClipPathLayer, GroupLayer, CommandId,
  VectorLayer, PathCommand, EditorType, SubPathCommand, DrawCommand
} from '../scripts/model';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import { Point, Matrix, Projection, MathUtil, ColorUtil } from '../scripts/common';
import { TimelineService } from '../timeline/timeline.service';
import { LayerStateService } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { arcToBeziers } from '../scripts/svg';
import { SelectionService, Selection } from '../services/selection.service';
import { HoverStateService, HoverType, Hover } from '../services/hoverstate.service';

const ELEMENT_RESIZE_DETECTOR = erd();

// TODO: make this viewport/density-independent
const MIN_SNAP_THRESHOLD = 1.5;

// TODO: create a parent component that will resize this stuff properly (no flexbox?)
@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements OnInit, OnDestroy {
  @Input() editorType: EditorType;
  @ViewChild('renderingCanvas') private renderingCanvasRef: ElementRef;

  private vectorLayer: VectorLayer;
  private componentSize: number;
  private element: JQuery;
  private canvas: JQuery;
  private offscreenCanvas: JQuery;
  private cssScale: number;
  private attrScale: number;
  private isViewInit: boolean;
  private subscriptions: Subscription[] = [];
  private pathPointRadius: number;
  private splitPathPointRadius: number;
  private currentHover: Hover;
  private elementResizeCallback: () => void;

  // If present, the user is in the process of moving a point.
  private activeDragPointId: CommandId;
  // Represents the actively dragged point's closest projection onto a path.
  private activeProjectionOntoPath: ProjectionOntoPath;
  // Represents the mouse location of the actively dragged point.
  private activeDragPointLocation: Point;

  constructor(
    private elementRef: ElementRef,
    private hoverStateService: HoverStateService,
    private layerStateService: LayerStateService,
    private timelineService: TimelineService,
    private selectionService: SelectionService) { }

  ngOnInit() {
    this.isViewInit = true;
    this.element = $(this.elementRef.nativeElement);
    this.canvas = $(this.renderingCanvasRef.nativeElement);
    this.offscreenCanvas = $(document.createElement('canvas'));
    this.componentSize = Math.min(this.element.width(), this.element.parent().height());
    this.elementResizeCallback = () => {
      const containerSize = Math.min(this.element.width(), this.element.parent().height());
      if (this.componentSize !== containerSize) {
        this.componentSize = containerSize;
        this.resizeAndDraw();
      }
    };
    ELEMENT_RESIZE_DETECTOR.listenTo(this.element.parent().get(0), this.elementResizeCallback);
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
    if (this.editorType === EditorType.Preview) {
      this.subscriptions.push(
        this.timelineService.addAnimationFractionListener(fraction => {
          if (!this.vectorLayer) {
            return;
          }
          // TODO: if vector layer is undefined, then clear the canvas
          const startLayer = this.layerStateService.getData(EditorType.Start);
          const endLayer = this.layerStateService.getData(EditorType.End);
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
      this.subscriptions.push(
        this.selectionService.addListener(this.editorType, () => this.draw()));
      this.subscriptions.push(
        this.timelineService.addShouldLabelPointsListener(() => this.draw()));
      this.subscriptions.push(
        this.hoverStateService.stream
          .map(hover => {
            if (!_.includes(hover.visibleTo, this.editorType)) {
              return undefined;
            }
            return hover;
          })
          .subscribe(hover => {
            this.currentHover = hover;
            this.draw();
          }));
    }
    this.resizeAndDraw();
  }

  ngOnDestroy() {
    ELEMENT_RESIZE_DETECTOR.removeListener(this.element.parent().get(0), this.elementResizeCallback);
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private resizeAndDraw() {
    if (!this.isViewInit) {
      return;
    }

    // TODO: wrap the canvases in a parent component that resizes its children canvases
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

    // The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
    this.attrScale = this.cssScale * devicePixelRatio;

    // TODO: this still doesn't work very well for small/large viewports and/or on resizing
    this.pathPointRadius = this.attrScale;
    this.splitPathPointRadius = this.pathPointRadius * 0.8;
    this.draw();
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
    ctx.restore();
  }

  // Draw any selected commands.
  private drawSelections(ctx: CanvasRenderingContext2D) {
    if (!this.selectionService.getData(this.editorType).length) {
      return;
    }
    ctx.save();
    ctx.scale(this.attrScale, this.attrScale);
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer)) {
        return;
      }
      const selections =
        this.selectionService.getData(this.editorType)
          .filter(s => s.pathId === layer.id);
      if (!selections.length) {
        return;
      }
      const drawCommands = selections.map(selection => {
        const subPathCommands = layer.pathData.subPathCommands;
        return subPathCommands[selection.subPathIdx].commands[selection.drawIdx];
      });

      executeDrawCommands(drawCommands, ctx, transforms, true);

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
    ctx.restore();
  }

  // Draw any labeled points.
  private drawLabeledPoints(ctx: CanvasRenderingContext2D) {
    if (!this.timelineService.getShouldLabelPoints()
      || this.editorType === EditorType.Preview) {
      return;
    }

    const currentHover = this.currentHover;
    const startingTransforms =
      [new Matrix(this.attrScale, 0, 0, this.attrScale, 0, 0)];
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer)) {
        return;
      }

      const pathId = layer.id;
      let pathData = layer.pathData;
      if (currentHover
        && currentHover.type === HoverType.Split
        && currentHover.commandId.pathId === pathId) {
        // If the user is hovering over the inspector split button, then build
        // a snapshot of what the path would look like after the action
        // and display the result. Note that after the split action,
        // the hover's drawIdx can be used to identify the new split point.
        pathData =
          layer.pathData.splitInHalf(
            currentHover.commandId.subPathIdx,
            currentHover.commandId.drawIdx);
      }

      // Build a list containing all necessary information needed in
      // order to draw the labeled points.
      const subPathCmds = pathData.subPathCommands;
      const pathDataPointInfo = _.chain(subPathCmds)
        .map((subPathCmd: SubPathCommand, subPathIdx: number) => {
          return _.chain(subPathCmd.commands)
            // TODO: do we really want to filter out the close paths here?
            .filter((drawCmd: DrawCommand) => drawCmd.svgChar !== 'Z')
            .map((drawCmd, drawIdx) => {
              return {
                commandId: { pathId, subPathIdx, drawIdx } as CommandId,
                point: _.last(drawCmd.points),
                isSplit: drawCmd.isSplit,
              };
            })
            .value();
        })
        .flatMap(pointInfo => pointInfo)
        .value();

      transforms.reverse();
      ctx.save();

      // Draw the points in reverse order so that larger numbered points
      // display on top of lower numbered points.
      for (let i = pathDataPointInfo.length - 1; i >= 0; i--) {
        const currentPointInfo = pathDataPointInfo[i];

        if (this.activeDragPointId
          && areCommandIdsEqual(this.activeDragPointId, currentPointInfo.commandId)) {
          // Skip the currently dragged point, if it exists.
          // We'll draw that separately next.
          continue;
        }

        let color, radius;
        if (i === 0) {
          color = ColorUtil.MOVE_POINT_COLOR;
          radius = this.pathPointRadius;
        } else if (currentPointInfo.isSplit) {
          color = ColorUtil.SPLIT_POINT_COLOR;
          radius = this.splitPathPointRadius;
        } else {
          color = ColorUtil.NORMAL_POINT_COLOR;
          radius = this.pathPointRadius;
        }

        if (currentHover
          && currentHover.type !== HoverType.None
          && areCommandIdsEqual(currentPointInfo.commandId, currentHover.commandId)) {
          // TODO: update this number to something more reasonable?
          radius = this.pathPointRadius * 1.25;
        }

        const point = MathUtil.transform(currentPointInfo.point, ...transforms);
        this.drawLabeledPoint(ctx, point, radius, color, (i + 1).toString());
      }

      ctx.restore();
    }, startingTransforms);
  }

  // Draw any actively dragged points along the path.
  private drawDraggingPoints(ctx: CanvasRenderingContext2D) {
    if (!this.activeProjectionOntoPath) {
      return;
    }
    const startingTransforms =
      [new Matrix(this.attrScale, 0, 0, this.attrScale, 0, 0)];
    this.vectorLayer.walk((layer, transforms) => {
      if (layer.id !== this.activeProjectionOntoPath.pathId) {
        return;
      }
      transforms.reverse();
      ctx.save();
      const projection = this.activeProjectionOntoPath.projection;
      let point;
      if (projection.d < MIN_SNAP_THRESHOLD) {
        point = new Point(projection.x, projection.y);
      } else {
        point = this.activeDragPointLocation;
      }
      point = MathUtil.transform(point, ...transforms);
      this.drawLabeledPoint(
        ctx, point, this.splitPathPointRadius, ColorUtil.SPLIT_POINT_COLOR);
      ctx.restore();
    }, startingTransforms);
  }

  // Draw a single labeled point with optional text.
  private drawLabeledPoint(
    ctx: CanvasRenderingContext2D,
    point: Point,
    radius: number,
    color: string,
    text?: string) {

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
    this.activeDragPointId =
      this.findPathPointInRange(mouseDown, this.splitPathPointRadius);
    if (this.activeDragPointId) {
      this.activeProjectionOntoPath =
        this.calculateProjectionOntoPath(mouseDown, this.activeDragPointId.pathId);
      this.activeDragPointLocation = mouseDown;
      this.draw();
    }
  }

  onMouseMove(event: MouseEvent) {
    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
    const mouseMove = this.mouseEventToPoint(event);
    if (this.activeDragPointId) {
      this.activeProjectionOntoPath =
        this.calculateProjectionOntoPath(mouseMove, this.activeDragPointId.pathId);
      this.activeDragPointLocation = mouseMove;
      this.draw();
    }
  }

  onMouseUp(event: MouseEvent) {
    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
    if (this.activeDragPointId) {
      const activeLayer =
        this.vectorLayer.findLayerById(this.activeDragPointId.pathId) as PathLayer;

      // Delete the old drag point from the path.
      activeLayer.pathData =
        activeLayer.pathData.unsplit(
          this.activeDragPointId.subPathIdx, this.activeDragPointId.drawIdx);

      // Recalculate the projection in case the unsplit operation shuffled
      // the path indices.
      this.activeProjectionOntoPath =
        this.calculateProjectionOntoPath(
          this.mouseEventToPoint(event), this.activeDragPointId.pathId);

      // Re-split the path at the projection point.
      activeLayer.pathData = this.activeProjectionOntoPath.split();

      // Notify the global layer state service about the change and draw.
      this.layerStateService.setData(this.editorType, this.vectorLayer);
      this.activeDragPointId = undefined;
      this.activeProjectionOntoPath = undefined;
      this.activeDragPointLocation = undefined;

      // TODO: will calling 'setData' make this draw() call unnecessary?
      this.draw();
    }
  }

  onMouseLeave(event) {
    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
    if (this.activeDragPointId) {
      this.activeDragPointId = undefined;
      this.activeProjectionOntoPath = undefined;
      this.activeDragPointLocation = undefined;
      this.draw();
    }
  }

  /**
   * Finds the path point closest to the specified mouse point, with a max
   * distance specified by range. By default, non-split path points are ignored.
   */
  private findPathPointInRange(
    mousePoint: Point,
    range: number,
    splitOnly = true): CommandId | undefined {

    const minPathPoints = [];
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer)) {
        return;
      }
      transforms.reverse();
      const pathId = layer.id;
      const transformedMousePoint = MathUtil.transform(mousePoint, ...transforms);
      const minPathPoint = _.chain(layer.pathData.subPathCommands)
        .map((subPathCmd: SubPathCommand, subPathIdx: number) => {
          return subPathCmd.commands
            .map((drawCmd, drawIdx) => {
              const distance = MathUtil.distance(drawCmd.end, transformedMousePoint);
              const isSplit = drawCmd.isSplit;
              return { pathId, subPathIdx, drawIdx, distance, isSplit };
            })
            // Filter out non-split commands last to preserve the indices above.
            .filter(cmdInfo => splitOnly && cmdInfo.isSplit);
        })
        .flatMap(pathPoints => pathPoints)
        // TODO: confirm that using the attrScale here is correct...
        .filter(pathPoint => pathPoint.distance <= (range / this.attrScale))
        .reduce((prev, curr) => {
          return prev && prev.distance < curr.distance ? prev : curr;
        }, undefined)
        .value();
      if (minPathPoint) {
        minPathPoints.push(minPathPoint);
      }
    });
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
      transforms.reverse();
      const transformedPoint = MathUtil.transform(mousePoint, ...transforms);
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

  /** Returns a point in the canvas' coordinate space. */
  private mouseEventToPoint(event: MouseEvent) {
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.cssScale;
    const y = (event.pageY - canvasOffset.top) / this.cssScale;
    return new Point(x, y);
  }
}

/** Draws an command on the specified canvas context. */
function executePathData(
  layer: PathLayer | ClipPathLayer,
  ctx: CanvasRenderingContext2D,
  transforms: Matrix[],
  isDrawingSelection?: boolean) {

  const drawCommands =
    _.flatMap(layer.pathData.subPathCommands, s => s.commands as DrawCommand[]);
  executeDrawCommands(drawCommands, ctx, transforms, isDrawingSelection);
}

function executeDrawCommands(
  drawCommands: DrawCommand[],
  ctx: CanvasRenderingContext2D,
  transforms: Matrix[],
  isDrawingSelection?: boolean) {

  ctx.save();
  transforms.forEach(m => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f));

  ctx.beginPath();
  drawCommands.forEach(d => {
    const start = d.start;
    const end = d.end;

    // TODO: remove this... or at least only use it for selections?
    // this probably doesn't work for close path commands too?
    if (isDrawingSelection && d.svgChar !== 'M') {
      ctx.moveTo(start.x, start.y);
    }

    if (d.svgChar === 'M') {
      ctx.moveTo(end.x, end.y);
    } else if (d.svgChar === 'L') {
      ctx.lineTo(end.x, end.y);
    } else if (d.svgChar === 'Q') {
      ctx.quadraticCurveTo(
        d.points[1].x, d.points[1].y,
        d.points[2].x, d.points[2].y);
    } else if (d.svgChar === 'C') {
      ctx.bezierCurveTo(
        d.points[1].x, d.points[1].y,
        d.points[2].x, d.points[2].y,
        d.points[3].x, d.points[3].y);
    } else if (d.svgChar === 'Z') {
      ctx.closePath();
    } else if (d.svgChar === 'A') {
      executeArcCommand(ctx, d.args);
    }
  });

  ctx.restore();
}

/** Draws an elliptical arc on the specified canvas context. */
function executeArcCommand(ctx: CanvasRenderingContext2D, arcArgs: ReadonlyArray<number>) {
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
  const bezierCoords = arcToBeziers({
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

function areCommandIdsEqual(id1: CommandId, id2: CommandId) {
  return id1.pathId === id2.pathId
    && id1.subPathIdx === id2.subPathIdx
    && id1.drawIdx === id2.drawIdx;
}

/** Contains information about a projection onto a path. */
interface ProjectionOntoPath {
  pathId: string;
  projection: Projection;
  split: () => PathCommand;
}
