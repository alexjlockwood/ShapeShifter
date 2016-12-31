import {
  Component, AfterViewInit, ElementRef, HostListener,
  ViewChild, ViewChildren, OnDestroy, Input, OnChanges, SimpleChange
} from '@angular/core';
import { Layer, PathLayer, ClipPathLayer, GroupLayer, VectorLayer } from './../scripts/models';
import * as Svgloader from './../scripts/svgloader';
import * as ColorUtil from './../scripts/colorutil';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import { RulerComponent } from './ruler/ruler.component';
import { Point } from './../scripts/mathutil';
import { Command } from './../scripts/svgcommands';


// TODO(alockwood): remove jquery? seems unnecessary on second thought
// TODO(alockwood): add offscreen canvas to implement alpha
// TODO(alockwood): adjust scale depending on window.devicePixelRatio
@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit, OnChanges {
  @ViewChild('renderingCanvas') private canvasRef: ElementRef;
  @ViewChildren(RulerComponent) private rulerComponents;
  private canvas;
  private vectorLayer_: VectorLayer;
  private scale_: number;
  private backingStoreScale_: number;
  private shouldLabelPoints_ = false;
  private canvasContainerSize: number;
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

    this.canvas = $(this.canvasRef.nativeElement);
    this.canvas
      .on('mousedown', event => {
        const canvasOffset = this.canvas.offset();
        const x = (event.pageX - canvasOffset.left) / this.scale_;
        const y = (event.pageY - canvasOffset.top) / this.scale_;
        const mousePoint = new Point(x, y);
        const matrices = [];
        // TODO(alockwood): select clips and/or groups in addition to paths?
        const toggleSelectedPath_ = layer => {
          if (layer instanceof VectorLayer) {
            return layer.children.some(l => toggleSelectedPath_(l));
          }
          if (layer instanceof GroupLayer) {
            const transformMatrices = layer.toMatrices();
            matrices.splice(matrices.length, 0, ...transformMatrices);
            const result = layer.children.some(l => toggleSelectedPath_(l));
            matrices.splice(-transformMatrices.length, transformMatrices.length);
            return result;
          }
          if (layer instanceof PathLayer) {
            //let shouldUpdateSelection = false;
            const transformedMousePoint = mousePoint.transform(...Array.from(matrices).reverse());
            const selectedPoints = this.findSelectedPathPoints(layer, transformedMousePoint, 0.5);
            //if (shouldUpdateSelection) {
            //  if (event.metaKey || event.shiftKey) {
            //    console.log('setting selection: ' + layer.id);
            //this.studioState_.toggleSelected(layer);
            //  } else {
            //    console.log('setting selection: ' + layer.id);
            //this.studioState_.selection = [layer];
            //  }
            //}
            console.log(selectedPoints);
            return selectedPoints.length > 0;
          }
          return false;
        };
        if (!toggleSelectedPath_(this.vectorLayer) && !(event.metaKey || event.shiftKey)) {
          //this.studioState_.selection = [];
          console.log('clearing selection');
        }
      })
      .on('mousemove', event => {
        const canvasOffset = this.canvas.offset();
        const x = Math.round((event.pageX - canvasOffset.left) / this.scale_);
        const y = Math.round((event.pageY - canvasOffset.top) / this.scale_);
        this.rulerComponents.forEach(r => r.showMouse(x, y));
      })
      .on('mouseleave', () => {
        this.rulerComponents.forEach(r => r.hideMouse());
      });

    this.resizeAndDraw();
  }

  private findSelectedPathPoints(
    layer: PathLayer,
    point: Point,
    radius: number): { point: Point, command: Command }[] {
    let dist_ = (p1: Point, p2: Point) => {
      return Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));
    };

    const points = [];
    layer.pathData.commands.forEach(c => {
      c.points.forEach(p => {
        if (dist_(point, p) <= radius) {
          points.push({
            point: p,
            command: c,
          });
        }
      });
    });

    return points;
  }

  ngOnChanges(changes: {[propKey: string]: SimpleChange}) {
    console.log(changes);
  }

  get vectorLayer() {
    return this.vectorLayer_;
  }

  @Input()
  set vectorLayer(vectorLayer: VectorLayer) {
    console.log('changed', vectorLayer);
    const didWidthChange = !this.vectorLayer || this.vectorLayer.width !== vectorLayer.width;
    const didHeightChange = !this.vectorLayer || this.vectorLayer.height !== vectorLayer.height;
    this.vectorLayer_ = vectorLayer;
    if (!this.isViewInit) {
      return;
    }
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
    console.log(shouldLabelPoints);
    if (this.shouldLabelPoints !== shouldLabelPoints) {
      this.shouldLabelPoints_ = shouldLabelPoints;
      if (this.isViewInit) {
        this.draw();
      }
    }
  }

  private resizeAndDraw() {
    if (!this.vectorLayer) {
      return;
    }

    const containerAspectRatio = this.canvasContainerSize / this.canvasContainerSize;
    const artworkAspectRatio = this.vectorLayer.width / (this.vectorLayer.height || 1);

    if (artworkAspectRatio > containerAspectRatio) {
      this.scale_ = this.canvasContainerSize / this.vectorLayer.width;
    } else {
      this.scale_ = this.canvasContainerSize / this.vectorLayer.height;
    }
    this.scale_ = Math.max(1, Math.floor(this.scale_));

    // TODO(alockwood): figure out how to inject window device pixel ratio below
    this.backingStoreScale_ = this.scale_ * (window && window.devicePixelRatio || 1);

    this.canvas
      .attr({
        width: this.vectorLayer.width * this.backingStoreScale_,
        height: this.vectorLayer.height * this.backingStoreScale_,
      })
      .css({
        width: this.vectorLayer.width * this.scale_,
        height: this.vectorLayer.height * this.scale_,
      });

    this.draw();
  }

  draw() {
    if (!this.vectorLayer) {
      return;
    }
    this.drawCanvas();
    this.drawRulers();
  }

  private drawCanvas() {
    if (!this.vectorLayer) {
      return;
    }

    const ctx = this.canvas.get(0).getContext('2d');
    ctx.save();
    ctx.scale(this.backingStoreScale_, this.backingStoreScale_);
    ctx.clearRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);
    this.drawLayer(this.vectorLayer, ctx, []);
    ctx.restore();

    // draw pixel grid
    if (this.scale_ > 4) {
      ctx.fillStyle = 'rgba(128, 128, 128, .25)';
      for (let x = 1; x < this.vectorLayer.width; x++) {
        ctx.fillRect(
          x * this.backingStoreScale_ - 0.5 * (window.devicePixelRatio || 1),
          0,
          1 * (window.devicePixelRatio || 1),
          this.vectorLayer.height * this.backingStoreScale_);
      }
      for (let y = 1; y < this.vectorLayer.height; y++) {
        ctx.fillRect(
          0,
          y * this.backingStoreScale_ - 0.5 * (window.devicePixelRatio || 1),
          this.vectorLayer.width * this.backingStoreScale_,
          1 * (window.devicePixelRatio || 1));
      }
    }
  }

  private drawLayer(layer: Layer, ctx: CanvasRenderingContext2D, transforms: TransformFn[]) {
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

  private drawGroupLayer(layer: GroupLayer, ctx: CanvasRenderingContext2D, transforms: TransformFn[]) {
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
  private drawPathLayer(layer: PathLayer, ctx: CanvasRenderingContext2D, transforms: TransformFn[]) {
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
  private drawPathLayerPoints(layer: PathLayer, ctx: CanvasRenderingContext2D, transforms: TransformFn[]) {
    const points = [];
    layer.pathData.commands.forEach(c => points.push(...c.points));

    ctx.save();
    transforms.forEach(t => t());
    points.forEach((p, index) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.75, 0, 2 * Math.PI, false);
      ctx.fillStyle = 'green';
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = "white";
      ctx.font = '1px serif';
      const text = (index + 1).toString();
      const width = ctx.measureText(text).width;
      const height = ctx.measureText(text).width;
      ctx.fillText(text, p.x - width / 2, p.y + height / 2);
      ctx.fill();
    })
    ctx.restore();
  }

  private drawRulers() {
    if (!this.vectorLayer) {
      return;
    }
    this.rulerComponents.forEach(r => {
      r.setVectorLayerSize({
        width: this.vectorLayer.width,
        height: this.vectorLayer.height
      });
      r.draw();
    });
  }
}

type TransformFn = () => void;
