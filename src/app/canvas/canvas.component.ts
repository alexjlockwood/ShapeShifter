import * as _ from 'lodash';
import {
  Component, AfterViewInit, OnDestroy, ElementRef, HostListener,
  ViewChild, ViewChildren, Input, Output, EventEmitter
} from '@angular/core';
import { Layer, PathLayer, ClipPathLayer, GroupLayer, VectorLayer } from './../scripts/layers';
import * as Svgloader from './../scripts/svgloader';
import * as ColorUtil from './../scripts/colorutil';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import { Point, Matrix } from './../scripts/mathutil';
import * as MathUtil from './../scripts/mathutil';
import { StateService, VectorLayerType } from './../state.service';
import { Subscription } from 'rxjs/Subscription';
import { Projection } from './../scripts/bezierutil';

const ELEMENT_RESIZE_DETECTOR = erd();

// TODO(alockwood): add offscreen canvas to implement alpha
@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() vectorLayerType: VectorLayerType;
  @ViewChild('renderingCanvas') private renderingCanvasRef: ElementRef;

  private vectorLayer_: VectorLayer;
  private shouldLabelPoints_ = false;
  private canvasContainerSize: number;
  private canvas;
  private scale: number;
  private backingStoreScale: number;
  private isViewInit = false;
  private closestProjectionInfo: ProjectionInfo = null;
  private closestPathLayerId: string = null;
  private subscription: Subscription;
  private pathPointRadius: number;

  constructor(private elementRef: ElementRef, private stateService: StateService) { }

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
    this.subscription = this.stateService.subscribe(this.vectorLayerType, layer => {
      if (!layer) {
        return;
      }
      this.vectorLayer = layer;
    });
  }

  ngOnDestroy() {
    ELEMENT_RESIZE_DETECTOR.removeAllListeners(this.elementRef.nativeElement);
    this.subscription.unsubscribe();
  }

  private get vectorLayer() {
    return this.vectorLayer_;
  }

  private set vectorLayer(vectorLayer: VectorLayer) {
    // TODO(alockwood): if vector layer is null, then clear the canvas

    const didWidthChange = !this.vectorLayer || this.vectorLayer.width !== vectorLayer.width;
    const didHeightChange = !this.vectorLayer || this.vectorLayer.height !== vectorLayer.height;
    this.vectorLayer_ = vectorLayer;
    if (didWidthChange || didHeightChange) {
      this.resizeAndDraw();
    } else {
      this.draw();
    }
  }

  @Input()
  set shouldLabelPoints(shouldLabelPoints) {
    this.shouldLabelPoints_ = shouldLabelPoints;
    this.draw();
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
    this.draw();
  }

  draw() {
    if (!this.isViewInit || !this.vectorLayer) {
      return;
    }
    this.drawCanvas();
  }

  private drawCanvas() {
    if (!this.isViewInit || !this.vectorLayer) {
      return;
    }

    const ctx = this.canvas.get(0).getContext('2d');
    ctx.save();
    ctx.scale(this.backingStoreScale, this.backingStoreScale);
    ctx.clearRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);
    this.drawLayer(this.vectorLayer, ctx, []);
    ctx.restore();

    if (this.shouldLabelPoints_ && this.vectorLayerType !== VectorLayerType.Preview) {
      this.drawPathPoints(this.vectorLayer, ctx, [
        new Matrix(this.backingStoreScale, 0, 0, this.backingStoreScale, 0, 0)
      ]);
    }

    if (this.closestProjectionInfo) {
      this.drawClosestProjection(this.vectorLayer, ctx, [
        new Matrix(this.backingStoreScale, 0, 0, this.backingStoreScale, 0, 0)
      ]);
    }

    // draw pixel grid
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

  private drawLayer(layer: Layer, ctx: CanvasRenderingContext2D, transforms: Matrix[]) {
    if (layer instanceof VectorLayer) {
      layer.children.forEach(l => this.drawLayer(l, ctx, transforms));
    } else if (layer instanceof GroupLayer) {
      this.drawGroupLayer(layer, ctx, transforms);
    } else if (layer instanceof ClipPathLayer) {
      this.drawClipPathLayer(layer, ctx, transforms);
    } else if (layer instanceof PathLayer) {
      this.drawPathLayer(layer, ctx, transforms);
    }
  }

  private drawGroupLayer(
    layer: GroupLayer, ctx: CanvasRenderingContext2D, transforms: Matrix[]) {
    const matrices = this.toMatrices(layer);
    transforms.splice(transforms.length, 0, ...matrices);
    ctx.save();
    layer.children.forEach(l => this.drawLayer(l, ctx, transforms));
    ctx.restore();
    transforms.splice(-matrices.length, matrices.length);
  }

  private drawClipPathLayer(
    layer: ClipPathLayer,
    ctx: CanvasRenderingContext2D,
    transforms: Matrix[]) {
    ctx.save();
    transforms.forEach(m => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f));
    layer.pathData.execute(ctx);
    ctx.restore();

    // clip further layers
    ctx.clip();
  }

  // TODO(alockwood): update layer.pathData.length so that it reflects transforms such as scale
  private drawPathLayer(layer: PathLayer, ctx: CanvasRenderingContext2D, transforms: Matrix[]) {
    ctx.save();
    transforms.forEach(m => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f));
    layer.pathData.execute(ctx);
    ctx.restore();

    // draw the actual layer
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
  }

  private drawPathPoints(layer: Layer, ctx: CanvasRenderingContext2D, transforms: Matrix[]) {
    if (layer instanceof VectorLayer) {
      layer.children.forEach(l => this.drawPathPoints(l, ctx, transforms));
    } else if (layer instanceof GroupLayer) {
      const matrices = this.toMatrices(layer);
      transforms.splice(transforms.length, 0, ...matrices);
      ctx.save();
      layer.children.forEach(l => this.drawPathPoints(l, ctx, transforms));
      ctx.restore();
      transforms.splice(-matrices.length, matrices.length);
    } else if (layer instanceof PathLayer) {
      this.drawPathLayerPoints(layer, ctx, transforms);
    }
  }

  private drawPathLayerPoints(
    layer: PathLayer, ctx: CanvasRenderingContext2D, transforms: Matrix[]) {
    const points = [];
    layer.pathData.commands.forEach(s => {
      s.commands.forEach(c => {
        if (c.svgChar.toUpperCase() !== 'Z') {
          points.push(_.last(c.points));
        }
      });
    });

    ctx.save();
    const matrices = Array.from(transforms).reverse();
    for (let i = points.length - 1; i >= 0; i--) {
      const p = MathUtil.transform(points[i], ...matrices);
      const color = 'green';
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.pathPointRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = 'white';
      ctx.font = this.pathPointRadius + 'px serif';
      const text = (i + 1).toString();
      const width = ctx.measureText(text).width;
      // TODO(alockwood): is there a better way to get the height?
      const height = ctx.measureText('o').width;
      ctx.fillText(text, p.x - width / 2, p.y + height / 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawClosestProjection(
    layer: Layer, ctx: CanvasRenderingContext2D, transforms: Matrix[]) {
    if (layer instanceof VectorLayer) {
      layer.children.forEach(l => this.drawClosestProjection(l, ctx, transforms));
    } else if (layer instanceof GroupLayer) {
      const matrices = this.toMatrices(layer);
      transforms.splice(transforms.length, 0, ...matrices);
      ctx.save();
      layer.children.forEach(l => this.drawClosestProjection(l, ctx, transforms));
      ctx.restore();
      transforms.splice(-matrices.length, matrices.length);
    } else if (layer instanceof PathLayer) {
      ctx.save();
      const matrices = Array.from(transforms).reverse();
      const proj = this.closestProjectionInfo.projection;
      const p = MathUtil.transform({ x: proj.x, y: proj.y }, ...matrices);
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.pathPointRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = 'red';
      ctx.fill();
      ctx.restore();
    }
  }

  // TODO(alockwood): need to transform the mouse point coordinates using the group transforms
  // TODO(alockwood): don't split if user control clicks (or double clicks on mac)
  onMouseDown(event) {
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.scale;
    const y = (event.pageY - canvasOffset.top) / this.scale;
    const mouseDown = new Point(x, y);

    if (this.vectorLayerType !== VectorLayerType.End) {
      return;
    }

    this.findClosestProjectionInfo(mouseDown);

    if (this.closestProjectionInfo) {
      const pathLayer = this.vectorLayer_.findLayerById(this.closestPathLayerId) as PathLayer;
      this.closestProjectionInfo.split();
      this.stateService.setVectorLayer(this.vectorLayerType, this.vectorLayer);
      this.closestProjectionInfo = null;
    }
  }

  // TODO(alockwood): need to transform the mouse point coordinates using the group transforms
  onMouseMove(event) {
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.scale;
    const y = (event.pageY - canvasOffset.top) / this.scale;
    const mouseMove = new Point(x, y);

    if (this.vectorLayerType !== VectorLayerType.End) {
      return;
    }

    this.findClosestProjectionInfo(mouseMove);

    if (this.closestProjectionInfo) {
      this.draw();
    }
  }

  private findClosestProjectionInfo(point: Point) {
    let closestProjectionInfo: ProjectionInfo = null;
    let closestPathLayerId: string = null;
    this.vectorLayer.walk(layer => {
      if (layer instanceof PathLayer) {
        const projectionInfo = layer.pathData.project(point);
        if (projectionInfo
          && (!closestProjectionInfo
            || projectionInfo.projection.d < closestProjectionInfo.projection.d)) {
          closestProjectionInfo = projectionInfo;
          closestPathLayerId = layer.id;
        }
      }
    });
    if (this.closestProjectionInfo !== closestProjectionInfo) {
      this.closestProjectionInfo = closestProjectionInfo;
      this.closestPathLayerId = closestPathLayerId;
    }
  }

  onMouseLeave(event) {
    if (this.closestProjectionInfo) {
      this.closestProjectionInfo = null;
      this.draw();
    }
  }

  private toMatrices(layer: GroupLayer) {
    let cosr = Math.cos(layer.rotation * Math.PI / 180);
    let sinr = Math.sin(layer.rotation * Math.PI / 180);
    return [
      new Matrix(1, 0, 0, 1, layer.pivotX, layer.pivotY),
      new Matrix(1, 0, 0, 1, layer.translateX, layer.translateY),
      new Matrix(cosr, sinr, -sinr, cosr, 0, 0),
      new Matrix(layer.scaleX, 0, 0, layer.scaleY, 0, 0),
      new Matrix(1, 0, 0, 1, -layer.pivotX, -layer.pivotY)
    ];
  }
}

type ProjectionInfo = {
  projection: Projection;
  split: () => void;
};
