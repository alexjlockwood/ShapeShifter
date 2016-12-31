import {
  Component, AfterViewInit, ElementRef, HostListener,
  ViewChild, ViewChildren, OnDestroy, Input, Output, EventEmitter
} from '@angular/core';
import { Layer, PathLayer, ClipPathLayer, GroupLayer, VectorLayer } from './../scripts/models';
import * as Svgloader from './../scripts/svgloader';
import * as ColorUtil from './../scripts/colorutil';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import { Point, Matrix } from './../scripts/mathutil';
import { Command } from './../scripts/svgcommands';


// TODO(alockwood): remove jquery? seems unnecessary on second thought
// TODO(alockwood): add offscreen canvas to implement alpha
@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit {
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

  constructor(private elementRef: ElementRef) { }

  ngAfterViewInit() {
    this.isViewInit = true;

    this.canvasContainerSize = this.elementRef.nativeElement.getBoundingClientRect().width;
    erd().listenTo(this.elementRef.nativeElement, element => {
      let canvasContainerSize = element.getBoundingClientRect().width;
      if (this.canvasContainerSize !== canvasContainerSize) {
        this.canvasContainerSize = canvasContainerSize;
        this.resizeAndDraw();
      }
    });

    this.canvas = $(this.renderingCanvasRef.nativeElement);
    this.canvas
      .on('mousedown', event => {
        const canvasOffset = this.canvas.offset();
        const x = (event.pageX - canvasOffset.left) / this.scale;
        const y = (event.pageY - canvasOffset.top) / this.scale;
        this.onMouseDown(new Point(x, y), event.metaKey || event.shiftKey);
      });

    this.resizeAndDraw();
  }

  get vectorLayer() {
    return this.vectorLayer_;
  }

  @Input()
  set vectorLayer(vectorLayer: VectorLayer) {
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
    console.log(selectedCommands);
    this.selectedCommands_ = selectedCommands;
    this.draw();
  }

  private resizeAndDraw() {
    if (!this.isViewInit) {
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
    if (!this.isViewInit) {
      return;
    }
    this.drawCanvas();
  }

  private drawCanvas() {
    if (!this.isViewInit) {
      return;
    }

    const ctx = this.canvas.get(0).getContext('2d');
    ctx.save();
    ctx.scale(this.backingStoreScale, this.backingStoreScale);
    ctx.clearRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);
    this.drawLayer(this.vectorLayer, ctx, []);
    ctx.restore();

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

  private drawLayer(layer: Layer, ctx: CanvasRenderingContext2D, transforms: TransformFunc[]) {
    if (layer instanceof VectorLayer) {
      layer.children.forEach(layer => this.drawLayer(layer, ctx, transforms));
    } else if (layer instanceof GroupLayer) {
      this.drawGroupLayer(layer, ctx, transforms);
    } else if (layer instanceof ClipPathLayer) {
      this.drawClipPathLayer(layer, ctx, transforms);
    } else if (layer instanceof PathLayer) {
      this.drawPathLayer(layer, ctx, transforms);
      if (this.shouldLabelPoints) {
        this.drawPathLayerPoints(layer, ctx, transforms);
      }
    }
  }

  private drawGroupLayer(layer: GroupLayer, ctx: CanvasRenderingContext2D, transforms: TransformFunc[]) {
    transforms.push(() => {
      ctx.translate(layer.pivotX, layer.pivotY);
      ctx.translate(layer.translateX, layer.translateY);
      ctx.rotate(layer.rotation * Math.PI / 180);
      ctx.scale(layer.scaleX, layer.scaleY);
      ctx.translate(-layer.pivotX, -layer.pivotY);
    });
    ctx.save();
    layer.children.forEach(layer => this.drawLayer(layer, ctx, transforms));
    ctx.restore();
    transforms.pop();
  }

  private drawClipPathLayer(
    layer: ClipPathLayer,
    ctx: CanvasRenderingContext2D,
    transforms: (() => void)[]) {
    ctx.save();
    transforms.forEach(t => t());
    layer.pathData.execute(ctx);
    ctx.restore();

    // clip further layers
    ctx.clip();
  }

  // TODO(alockwood): update layer.pathData.length so that it reflects transforms such as scale
  private drawPathLayer(layer: PathLayer, ctx: CanvasRenderingContext2D, transforms: TransformFunc[]) {
    ctx.save();
    transforms.forEach(t => t());
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

  // TODO(alockwood): avoid scaling the points we draw here as a result of applying the transforms
  private drawPathLayerPoints(layer: PathLayer, ctx: CanvasRenderingContext2D, transforms: TransformFunc[]) {
    const points: { point: Point, isSelected: boolean }[] = [];
    layer.pathData.commands.forEach(c => {
      if (this.selectedCommands.some(selectedCommand => selectedCommand === c)) {
        points.push(...c.points.map(p => {
          return { point: p, isSelected: true };
        }));
      } else {
        points.push(...c.points.map(p => {
          return { point: p, isSelected: false };
        }));
      }
    });

    ctx.save();
    transforms.forEach(t => t());
    points.forEach((obj, index) => {
      const p = obj.point;
      const color = obj.isSelected ? 'red' : 'green';
      const radius = obj.isSelected ? 0.8 : 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "white";
      ctx.font = '1px serif';
      const text = (index + 1).toString();
      const width = ctx.measureText(text).width;
      const height = ctx.measureText(text).width;
      ctx.fillText(text, p.x - width / 2, p.y + height / 2);
      ctx.fill();
    });
    ctx.restore();
  }

  private onMouseDown(mouseDown: Point, isMetaOrShiftKeyPressed: boolean) {
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

  private findPointCommandsInRange(
    layer: PathLayer,
    point: Point,
    radius: number): PointCommand[] {

    const pointCommands = [];
    layer.pathData.commands.forEach(c => {
      c.points.forEach(p => {
        if (point.distanceTo(p) <= radius) {
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
type TransformFunc = () => void;
