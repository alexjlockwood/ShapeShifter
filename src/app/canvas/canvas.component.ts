import { Component, AfterViewInit, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Layer, PathLayer, ClipPathLayer, GroupLayer, VectorLayer } from './../scripts/models';
import * as Svgloader from './../scripts/svgloader';
import * as ColorUtil from './../scripts/colorutil';
import * as jQuery from 'jquery';


@Component({
  selector: 'app-canvas',
  template: `
    <div #container (window:resize)="onResize(container.getBoundingClientRect())" height="100px">
      <div class="canvas-container" height="100px">
        <canvas #canvas class="rendering-canvas" height="100px"></canvas>
      </div>
    </div>`,
  styleUrls: ['./canvas.component.scss']
})
export class CanvasComponent implements AfterViewInit {
  @ViewChild('canvas') private canvasRef: ElementRef;
  private canvas: any;
  //private offscreenCanvas: any;
  private vectorLayer: VectorLayer;
  private scale_: number;
  private backingStoreScale_: number;

  constructor() { }

  ngAfterViewInit() {
    this.canvas = jQuery(this.canvasRef.nativeElement);
    //this.offscreenCanvas = jQuery(this.canvasRef.nativeElement); // TODO(alockwood): create a new canvas!
    // this.canvas.width = this.width;
    // this.canvas.height = this.height;

    let svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
        <path d="M 0 0 L 600 600" stroke="red" stroke-width="20" />
      </svg>`;
    this.vectorLayer = Svgloader.loadVectorLayerFromSvgString(svgString);
    this.resizeAndDrawCanvas(this.vectorLayer.width, this.vectorLayer.height);
    this.drawCanvas();
  }

  onResize(event) {
    console.log("resize", event.width, event.height);
    this.resizeAndDrawCanvas(event.width, event.height);
  }

  resizeAndDrawCanvas(width, height) {
    const canvasMargin = 72; // pixels

    let containerWidth = Math.max(1, width - canvasMargin * 2);
    let containerHeight = Math.max(1, height - canvasMargin * 2);
    let containerAspectRatio = containerWidth / containerHeight;
    let layerAspectRatio = this.vectorLayer.width / (this.vectorLayer.height || 1);
    if (layerAspectRatio > containerAspectRatio) {
      this.scale_ = containerWidth / this.vectorLayer.width;
    } else {
      this.scale_ = containerHeight / this.vectorLayer.height;
    }

    // TODO(alockwood): figure out how to inject window device pixel ratio below
    this.scale_ = Math.max(1, Math.floor(this.scale_));
    this.backingStoreScale_ = this.scale_ * (window.devicePixelRatio || 1);
    [this.canvas].forEach(canvas => {
      canvas
        .attr({
          width: this.vectorLayer.width * this.backingStoreScale_,
          height: this.vectorLayer.height * this.backingStoreScale_,
        })
        .css({
          width: this.vectorLayer.width * this.scale_,
          height: this.vectorLayer.height * this.scale_,
        });
    });

    console.log(this.vectorLayer.width, this.vectorLayer.height);
    console.log(this.scale_);
    console.log(this.backingStoreScale_);

    this.drawCanvas();
  }

  drawCanvas() {
    const ctx = this.canvas.get(0).getContext('2d');

    ctx.save();
    ctx.scale(this.backingStoreScale_, this.backingStoreScale_);
    ctx.clearRect(0, 0, this.vectorLayer.width, this.vectorLayer.height);
    let transforms = [];
    let drawLayer_ = (ctx, layer: Layer) => {
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
      } else if (layer instanceof ClipPathLayer) {
        ctx.save();
        transforms.forEach(t => t());
        layer.pathData && layer.pathData.execute(ctx);
        ctx.restore();
        // clip further layers
        ctx.clip();
      } else if (layer instanceof PathLayer) {
        ctx.save();
        transforms.forEach(t => t());
        layer.pathData && layer.pathData.execute(ctx);
        ctx.restore();
        // draw the actual layer
        ctx.strokeStyle = ColorUtil.androidToCssColor(layer.strokeColor, layer.strokeAlpha);
        ctx.lineWidth = layer.strokeWidth;
        ctx.fillStyle = ColorUtil.androidToCssColor(layer.fillColor, layer.fillAlpha);
        ctx.lineCap = layer.strokeLinecap || 'butt';
        ctx.lineJoin = layer.strokeLinejoin || 'miter';
        ctx.miterLimit = layer.strokeMiterLimit || 4;
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
            shownFraction * layer.pathData.length,
            (1 - shownFraction + 0.001) * layer.pathData.length
          ]);
          // The amount to offset the path is equal to the trimPathStart plus
          // trimPathOffset. We mod the result because the trimmed path
          // should wrap around once it reaches 1.
          ctx.lineDashOffset = layer.pathData.length
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
      } else if (layer instanceof VectorLayer) {
        layer.children.forEach(layer => drawLayer_(ctx, layer));
      }
    };
    // draw artwork
    //let offscreenCtx = this.offscreenCanvas_.get(0).getContext('2d');
    //let currentArtwork;
    //if (this.studioState_.animationRenderer) {
    //   this.studioState_.animationRenderer.setAnimationTime(this.animTime || 0);
    //   currentArtwork = this.studioState_.animationRenderer.renderedArtwork;
    //} else {
    //   currentArtwork = this.artwork;
    //}
    //let currentAlpha = currentArtwork.alpha;
    //if (currentAlpha != 1) {
    //   offscreenCtx.save();
    //   offscreenCtx.scale(this.backingStoreScale_, this.backingStoreScale_);
    //   offscreenCtx.clearRect(0, 0, currentArtwork.width, currentArtwork.height);
    //}
    //let artworkCtx = currentAlpha == 1 ? ctx : offscreenCtx;
    drawLayer_(ctx, this.vectorLayer);
    //if (currentArtwork.alpha != 1) {
    //   let oldGlobalAlpha = ctx.globalAlpha;
    //   ctx.globalAlpha = currentAlpha;
    //   ctx.scale(1 / this.backingStoreScale_, 1 / this.backingStoreScale_);
    //   ctx.drawImage(offscreenCtx.canvas, 0, 0);
    //   ctx.scale(this.backingStoreScale_, this.backingStoreScale_);
    //   ctx.globalAlpha = oldGlobalAlpha;
    //   offscreenCtx.restore();
    //}
    ctx.restore();
    // draw pixel grid
    // if (!this.isPreviewMode && this.scale_ > 4) {
    //    ctx.fillStyle = 'rgba(128, 128, 128, .25)';
    //    for (let x = 1; x < this.artwork.width; ++x) {
    //       ctx.fillRect(
    //          x * this.backingStoreScale_ - 0.5 * (window.devicePixelRatio || 1),
    //          0,
    //          1 * (window.devicePixelRatio || 1),
    //          this.artwork.height * this.backingStoreScale_);
    //    }
    //    for (let y = 1; y < this.artwork.height; ++y) {
    //       ctx.fillRect(
    //          0,
    //          y * this.backingStoreScale_ - 0.5 * (window.devicePixelRatio || 1),
    //          this.artwork.width * this.backingStoreScale_,
    //          1 * (window.devicePixelRatio || 1));
    //    }
    // }
    // if (this.studioState_.playing) {
    //    this.animationFrameRequest_ = window.requestAnimationFrame(() => {
    //       this.animTime = ((Number(new Date()) - this.animStart) * this.studioState_.playbackSpeed)
    //          % this.animation.duration;
    //       this.scope_.$apply(() => this.studioState_.activeTime = this.animTime);
    //       this.drawCanvas_();
    //    });
    // }
  }
}
