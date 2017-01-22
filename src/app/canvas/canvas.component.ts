import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, HostListener,
  ViewChild, ViewChildren, Input, Output, EventEmitter
} from '@angular/core';
import {
  Layer, PathLayer, ClipPathLayer, GroupLayer,
  VectorLayer, PathCommand, EditorType, SubPathCommand, DrawCommand
} from '../scripts/model';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import { Point, Matrix, Projection, MathUtil, ColorUtil } from '../scripts/common';
import { AnimationService } from '../services/animation.service';
import { LayerStateService } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { arcToBeziers } from '../scripts/svg';
import { SelectionService, Selection } from '../services/selection.service';

const ELEMENT_RESIZE_DETECTOR = erd();

// TODO(alockwood): add offscreen canvas to implement alpha
@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() editorType: EditorType;
  @ViewChild('renderingCanvas') private renderingCanvasRef: ElementRef;

  private vectorLayer: VectorLayer;
  private shouldLabelPoints_ = false;
  private canvasContainerSize: number;
  private canvas: JQuery;
  private scale: number;
  private backingStoreScale: number;
  private isViewInit = false;
  private closestProjectionInfo: ProjectionInfo;
  private closestPathLayerId: string;
  private subscriptions: Subscription[] = [];
  private pathPointRadius: number;
  private splitPathPointRadius: number;
  private currentSelections: Selection[] = [];
  private activePathPoint: PathPoint;

  constructor(
    private elementRef: ElementRef,
    private layerStateService: LayerStateService,
    private animationService: AnimationService,
    private selectionService: SelectionService) { }

  ngAfterViewInit() {
    this.isViewInit = true;
    this.canvas = $(this.renderingCanvasRef.nativeElement);
    this.canvasContainerSize = this.elementRef.nativeElement.getBoundingClientRect().width;
    ELEMENT_RESIZE_DETECTOR.listenTo(this.elementRef.nativeElement, element => {
      const canvasContainerSize = element.getBoundingClientRect().width;
      if (this.canvasContainerSize !== canvasContainerSize) {
        this.canvasContainerSize = canvasContainerSize;
        this.resizeAndDraw();
      }
    });
    this.subscriptions.push(
      this.layerStateService.addListener(
        this.editorType, vl => {
          if (vl) {
            const oldVl = this.vectorLayer;
            const didWidthChange = !oldVl || oldVl.width !== vl.width;
            const didHeightChange = !oldVl || oldVl.height !== vl.height;
            this.vectorLayer = vl;
            if (didWidthChange || didHeightChange) {
              this.resizeAndDraw();
            } else {
              this.draw();
            }
          }
        }));
    if (this.editorType === EditorType.Preview) {
      this.subscriptions.push(
        this.animationService.addListener(fraction => {
          if (this.vectorLayer) {
            // TODO(alockwood): if vector layer is undefined, then clear the canvas
            const startLayer = this.layerStateService.getData(EditorType.Start);
            const endLayer = this.layerStateService.getData(EditorType.End);
            this.vectorLayer.walk(layer => {
              if (layer instanceof PathLayer) {
                const start = startLayer.findLayerById(layer.id) as PathLayer;
                const end = endLayer.findLayerById(layer.id) as PathLayer;
                layer.pathData =
                  layer.pathData.interpolate(start.pathData, end.pathData, fraction);
              }
            });
            this.draw();
          }
        }));
    } else {
      this.subscriptions.push(
        this.selectionService.addListener(
          this.editorType, (selections: Selection[]) => {
            this.currentSelections = selections;
            this.draw();
          }));
    }
  }

  ngOnDestroy() {
    ELEMENT_RESIZE_DETECTOR.removeAllListeners(this.elementRef.nativeElement);
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  @Input()
  set shouldLabelPoints(shouldLabelPoints: boolean) {
    if (this.shouldLabelPoints_ !== shouldLabelPoints) {
      this.shouldLabelPoints_ = shouldLabelPoints;
      this.draw();
    }
  }

  private resizeAndDraw() {
    if (!this.isViewInit || !this.vectorLayer) {
      return;
    }

    const containerAspectRatio = this.canvasContainerSize / this.canvasContainerSize;
    const vectorAspectRatio = this.vectorLayer.width / (this.vectorLayer.height || 1);

    if (vectorAspectRatio > containerAspectRatio) {
      this.scale = this.canvasContainerSize / this.vectorLayer.width;
    } else {
      this.scale = this.canvasContainerSize / this.vectorLayer.height;
    }
    this.scale = Math.max(1, Math.floor(this.scale));
    this.backingStoreScale = this.scale * (window.devicePixelRatio || 1);

    this.canvas
      .attr({
        width: this.vectorLayer.width * this.backingStoreScale,
        height: this.vectorLayer.height * this.backingStoreScale,
      })
      .css({
        width: this.vectorLayer.width * this.scale,
        height: this.vectorLayer.height * this.scale,
      });

    this.pathPointRadius = this.backingStoreScale * 0.6;
    this.splitPathPointRadius = this.pathPointRadius * 0.8;
    this.draw();
  }

  draw() {
    if (!this.isViewInit || !this.vectorLayer) {
      return;
    }

    // Draw the layers to the canvas.
    const ctx = (this.canvas.get(0) as HTMLCanvasElement).getContext('2d');
    ctx.save();
    ctx.scale(this.backingStoreScale, this.backingStoreScale);
    ctx.clearRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);
    this.vectorLayer.walk((layer, transforms) => {
      if (layer instanceof ClipPathLayer) {
        executePathData(layer, ctx, transforms);
        ctx.clip();
        return;
      }
      if (!(layer instanceof PathLayer)) {
        return;
      }
      // TODO(alockwood): update layer.pathData.length so that it reflects scale transforms
      ctx.save();

      executePathData(layer, ctx, transforms);

      // Draw the actual layer to the canvas.
      ctx.strokeStyle = ColorUtil.androidToCssColor(layer.strokeColor, layer.strokeAlpha);
      ctx.lineWidth = layer.strokeWidth;
      ctx.fillStyle = ColorUtil.androidToCssColor(layer.fillColor, layer.fillAlpha);
      ctx.lineCap = layer.strokeLinecap;
      ctx.lineJoin = layer.strokeLinejoin;
      ctx.miterLimit = layer.strokeMiterLimit || 4;

      if (layer.trimPathStart !== 0 || layer.trimPathEnd !== 1 || layer.trimPathOffset !== 0) {
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
        ctx.lineDashOffset =
          layer.pathData.pathLength * (1 - ((layer.trimPathStart + layer.trimPathOffset) % 1));
      } else {
        ctx.setLineDash([]);
      }
      if (layer.strokeColor && layer.strokeWidth && layer.trimPathStart !== layer.trimPathEnd) {
        ctx.stroke();
      }
      if (layer.fillColor) {
        ctx.fill();
      }
      ctx.restore();
    });
    ctx.restore();

    // Draw any selected paths.
    if (this.currentSelections.length) {
      ctx.save();
      ctx.scale(this.backingStoreScale, this.backingStoreScale);
      this.vectorLayer.walk((layer, transforms) => {
        if (!(layer instanceof PathLayer)) {
          return;
        }
        const selections = this.currentSelections.filter(s => s.pathId === layer.id);
        if (!selections.length) {
          return;
        }
        const drawCommands = selections.map(sel => {
          const subPathCommands = layer.pathData.subPathCommands;
          return subPathCommands[sel.subPathIdx].commands[sel.drawIdx];
        });

        executeDrawCommands(drawCommands, ctx, transforms, true);

        ctx.save();
        ctx.lineWidth = 6 / this.scale; // 2px
        ctx.strokeStyle = '#fff';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 3 / this.scale; // 2px
        ctx.stroke();
        ctx.restore();
      });
      ctx.restore();
    }

    // Draw any labeled points.
    if (this.shouldLabelPoints_ && this.editorType !== EditorType.Preview) {
      const startingTransforms =
        [new Matrix(this.backingStoreScale, 0, 0, this.backingStoreScale, 0, 0)];
      this.vectorLayer.walk((layer, transforms) => {
        if (!(layer instanceof PathLayer)) {
          return;
        }
        const pathDataPoints = _.flatMap(layer.pathData.subPathCommands, subPathCommand => {
          return subPathCommand.points as { point: Point, isSplit: boolean }[];
        });
        transforms.reverse();
        ctx.save();
        for (let i = pathDataPoints.length - 1; i >= 0; i--) {
          const p = MathUtil.transform(pathDataPoints[i].point, ...transforms);
          const color = i === 0 ? 'blue' : pathDataPoints[i].isSplit ? 'purple' : 'green';
          const radius =
            pathDataPoints[i].isSplit ? this.splitPathPointRadius : this.pathPointRadius;
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = 'white';
          ctx.font = radius + 'px serif';
          const text = (i + 1).toString();
          const width = ctx.measureText(text).width;
          // TODO(alockwood): is there a better way to get the height?
          const height = ctx.measureText('o').width;
          ctx.fillText(text, p.x - width / 2, p.y + height / 2);
          ctx.fill();
        }
        ctx.restore();
      }, startingTransforms);
    }

    if (this.closestProjectionInfo) {
      const startingTransforms =
        [new Matrix(this.backingStoreScale, 0, 0, this.backingStoreScale, 0, 0)];
      this.vectorLayer.walk((layer, transforms) => {
        if (!(layer instanceof PathLayer)) {
          return;
        }
        if (layer.id !== this.closestPathLayerId) {
          return;
        }
        ctx.save();
        const matrices = transforms.slice().reverse();
        const proj = this.closestProjectionInfo.projection;
        const p = MathUtil.transform({ x: proj.x, y: proj.y }, ...matrices);
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.pathPointRadius, 0, 2 * Math.PI, false);
        ctx.fillStyle = 'red';
        ctx.fill();
        ctx.restore();
      }, startingTransforms);
    }

    // Draw the pixel grid.
    if (this.scale > 4) {
      ctx.fillStyle = 'rgba(128, 128, 128, .25)';
      for (let x = 1; x < this.vectorLayer.width; x++) {
        ctx.fillRect(
          x * this.backingStoreScale - 0.5 * (window.devicePixelRatio || 1),
          0,
          1 * (window.devicePixelRatio || 1),
          this.vectorLayer.height * this.backingStoreScale);
      }
      for (let y = 1; y < this.vectorLayer.height; y++) {
        ctx.fillRect(
          0,
          y * this.backingStoreScale - 0.5 * (window.devicePixelRatio || 1),
          this.vectorLayer.width * this.backingStoreScale,
          1 * (window.devicePixelRatio || 1));
      }
    }
  }

  // TODO(alockwood): don't split if user control clicks (or two finger clicks on mac)
  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
    const mouseDown = this.mouseEventToPoint(event);
    // this.activePathPoint =
    //   this.findClosestPathPointInRange(mouseDown, this.splitPathPointRadius);
    //console.log(this.activePathPoint);

    this.findClosestProjectionInfo(mouseDown);
    if (this.closestProjectionInfo) {
      const pathLayer = this.vectorLayer.findLayerById(this.closestPathLayerId) as PathLayer;
      pathLayer.pathData = this.closestProjectionInfo.split();
      this.layerStateService.setData(this.editorType, this.vectorLayer);
      this.closestProjectionInfo = undefined;
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
    const mouseMove = this.mouseEventToPoint(event);
    this.findClosestProjectionInfo(mouseMove);
    if (this.closestProjectionInfo) {
      this.draw();
    }
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave(event) {
    if (this.editorType === EditorType.Preview) {
      // The user never interacts with the preview canvas.
      return;
    }
    if (this.closestProjectionInfo) {
      this.closestProjectionInfo = undefined;
      this.draw();
    }
  }

  private findClosestPathPointInRange(mousePoint: Point, range: number, splitOnly = true) {
    const minPathPoints = [];
    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer)) {
        return;
      }
      transforms.reverse();
      const layerId = layer.id;
      const transformedMousePoint = MathUtil.transform(mousePoint, ...transforms);
      const minPathPoint = _.chain(layer.pathData.subPathCommands)
        .map((subPathCmd: SubPathCommand, subPathIdx: number) => {
          const result = subPathCmd.commands
            .map((drawCmd, drawIdx) => {
              const distance = MathUtil.distance(drawCmd.end, transformedMousePoint);
              const isSplit = drawCmd.isSplit;
              return { layerId, subPathIdx, drawIdx, distance, isSplit };
            })
            .filter(cmdInfo => splitOnly && cmdInfo.isSplit);
          console.log(result);
          return result;
        })
        .flatMap(pathPoints => pathPoints)
        .filter(pathPoint => pathPoint.distance <= (range / this.backingStoreScale))
        .reduce((prev, curr) => {
          return prev && prev.distance < curr.distance ? prev : curr
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

  private findClosestProjectionInfo(point: Point) {
    let closestProjectionInfo: ProjectionInfo;
    let closestPathLayerId: string;

    this.vectorLayer.walk((layer, transforms) => {
      if (!(layer instanceof PathLayer)) {
        return;
      }
      transforms.reverse();
      const transformedPoint = MathUtil.transform(point, ...transforms);
      const projectionInfo = layer.pathData.project(transformedPoint);
      if (projectionInfo
        && (!closestProjectionInfo
          || projectionInfo.projection.d < closestProjectionInfo.projection.d)) {
        closestProjectionInfo = projectionInfo;
        closestPathLayerId = layer.id;
      }
    });

    if (this.closestProjectionInfo !== closestProjectionInfo) {
      this.closestProjectionInfo = closestProjectionInfo;
      this.closestPathLayerId = closestPathLayerId;
    }
  }

  private mouseEventToPoint(event: MouseEvent) {
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.scale;
    const y = (event.pageY - canvasOffset.top) / this.scale;
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
    // degenerate to point
    return;
  }

  if (rx === 0 || ry === 0) {
    // degenerate to line
    ctx.lineTo(tempPoint1X, tempPoint1Y);
    return;
  }

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

interface ProjectionInfo {
  projection: Projection;
  split: () => PathCommand;
}

/** Contains information about a dragged point in a path. */
interface PathPoint {
  layerId: string;
  subPathIdx: number;
  drawIdx: number;
}
