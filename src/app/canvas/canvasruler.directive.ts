import {
  Directive, OnInit, ViewChild, Input,
  ElementRef, OnDestroy
} from '@angular/core';
import { CanvasType } from '../CanvasType';
import { LayerStateService } from '../services/layerstate.service';
import { CanvasResizeService } from '../services/canvasresize.service';
import { Point } from '../scripts/common';
import * as $ from 'jquery';
import { Subscription } from 'rxjs/Subscription';
import { CANVAS_MARGIN, DEFAULT_VIEWPORT_SIZE } from './canvas.component';
import * as _ from 'lodash';

const RULER_SIZE = 32;
const EXTRA_PADDING = 12;
const GRID_INTERVALS_PX = [1, 2, 4, 8, 16, 24, 48, 100, 100, 250];
const LABEL_OFFSET = 12;
const TICK_SIZE = 6;

@Directive({
  selector: '[appCanvasRuler]',
})
export class CanvasRulerDirective implements OnInit, OnDestroy {
  @Input() canvasType: CanvasType;
  @Input() orientation: Orientation;
  private canvas: JQuery;
  private mousePoint: Point;
  private readonly subscriptions: Subscription[] = [];
  private vlWidth = DEFAULT_VIEWPORT_SIZE;
  private vlHeight = DEFAULT_VIEWPORT_SIZE;
  private componentWidth = 1;
  private componentHeight = 1;

  constructor(
    private elementRef: ElementRef,
    private canvasResizeService: CanvasResizeService,
    private layerStateService: LayerStateService) { }

  ngOnInit() {
    this.canvas = $(this.elementRef.nativeElement);
    this.subscriptions.push(
      this.layerStateService.getVectorLayerObservable(this.canvasType).subscribe(vl => {
        const newWidth = vl ? vl.width : DEFAULT_VIEWPORT_SIZE;
        const newHeight = vl ? vl.height : DEFAULT_VIEWPORT_SIZE;
        const didSizeChange =
          this.vlWidth !== newWidth || this.vlHeight !== newHeight;
        if (didSizeChange) {
          this.vlWidth = newWidth;
          this.vlHeight = newHeight;
          this.draw();
        }
      }));
    this.subscriptions.push(
      this.canvasResizeService.getCanvasResizeObservable().subscribe(size => {
        const oldWidth = this.componentWidth;
        const oldHeight = this.componentHeight;
        this.componentWidth = Math.max(1, size.width - CANVAS_MARGIN * 2);
        this.componentHeight = Math.max(1, size.height - CANVAS_MARGIN * 2);
        if (this.componentWidth !== oldWidth || this.componentHeight !== oldHeight) {
          this.draw();
        }
      }));
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  hideMouse() {
    if (this.mousePoint) {
      this.mousePoint = undefined;
      this.draw();
    }
  }

  showMouse(mousePoint: Point) {
    if (!this.mousePoint || !this.mousePoint.equals(mousePoint)) {
      this.mousePoint = mousePoint;
      this.draw();
    }
  }

  // TODO: ruler doesn't align right for 800x600 viewport in a small window
  draw() {
    const isHorizontal = this.orientation === 'horizontal';
    const vectorAspectRatio = this.vlWidth / this.vlHeight;

    // The 'cssScale' represents the number of CSS pixels per SVG viewport pixel.
    let cssScale;
    if (vectorAspectRatio > 1) {
      cssScale = this.componentWidth / this.vlWidth;
    } else {
      cssScale = this.componentHeight / this.vlHeight;
    }

    // The 'attrScale' represents the number of physical pixels per SVG viewport pixel.
    const attrScale = cssScale * devicePixelRatio;

    const cssWidth = this.vlWidth * cssScale;
    const cssHeight = this.vlHeight * cssScale;
    const width = isHorizontal ? cssWidth + EXTRA_PADDING * 2 : RULER_SIZE;
    const height = isHorizontal ? RULER_SIZE : cssHeight + EXTRA_PADDING * 2;
    this.canvas.attr('width', width * window.devicePixelRatio);
    this.canvas.attr('height', height * window.devicePixelRatio);

    const ctx = (this.canvas.get(0) as HTMLCanvasElement).getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.translate(
      isHorizontal ? EXTRA_PADDING : 0,
      isHorizontal ? 0 : EXTRA_PADDING);

    const zoom = Math.max(1, isHorizontal
      ? (width - EXTRA_PADDING * 2) / this.vlWidth
      : (height - EXTRA_PADDING * 2) / this.vlHeight);

    // Compute grid spacing (40 = minimum grid spacing in pixels).
    let interval = 0;
    let spacingArtPx = GRID_INTERVALS_PX[interval];
    while ((spacingArtPx * zoom) < 40 || interval >= GRID_INTERVALS_PX.length) {
      interval++;
      spacingArtPx = GRID_INTERVALS_PX[interval];
    }

    const spacingRulerPx = spacingArtPx * zoom;

    // Text labels.
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.font = '10px Roboto';
    if (isHorizontal) {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      for (let x = 0, t = 0;
        round(x) <= round(width - EXTRA_PADDING * 2);
        x += spacingRulerPx, t += spacingArtPx) {
        ctx.fillText(t.toString(), x, height - LABEL_OFFSET);
        ctx.fillRect(x - 0.5, height - TICK_SIZE, 1, TICK_SIZE);
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (let y = 0, t = 0;
        round(y) <= round(height - EXTRA_PADDING * 2);
        y += spacingRulerPx, t += spacingArtPx) {
        ctx.fillText(t.toString(), width - LABEL_OFFSET, y);
        ctx.fillRect(width - TICK_SIZE, y - 0.5, TICK_SIZE, 1);
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,.7)';
    const mouseX = this.mousePoint ? this.mousePoint.x : -1;
    const mouseY = this.mousePoint ? this.mousePoint.y : -1;
    if (isHorizontal && mouseX >= 0) {
      ctx.fillText(mouseX.toString(), mouseX * zoom, height - LABEL_OFFSET);
    } else if (!isHorizontal && mouseY >= 0) {
      ctx.fillText(mouseY.toString(), width - LABEL_OFFSET, mouseY * zoom);
    }
  }
}

function round(n: number) {
  return _.round(n, 8);
}

export type Orientation = 'horizontal' | 'vertical';
