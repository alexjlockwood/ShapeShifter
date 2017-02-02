import {
  Directive, OnInit, ViewChild, Input,
  ElementRef, OnDestroy
} from '@angular/core';
import { EditorType } from '../EditorType';
import { LayerStateService } from '../services/layerstate.service';
import { CanvasResizeService } from '../services/canvasresize.service';
import { Point } from '../scripts/common';
import * as $ from 'jquery';
import { Subscription } from 'rxjs/Subscription';
import { VectorLayer } from '../scripts/layers';

const CANVAS_MARGIN = 36;
const RULER_SIZE = 32;
const EXTRA_PADDING = 12;
const GRID_INTERVALS_PX = [1, 2, 4, 8, 16, 24, 48, 100, 100, 250];
const LABEL_OFFSET = 12;
const TICK_SIZE = 6;

@Directive({
  selector: '[appCanvasRuler]',
})
export class CanvasRulerDirective implements OnInit, OnDestroy {
  @Input() editorType: EditorType;
  @Input() orientation: Orientation;
  private canvas: JQuery;
  private mousePoint: Point;
  private readonly subscriptions: Subscription[] = [];
  private vlWidth = 0;
  private vlHeight = 0;
  private width = 0;
  private height = 0;

  constructor(
    private elementRef: ElementRef,
    private canvasResizeService: CanvasResizeService,
    private layerStateService: LayerStateService) { }

  ngOnInit() {
    this.canvas = $(this.elementRef.nativeElement);
    this.subscriptions.push(
      this.layerStateService.addListener(
        this.editorType, vl => {
          if (!vl) {
            return;
          }
          const newWidth = vl.width;
          const newHeight = vl.height;
          const didSizeChange =
            this.vlWidth !== newWidth || this.vlHeight !== newHeight;
          if (didSizeChange) {
            this.vlWidth = newWidth;
            this.vlHeight = newHeight;
            this.draw();
          }
        }));
    this.subscriptions.push(
      this.canvasResizeService.addListener(size => {
        const newWidth = size.width;
        const newHeight = size.height;
        const didSizeChange =
          this.width !== newWidth || this.height !== newHeight;
        if (didSizeChange) {
          this.width = newWidth;
          this.height = newHeight;
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
    this.mousePoint = mousePoint;
    this.draw();
  }

  draw() {
    const isHorizontal = this.orientation === 'horizontal';
    const width = this.canvas.width();
    const height = this.canvas.height();
    this.canvas.attr('width', width * window.devicePixelRatio);
    this.canvas.attr('height', height * window.devicePixelRatio);

    const ctx =
      (this.canvas.get(0) as HTMLCanvasElement).getContext('2d');
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
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '10px Roboto';
    if (isHorizontal) {
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      for (let x = 0, t = 0;
        x <= (width - EXTRA_PADDING * 2);
        x += spacingRulerPx, t += spacingArtPx) {
        ctx.fillText(t.toString(), x, height - LABEL_OFFSET);
        ctx.fillRect(x - 0.5, height - TICK_SIZE, 1, TICK_SIZE);
      }
    } else {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (let y = 0, t = 0;
        y <= (height - EXTRA_PADDING * 2);
        y += spacingRulerPx, t += spacingArtPx) {
        ctx.fillText(t.toString(), width - LABEL_OFFSET, y);
        ctx.fillRect(width - TICK_SIZE, y - 0.5, TICK_SIZE, 1);
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,.7)';
    const mouseX = this.mousePoint ? this.mousePoint.x : -1;
    const mouseY = this.mousePoint ? this.mousePoint.y : -1;
    if (isHorizontal && mouseX >= 0) {
      ctx.fillText(mouseX.toString(), mouseX * zoom, height - LABEL_OFFSET);
    } else if (!isHorizontal && mouseY >= 0) {
      ctx.fillText(mouseY.toString(), width - LABEL_OFFSET, mouseY * zoom);
    }
  }
}

export type Orientation = 'horizontal' | 'vertical';
