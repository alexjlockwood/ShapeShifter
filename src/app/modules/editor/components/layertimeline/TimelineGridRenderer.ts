import { Animation } from 'app/modules/editor/model/timeline';
import { getContentSize, getContext2d, isVisible } from 'app/modules/editor/scripts/dom';
import { Dragger } from 'app/modules/editor/scripts/dragger';
import { ShortcutService, ThemeService } from 'app/modules/editor/services';
import _ from 'lodash';

import { TIMELINE_ANIMATION_PADDING } from './constants';

const HEADER_HEIGHT = 40;
// Browsers fail to draw canvases that are larger than this (and Firefox throws).
const MAX_CANVAS_SIZE = 16384;
const GRID_INTERVALS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];

/**
 * Draws the timeline's time labels (for the header) or grid lines, along with the current time.
 */
export class TimelineGridRenderer {
  // TimelineGrid sets the animation and zoom right after it creates the renderer.
  private animation_: Animation | undefined;
  private currentTime_ = 0;
  private horizZoom_: number | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly isHeader: boolean,
    private readonly themeService: ThemeService,
  ) {}

  get horizZoom(): number | undefined {
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

  get animation(): Animation | undefined {
    return this.animation_;
  }

  set animation(animation: Animation) {
    this.animation_ = animation;
    this.redraw();
  }

  /** Starts scrubbing through the animation, reporting the time as the mouse moves. */
  startScrubbing(event: MouseEvent, onScrub: (event: ScrubEvent) => void) {
    const scrubFn = (e: MouseEvent) => {
      const { animation } = this;
      if (animation) {
        onScrub(
          this.getScrubEvent(animation, e.clientX, ShortcutService.isOsDependentModifierKey(e)),
        );
      }
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

  private getScrubEvent(animation: Animation, clientX: number, disableSnap: boolean): ScrubEvent {
    const x = clientX - this.canvas.getBoundingClientRect().left;
    let time =
      ((x - TIMELINE_ANIMATION_PADDING) /
        (getContentSize(this.canvas, 'width') - TIMELINE_ANIMATION_PADDING * 2)) *
      animation.duration;
    time = _.clamp(time, 0, animation.duration);
    return { time, disableSnap };
  }

  redraw() {
    const { horizZoom } = this;
    // The zoom is negative if the timeline is too narrow to fit its padding.
    if (!this.animation || horizZoom === undefined || horizZoom <= 0 || !isVisible(this.canvas)) {
      return;
    }

    const width = getContentSize(this.canvas, 'width');
    const height = getContentSize(this.canvas, 'height');
    // Zooming in on a long animation can make the canvas too big to draw at full resolution.
    const scale = Math.min(
      window.devicePixelRatio,
      MAX_CANVAS_SIZE / width,
      MAX_CANVAS_SIZE / height,
    );
    this.canvas.setAttribute('width', `${width * scale}`);
    this.canvas.setAttribute('height', `${height * scale}`);

    const ctx = getContext2d(this.canvas);
    ctx.scale(scale, scale);
    ctx.translate(TIMELINE_ANIMATION_PADDING, 0);

    const spacingMs = getGridSpacingMs(horizZoom);
    const spacingPx = spacingMs * horizZoom;

    if (this.isHeader) {
      // Text labels.
      ctx.fillStyle = this.themeService.getSecondaryTextColor();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '10px Roboto';
      // Bounded by time, since the layout rounds the canvas's width.
      for (let x = 0, t = 0; t <= this.animation.duration; x += spacingPx, t += spacingMs) {
        ctx.fillText(`${t / 1000}s`, x, height / 2);
      }
      ctx.fillStyle = 'rgba(244, 67, 54, .7)';
      ctx.beginPath();
      ctx.arc(this.currentTime * horizZoom, height / 2, 4, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.closePath();
      ctx.fillRect(this.currentTime * horizZoom - 1, height / 2 + 4, 2, height);
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
      ctx.fillRect(this.currentTime * horizZoom - 1, HEADER_HEIGHT, 2, height - HEADER_HEIGHT);
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

/**
 * Returns the smallest grid interval that's at least 40 pixels wide at the specified zoom, or the
 * largest interval if none of them are.
 */
export function getGridSpacingMs(horizZoom: number) {
  const spacingMs = GRID_INTERVALS_MS.find(ms => ms * horizZoom >= 40);
  return spacingMs ?? GRID_INTERVALS_MS[GRID_INTERVALS_MS.length - 1];
}
