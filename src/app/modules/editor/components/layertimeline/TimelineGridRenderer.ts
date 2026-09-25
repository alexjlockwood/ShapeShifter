import { Animation } from 'app/modules/editor/model/timeline';
import { getContentSize, isVisible } from 'app/modules/editor/scripts/dom';
import { Dragger } from 'app/modules/editor/scripts/dragger';
import { ShortcutService, ThemeService } from 'app/modules/editor/services';
import _ from 'lodash';

import { TIMELINE_ANIMATION_PADDING } from './constants';

const HEADER_HEIGHT = 40;
const GRID_INTERVALS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];

/**
 * Draws the timeline's time labels (for the header) or grid lines, along with the current time.
 */
export class TimelineGridRenderer {
  private animation_: Animation;
  private currentTime_: number;
  private horizZoom_: number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly isHeader: boolean,
    private readonly themeService: ThemeService,
  ) {}

  get horizZoom() {
    return this.horizZoom_;
  }

  set horizZoom(horizZoom: number) {
    if (this.horizZoom_ !== horizZoom) {
      this.horizZoom_ = horizZoom;
      this.redraw();
    }
  }

  get currentTime() {
    return this.currentTime_;
  }

  set currentTime(currentTime: number) {
    if (this.currentTime_ !== currentTime) {
      this.currentTime_ = currentTime;
      this.redraw();
    }
  }

  get animation() {
    return this.animation_;
  }

  set animation(animation: Animation) {
    this.animation_ = animation;
    this.redraw();
  }

  /** Starts scrubbing through the animation, reporting the time as the mouse moves. */
  startScrubbing(event: MouseEvent, onScrub: (event: ScrubEvent) => void) {
    const scrubFn = (e: MouseEvent) => {
      onScrub(this.getScrubEvent(e.clientX, ShortcutService.isOsDependentModifierKey(e)));
    };
    scrubFn(event);
    new Dragger({
      direction: 'horizontal',
      downX: event.clientX,
      downY: event.clientY,
      shouldSkipSlopCheck: true,
      onDragFn: scrubFn,
    });
  }

  private getScrubEvent(clientX: number, disableSnap: boolean): ScrubEvent {
    const x = clientX - this.canvas.getBoundingClientRect().left;
    let time =
      ((x - TIMELINE_ANIMATION_PADDING) /
        (getContentSize(this.canvas, 'width') - TIMELINE_ANIMATION_PADDING * 2)) *
      this.animation.duration;
    time = _.clamp(time, 0, this.animation.duration);
    return { time, disableSnap };
  }

  redraw() {
    if (!this.animation || !isVisible(this.canvas)) {
      return;
    }

    const width = getContentSize(this.canvas, 'width');
    const height = getContentSize(this.canvas, 'height');
    this.canvas.setAttribute('width', `${width * window.devicePixelRatio}`);
    this.canvas.setAttribute('height', `${height * window.devicePixelRatio}`);

    const ctx = this.canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.translate(TIMELINE_ANIMATION_PADDING, 0);

    // Compute grid spacing (40 = minimum grid spacing in pixels).
    let interval = 0;
    let spacingMs = GRID_INTERVALS_MS[interval];
    while (spacingMs * this.horizZoom < 40 || interval >= GRID_INTERVALS_MS.length) {
      interval++;
      spacingMs = GRID_INTERVALS_MS[interval];
    }

    const spacingPx = spacingMs * this.horizZoom;

    if (this.isHeader) {
      // Text labels.
      ctx.fillStyle = this.themeService.getSecondaryTextColor();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '10px Roboto';
      for (let x = 0, t = 0; round(x) <= round(width); x += spacingPx, t += spacingMs) {
        ctx.fillText(`${t / 1000}s`, x, height / 2);
      }
      ctx.fillStyle = 'rgba(244, 67, 54, .7)';
      ctx.beginPath();
      ctx.arc(this.currentTime * this.horizZoom, height / 2, 4, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.closePath();
      ctx.fillRect(this.currentTime * this.horizZoom - 1, height / 2 + 4, 2, height);
    } else {
      // Grid lines.
      ctx.fillStyle = this.themeService.getDividerTextColor();
      for (
        let x = spacingPx;
        round(x) < round(width - TIMELINE_ANIMATION_PADDING * 2);
        x += spacingPx
      ) {
        ctx.fillRect(x - 0.5, HEADER_HEIGHT, 1, height - HEADER_HEIGHT);
      }
      ctx.fillStyle = 'rgba(244, 67, 54, .7)';
      ctx.fillRect(this.currentTime * this.horizZoom - 1, HEADER_HEIGHT, 2, height - HEADER_HEIGHT);
    }
  }
}

function round(n: number) {
  return _.round(n, 8);
}

export interface ScrubEvent {
  time: number;
  disableSnap: boolean;
}
