import { Animation } from '../scripts/animations';
import { Dragger } from '../scripts/dragger';
import { TIMELINE_ANIMATION_PADDING } from './constants';
import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import * as $ from 'jquery';
import * as _ from 'lodash';

const GRID_INTERVALS_MS = [
  10, 25, 50, 100, 250, 500,
  1000, 2500, 5000, 10000, 30000, 60000,
];

@Directive({
  selector: '[appLayerTimeline]',
})
export class LayerTimelineDirective {

  @Input() isHeader: boolean | undefined;
  private animation_: Animation;
  @Input() isActive: boolean;
  private activeTime_: number;
  private horizZoom_: number;
  @Output() onScrub = new EventEmitter<ScrubEvent>();

  private readonly canvas: HTMLCanvasElement;
  private readonly $canvas: JQuery;

  constructor(readonly elementRef: ElementRef) {
    this.canvas = elementRef.nativeElement;
    this.$canvas = $(this.canvas);
  }

  get horizZoom() {
    return this.horizZoom_;
  }

  @Input()
  set horizZoom(horizZoom: number) {
    if (this.horizZoom_ !== horizZoom) {
      this.horizZoom_ = horizZoom;
      this.redraw();
    }
  }

  get activeTime() {
    return this.activeTime_;
  }

  set activeTime(activeTime: number) {
    if (this.activeTime_ !== activeTime) {
      this.activeTime_ = activeTime;
      this.redraw();
    }
  }

  get animation() {
    return this.animation_;
  }

  @Input()
  set animation(animation: Animation) {
    this.animation_ = animation;
    this.redraw();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.handleScrubEvent(event);
    // tslint:disable-next-line
    new Dragger({
      direction: 'horizontal',
      downX: event.clientX,
      downY: event.clientY,
      shouldSkipSlopCheck: true,
      onDragFn: evt => this.handleScrubEvent(evt),
    });
    event.preventDefault();
    return false;
  }

  private handleScrubEvent(event: { clientX: number, altKey: boolean }) {
    let x = event.clientX;
    x -= this.$canvas.offset().left;
    let time = (x - TIMELINE_ANIMATION_PADDING)
      / (this.$canvas.width() - TIMELINE_ANIMATION_PADDING * 2)
      * this.animation.duration;
    time = _.clamp(time, 0, this.animation.duration);
    this.onScrub.emit({
      animation: this.animation,
      time,
      // TODO: make the use of alt/ctrl/meta key consistent across entire app
      disableSnap: !!event.altKey,
    });
  }

  private redraw() {
    if (!this.$canvas.is(':visible')) {
      return;
    }

    const width = this.$canvas.width();
    const height = this.$canvas.height();
    this.$canvas.attr('width', width * window.devicePixelRatio);
    this.$canvas.attr('height', this.isHeader ? height * window.devicePixelRatio : 1);

    const ctx = this.canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.translate(TIMELINE_ANIMATION_PADDING, 0);

    // Compute grid spacing (40 = minimum grid spacing in pixels).
    let interval = 0;
    let spacingMs = GRID_INTERVALS_MS[interval];
    while ((spacingMs * this.horizZoom) < 40 || interval >= GRID_INTERVALS_MS.length) {
      interval++;
      spacingMs = GRID_INTERVALS_MS[interval];
    }

    const spacingPx = spacingMs * this.horizZoom;

    if (this.isHeader) {
      // Text labels.
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
        ctx.arc(this.activeTime * this.horizZoom, height / 2, 4, 0, 2 * Math.PI, false);
        ctx.fill();
        ctx.closePath();
        ctx.fillRect(this.activeTime * this.horizZoom - 1, height / 2 + 4, 2, height);
      }
    } else {
      // Grid lines.
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for (let x = spacingPx;
        x < width - TIMELINE_ANIMATION_PADDING * 2;
        x += spacingPx) {
        ctx.fillRect(x - 0.5, 0, 1, 1);
      }
      if (this.isActive) {
        ctx.fillStyle = 'rgba(244, 67, 54, .7)';
        ctx.fillRect(this.activeTime * this.horizZoom - 1, 0, 2, 1);
      }
    }
  }
}

export interface ScrubEvent {
  animation: Animation;
  time: number;
  disableSnap: boolean;
}
