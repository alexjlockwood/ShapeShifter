import {
  Component, OnInit, Input, ViewChild,
  ElementRef, AfterViewInit
} from '@angular/core';
import * as $ from 'jquery';


const EXTRA_PADDING = 12;
const GRID_INTERVALS_PX = [1, 2, 4, 8, 16, 24, 48, 100, 100, 250];
const LABEL_OFFSET = 12;
const TICK_SIZE = 6;


@Component({
  selector: 'app-canvas-ruler',
  templateUrl: './ruler.component.html',
  styleUrls: ['./ruler.component.scss']
})
export class RulerComponent implements AfterViewInit {
  @ViewChild('canvasRuler') private canvasRef: ElementRef;
  private canvas;
  private mouseX = -1;
  private mouseY = -1;
  private vectorLayerWidth = 0;
  private vectorLayerHeight = 0;
  @Input() private isHorizontal = false;

  constructor() { }

  ngAfterViewInit() {
    this.canvas = $(this.canvasRef.nativeElement);
  }

  showMouse(x: number, y: number) {
    console.log(x, y);
    this.mouseX = x;
    this.mouseY = y;
    this.draw();
  }

  hideMouse() {
    this.mouseX = -1;
    this.mouseY = -1;
    this.draw();
  }

  setVectorLayerSize(width: number, height: number) {
    console.log(width, height);
    this.vectorLayerWidth = width;
    this.vectorLayerHeight = height;
    this.draw();
  }

  draw() {
    const width = this.canvas.width();
    const height = this.canvas.height();
    const devicePixelRatio = (window && window.devicePixelRatio) || 1;
    this.canvas.attr('width', width * devicePixelRatio);
    this.canvas.attr('height', height * devicePixelRatio);

    const ctx = this.canvas.get(0).getContext('2d');
    console.log(this.isHorizontal);
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.translate(
      this.isHorizontal ? EXTRA_PADDING : 0,
      this.isHorizontal ? 0 : EXTRA_PADDING);

    const zoom = Math.max(1, this.isHorizontal
      ? (width - EXTRA_PADDING * 2) / this.vectorLayerWidth
      : (height - EXTRA_PADDING * 2) / this.vectorLayerHeight);

    // compute grid spacing (40 = minimum grid spacing in pixels)
    let interval = 0;
    let spacingArtPx = GRID_INTERVALS_PX[interval];
    while ((spacingArtPx * zoom) < 40 || interval >= GRID_INTERVALS_PX.length) {
      interval++;
      spacingArtPx = GRID_INTERVALS_PX[interval];
    }

    const spacingRulerPx = spacingArtPx * zoom;

    // text labels
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '10px Roboto';
    if (this.isHorizontal) {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      for (let x = 0, t = 0;
        x <= (width - EXTRA_PADDING * 2);
        x += spacingRulerPx, t += spacingArtPx) {
        ctx.fillText(t, x, height - LABEL_OFFSET);
        ctx.fillRect(x - 0.5, height - TICK_SIZE, 1, TICK_SIZE);
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (let y = 0, t = 0;
        y <= (height - EXTRA_PADDING * 2);
        y += spacingRulerPx, t += spacingArtPx) {
        ctx.fillText(t, width - LABEL_OFFSET, y);
        ctx.fillRect(width - TICK_SIZE, y - 0.5, TICK_SIZE, 1);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,.7)';
    if (this.isHorizontal && this.mouseX >= 0) {
      ctx.fillText(this.mouseX, this.mouseX * zoom, height - LABEL_OFFSET);
    } else if (!this.isHorizontal && this.mouseY >= 0) {
      ctx.fillText(this.mouseY, width - LABEL_OFFSET, this.mouseY * zoom);
    }
  }
}

