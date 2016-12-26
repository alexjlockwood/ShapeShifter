import { Component, AfterViewInit, ElementRef, HostListener, ViewChild, OnDestroy, Input } from '@angular/core';
import { Layer, PathLayer, ClipPathLayer, GroupLayer, VectorLayer } from './../scripts/models';
import * as Svgloader from './../scripts/svgloader';
import * as ColorUtil from './../scripts/colorutil';
import * as $ from 'jquery';
import { StateService } from '../state.service';
import { Subscription } from 'rxjs/Subscription';


// TODO(alockwood): add offscreen canvas to implement alpha
// TODO(alockwood): adjust scale depending on window.devicePixelRatio
// TODO(alockwood): adjust the canvas size properly on initial page load
@Component({
  selector: 'app-canvas',
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer')
  private canvasContainerRef: ElementRef;
  @ViewChild('renderingCanvas')
  private canvasRef: ElementRef;
  private canvas: any;
  private vectorLayer: VectorLayer;
  private scale_: number;
  private backingStoreScale_: number;
  @Input() private isStartCanvas: boolean;
  @Input() private isPreviewCanvas: boolean;
  @Input() private isEndCanvas: boolean;
  //private offscreenCanvas: any;

  private subscription: Subscription;

  constructor(private stateService: StateService) { }

  ngAfterViewInit() {
    if (this.isPreviewCanvas) {
      this.subscription = this.stateService.timelineChangedSource.subscribe(
        animationFraction => {
          animationFraction /= 1000;
          console.log('re-drawing preview canvas: ' + animationFraction);
          this.drawCanvas();
        });
      this.vectorLayer = this.stateService.previewVectorLayer;
    } else if (this.isStartCanvas) {
      this.vectorLayer = this.stateService.startVectorLayer;
    } else if (this.isEndCanvas) {
      this.vectorLayer = this.stateService.endVectorLayer;
    }
    console.log(this.vectorLayer);

    this.canvas = $(this.canvasRef.nativeElement);
    // TODO(alockwood): adjust the canvas size properly on initial page load
    this.resizeAndDrawCanvas(300);
    this.drawCanvas();
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onResize(event) {
    console.log("resize", event, event.width, event.width);
    this.resizeAndDrawCanvas(event.width);
  }

  resizeAndDrawCanvas(size) {
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

  drawCanvas() {
    const transforms = [];
    const drawLayer_ = (ctx: CanvasRenderingContext2D, layer: Layer) => {
      if (layer instanceof VectorLayer) {
        layer.children.forEach(layer => drawLayer_(ctx, layer));
        return;
      }

      if (layer instanceof GroupLayer) {
        transforms.push(() => {
          ctx.translate(layer.pivotX, layer.pivotY);
          ctx.translate(layer.translateX, layer.translateY);
          ctx.rotate(layer.rotation * Math.PI / 180);
          ctx.scale(layer.scaleX, layer.scaleY);
          ctx.translate(-layer.pivotX, -layer.pivotY);
        });
        ctx.save();
        layer.children.forEach(layer => drawLayer_(ctx, layer));
        ctx.restore();
        transforms.pop();
        return;
      }

      if (layer instanceof ClipPathLayer) {
        ctx.save();
        transforms.forEach(t => t());
        layer.pathData.execute(ctx);
        ctx.restore();

        // clip further layers
        ctx.clip();
        return;
      }

      if (layer instanceof PathLayer) {
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
        return;
      }
    };

    const ctx = this.canvas.get(0).getContext('2d');
    ctx.save();
    ctx.scale(this.backingStoreScale_, this.backingStoreScale_);
    ctx.clearRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);
    drawLayer_(ctx, this.vectorLayer);
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
}
