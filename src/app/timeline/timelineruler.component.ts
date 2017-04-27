import {
  Component, OnInit, ElementRef,
  HostListener, ChangeDetectionStrategy, ViewChild,
} from '@angular/core';
import * as $ from 'jquery';

const GRID_INTERVALS_MS = [
  10, 25, 50, 100, 250, 500,
  1000, 2500, 5000, 10000, 30000, 60000,
];

const TIMELINE_ANIMATION_PADDING = 20;

@Component({
  selector: 'app-timelineruler',
  templateUrl: './timelineruler.component.html',
  styleUrls: ['./timelineruler.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineRulerComponent implements OnInit {
  @ViewChild('timelineRuler') private canvasRef: ElementRef;

  // TODO: figure out what to do with these
  private isActive = true;
  private isHeader = true;
  private horizZoom = 1;
  private canvas: JQuery;
  private activeTime = 0;

  ngOnInit() {
    this.canvas = $(this.canvasRef.nativeElement);
    this.redraw();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.handleScrubEvent(event);
    // new DragHelper({
    //   downEvent: event,
    //   direction: 'horizontal',
    //   skipSlopCheck: true,
    //   onDrag: event => scope.$apply(() => handleScrubEvent_(event)),
    // });
    event.preventDefault();
    return false;
  }

  private handleScrubEvent(event: MouseEvent) {
    // let x = event.clientX;
    // x -= $canvas.offset().left;
    // let time = (x - TimelineConsts.TIMELINE_ANIMATION_PADDING)
    //   / ($canvas.width() - TimelineConsts.TIMELINE_ANIMATION_PADDING * 2)
    //   * scope.animation.duration;
    // time = MathUtil.constrain(time, 0, scope.animation.duration);
    // scope.onScrub({
    //   animation: scope.animation,
    //   time,
    //   options: { disableSnap: !!event.altKey }
    // });
  }

  private redraw() {
    if (!this.canvas.is(':visible')) {
      return;
    }

    const width = this.canvas.width();
    const height = this.canvas.height();
    const horizZoom = this.horizZoom;
    this.canvas.attr('width', width * window.devicePixelRatio);
    this.canvas.attr('height', this.isHeader ? height * window.devicePixelRatio : 1);

    const ctx = (this.canvas.get(0) as HTMLCanvasElement).getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.translate(TIMELINE_ANIMATION_PADDING, 0);

    // compute grid spacing (40 = minimum grid spacing in pixels)
    let interval = 0;
    let spacingMs = GRID_INTERVALS_MS[interval];
    while ((spacingMs * horizZoom) < 40 || interval >= GRID_INTERVALS_MS.length) {
      ++interval;
      spacingMs = GRID_INTERVALS_MS[interval];
    }

    const spacingPx = spacingMs * horizZoom;

    if (this.isHeader) {
      // text labels
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '10px Roboto';
      for (let x = 0, t = 0; x <= width; x += spacingPx, t += spacingMs) {
        ctx.fillText(`${t / 1000}s`, x, height / 2);
      }

      if (this.isActive) {
        ctx.fillStyle = 'rgba(244, 67, 54, .7)';
        ctx.beginPath();
        ctx.arc(this.activeTime * horizZoom, height / 2, 4, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.closePath();
        ctx.fillRect(this.activeTime * horizZoom - 1, height / 2 + 4, 2, height);
      }

    } else {
      // grid lines
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for (let x = spacingPx;
        x < width - TIMELINE_ANIMATION_PADDING * 2;
        x += spacingPx) {
        ctx.fillRect(x - 0.5, 0, 1, 1);
      }

      if (this.isActive) {
        ctx.fillStyle = 'rgba(244, 67, 54, .7)';
        ctx.fillRect(this.activeTime * horizZoom - 1, 0, 2, 1);
      }
    }
  }
}

