import {
  Component, AfterViewInit, OnDestroy, ElementRef, HostListener,
  ViewChild, ViewChildren, Input, Output, EventEmitter
} from '@angular/core';
import { Layer, PathLayer, ClipPathLayer, GroupLayer, VectorLayer } from './../scripts/models';
import * as Svgloader from './../scripts/svgloader';
import * as ColorUtil from './../scripts/colorutil';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import { Point, Matrix } from './../scripts/mathutil';
import { Command, ClosePathCommand } from './../scripts/svgcommands';
import { StateService, VectorLayerType } from './../state.service';
import { Subscription } from 'rxjs/Subscription';


const ELEMENT_RESIZE_DETECTOR = erd();


// TODO(alockwood): remove jquery? seems unnecessary on second thought
// TODO(alockwood): add offscreen canvas to implement alpha
@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @Input() vectorLayerType: VectorLayerType;

  private vectorLayer_: VectorLayer;
  private shouldLabelPoints_ = false;
  private selectedCommands_: Command[] = [];
  @Output() selectedCommandsChangedEmitter = new EventEmitter<Command[]>();

  @ViewChild('renderingCanvas') private renderingCanvasRef: ElementRef;
  private canvasContainerSize: number;
  private canvas;
  private scale: number;
  private backingStoreScale: number;
  private isViewInit = false;
  private closestProjection: { point: Point, d: number } = null;

  private subscription: Subscription;

  constructor(private elementRef: ElementRef, private stateService: StateService) { }

  ngAfterViewInit() {
    this.isViewInit = true;
    this.canvas = $(this.renderingCanvasRef.nativeElement);
    this.canvasContainerSize = this.elementRef.nativeElement.getBoundingClientRect().width;
    ELEMENT_RESIZE_DETECTOR.listenTo(this.elementRef.nativeElement, element => {
      let canvasContainerSize = element.getBoundingClientRect().width;
      if (this.canvasContainerSize !== canvasContainerSize) {
        this.canvasContainerSize = canvasContainerSize;
        this.resizeAndDraw();
      }
    });
    this.subscription = this.stateService.subscribeToVectorLayer(this.vectorLayerType, layer => {
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

  get shouldLabelPoints() {
    return this.shouldLabelPoints_;
  }

  @Input()
  set shouldLabelPoints(shouldLabelPoints) {
    this.shouldLabelPoints_ = shouldLabelPoints;
    this.draw();
  }

  get selectedCommands() {
    return this.selectedCommands_;
  }

  @Input()
  set selectedCommands(selectedCommands: Command[]) {
    this.selectedCommands_ = selectedCommands;
    this.draw();
  }

  private resizeAndDraw() {
    if (!this.isViewInit || !this.vectorLayer) {
      return;
    }

    const containerAspectRatio = this.canvasContainerSize / this.canvasContainerSize;
    const artworkAspectRatio = this.vectorLayer.width / (this.vectorLayer.height || 1);

    if (artworkAspectRatio > containerAspectRatio) {
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

    if (this.shouldLabelPoints) {
      this.drawPathPoints(this.vectorLayer, ctx, [
        new Matrix(this.backingStoreScale, 0, 0, this.backingStoreScale, 0, 0)
      ]);
    }

    if (this.closestProjection) {
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
      layer.children.forEach(layer => this.drawLayer(layer, ctx, transforms));
    } else if (layer instanceof GroupLayer) {
      this.drawGroupLayer(layer, ctx, transforms);
    } else if (layer instanceof ClipPathLayer) {
      this.drawClipPathLayer(layer, ctx, transforms);
    } else if (layer instanceof PathLayer) {
      this.drawPathLayer(layer, ctx, transforms);
    }
  }

  private drawGroupLayer(layer: GroupLayer, ctx: CanvasRenderingContext2D, transforms: Matrix[]) {
    const matrices = layer.toMatrices();
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
        shownFraction * layer.pathData.length,
        (1 - shownFraction + 0.001) * layer.pathData.length
      ]);
      // The amount to offset the path is equal to the trimPathStart plus
      // trimPathOffset. We mod the result because the trimmed path
      // should wrap around once it reaches 1.
      ctx.lineDashOffset =
        layer.pathData.length * (1 - ((layer.trimPathStart + layer.trimPathOffset) % 1));
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
      layer.children.forEach(layer => this.drawPathPoints(layer, ctx, transforms));
    } else if (layer instanceof GroupLayer) {
      const matrices = layer.toMatrices();
      transforms.splice(transforms.length, 0, ...matrices);
      ctx.save();
      layer.children.forEach(l => this.drawPathPoints(l, ctx, transforms));
      ctx.restore();
      transforms.splice(-matrices.length, matrices.length);
    } else if (layer instanceof PathLayer) {
      this.drawPathLayerPoints(layer, ctx, transforms);
    }
  }

  private drawPathLayerPoints(layer: PathLayer, ctx: CanvasRenderingContext2D, transforms: Matrix[]) {
    const points = [];
    layer.pathData.commands.forEach(c => {
      if (!(c instanceof ClosePathCommand)) {
        points.push(c.points[c.points.length - 1]);
      }
    });

    ctx.save();
    const matrices = Array.from(transforms).reverse();
    points.forEach((p, index) => {
      p = p.transform(...matrices);
      const color = 'green';
      const radius = 32;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "white";
      ctx.font = '32px serif';
      const text = (index + 1).toString();
      const width = ctx.measureText(text).width;
      // TODO(alockwood): is there a better way to get the height?
      const height = ctx.measureText('o').width;
      ctx.fillText(text, p.x - width / 2, p.y + height / 2);
      ctx.fill();
    });
    ctx.restore();
  }

  private drawClosestProjection(layer: Layer, ctx: CanvasRenderingContext2D, transforms: Matrix[]) {
    if (layer instanceof VectorLayer) {
      layer.children.forEach(layer => this.drawClosestProjection(layer, ctx, transforms));
    } else if (layer instanceof GroupLayer) {
      const matrices = layer.toMatrices();
      transforms.splice(transforms.length, 0, ...matrices);
      ctx.save();
      layer.children.forEach(l => this.drawClosestProjection(l, ctx, transforms));
      ctx.restore();
      transforms.splice(-matrices.length, matrices.length);
    } else if (layer instanceof PathLayer) {
      ctx.save();
      const matrices = Array.from(transforms).reverse();
      const p = this.closestProjection.point.transform(...matrices);
      const radius = 16;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = 'red';
      ctx.fill();
      ctx.restore();
    }
  }

  onMouseDown(event) {
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.scale;
    const y = (event.pageY - canvasOffset.top) / this.scale;
    const mouseDown = new Point(x, y);
    // TODO(alockwood): select clips and/or groups in addition to paths?
    const matrices = [];
    const findSelectedPointCommands_ = (layer: Layer): PointCommand[] => {
      const recurseAndFlatten = (l: Layer) => {
        return l.children.map(c => findSelectedPointCommands_(c))
          .reduce((result, next) => result.concat(next), []);
      };
      if (layer instanceof VectorLayer) {
        return recurseAndFlatten(layer);
      }
      if (layer instanceof (GroupLayer)) {
        const transformMatrices = layer.toMatrices();
        matrices.splice(matrices.length, 0, ...transformMatrices);
        const result = recurseAndFlatten(layer);
        matrices.splice(-transformMatrices.length, transformMatrices.length);
        return result;
      }
      if (layer instanceof PathLayer) {
        const transformedMousePoint = mouseDown.transform(...Array.from(matrices).reverse());
        return this.findPointCommandsInRange(layer, transformedMousePoint, 0.5);
      }
      return [];
    }
    let selectedPointCommands = findSelectedPointCommands_(this.vectorLayer);
    if (selectedPointCommands.length) {
      selectedPointCommands = [selectedPointCommands[selectedPointCommands.length - 1]];
    }
    this.selectedCommandsChangedEmitter.emit(selectedPointCommands.map(pc => pc.command));
  }

  onMouseMove(event) {
    const canvasOffset = this.canvas.offset();
    const x = (event.pageX - canvasOffset.left) / this.scale;
    const y = (event.pageY - canvasOffset.top) / this.scale;
    const mouseMove = new Point(x, y);
    let closestProjection = null;
    this.vectorLayer.walk(layer => {
      if (layer instanceof PathLayer) {
        const projection = layer.pathData.project(mouseMove);
        if (projection && (!closestProjection || projection.d < closestProjection.d)) {
          closestProjection = projection;
        }
      }
    });
    if (this.closestProjection !== closestProjection) {
      this.closestProjection = closestProjection;
      this.draw();
    }
  }

  onMouseLeave(event) {
    if (this.closestProjection) {
      this.closestProjection = null;
      this.draw();
    }
  }

  private findPointCommandsInRange(
    layer: PathLayer,
    point: Point,
    radius: number): PointCommand[] {

    const pointCommands = [];
    layer.pathData.commands.forEach(c => {
      c.points.forEach(p => {
        if (p && point.distanceTo(p) <= radius) {
          pointCommands.push({
            point: p,
            command: c,
          });
        }
      });
    });

    return pointCommands;
  }
}

type PointCommand = { point: Point, command: Command };
