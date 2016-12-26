import { Component, AfterViewInit, ElementRef, HostListener, ViewChild, OnDestroy, Input } from '@angular/core';
import { Layer, PathLayer, ClipPathLayer, GroupLayer, VectorLayer } from './../scripts/models';
import * as Svgloader from './../scripts/svgloader';
import * as ColorUtil from './../scripts/colorutil';
import * as $ from 'jquery';
import { StateService } from '../state.service';
import { Subscription } from 'rxjs/Subscription';
import * as erd from 'element-resize-detector';


// TODO(alockwood): remove jquery? seems unnecessary on second thought
// TODO(alockwood): add offscreen canvas to implement alpha
// TODO(alockwood): adjust scale depending on window.devicePixelRatio
@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('renderingCanvas') private canvasRef: ElementRef;
  private canvas;
  private vectorLayer: VectorLayer;
  private scale_: number;
  private backingStoreScale_: number;
  @Input() private isStartCanvas: boolean;
  @Input() private isPreviewCanvas: boolean;
  @Input() private isEndCanvas: boolean;
  //private offscreenCanvas: any;
  private shouldLabelPoints = false;
  private subscriptions = [];

  constructor(private elementRef: ElementRef, private stateService: StateService) {
    erd().listenTo(this.elementRef.nativeElement, element => {
      this.resizeAndDrawCanvas(element.getBoundingClientRect().width);
    });
  }

  ngAfterViewInit() {
    this.subscriptions.push(
      this.stateService.getShouldLabelPointsChangedSubscription(
        shouldLabelPoints => {
          if (this.shouldLabelPoints !== shouldLabelPoints) {
            this.shouldLabelPoints = shouldLabelPoints;
            this.drawCanvas();
          }
        }));

    if (this.isPreviewCanvas) {
      this.subscriptions.push(
        this.stateService.getAnimationFractionChangedSubscription(
          animationFraction => {
            console.log('re-drawing preview canvas: ' + animationFraction);
            this.drawCanvas();
          }));
      this.vectorLayer = this.stateService.previewVectorLayer;
    } else if (this.isStartCanvas) {
      this.vectorLayer = this.stateService.startVectorLayer;
    } else if (this.isEndCanvas) {
      this.vectorLayer = this.stateService.endVectorLayer;
    }
    console.log(this.vectorLayer);

    this.canvas = $(this.canvasRef.nativeElement);
    this.drawCanvas();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private resizeAndDrawCanvas(size) {
    const containerWidth = size;
    const containerHeight = size;
    const containerAspectRatio = containerWidth / containerHeight;
    const artworkAspectRatio = this.vectorLayer.width / (this.vectorLayer.height || 1);

    if (artworkAspectRatio > containerAspectRatio) {
      this.scale_ = containerWidth / this.vectorLayer.width;
    } else {
      this.scale_ = containerHeight / this.vectorLayer.height;
    }
    this.scale_ = Math.max(1, Math.floor(this.scale_));

    // TODO(alockwood): figure out how to inject window device pixel ratio below
    this.backingStoreScale_ = this.scale_ * (window.devicePixelRatio || 1);

    this.canvas
      .attr({
        width: this.vectorLayer.width * this.backingStoreScale_,
        height: this.vectorLayer.height * this.backingStoreScale_,
      })
      .css({
        width: this.vectorLayer.width * this.scale_,
        height: this.vectorLayer.height * this.scale_,
      });

    this.drawCanvas();
  }

  private drawCanvas() {
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

  private drawClipPathLayer(layer: ClipPathLayer, ctx: CanvasRenderingContext2D, transforms: (() => void)[]) {
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
}

type TransformFn = () => void;
