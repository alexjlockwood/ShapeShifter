import { SetIsPlaying, State, Store } from '../store';

const REPEAT_DELAY = 750;
const DEFAULT_IS_SLOW_MOTION = false;
const DEFAULT_PLAYBACK_SPEED = 1;
const SLOW_MOTION_PLAYBACK_SPEED = 5;

export class Animator {
  private timeoutId: number;
  private animationFrameId: number;
  private playbackSpeed = DEFAULT_IS_SLOW_MOTION ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  private isRepeating = false;
  private currentAnimatedFraction = 0;
  private shouldPlayInReverse = false;

  constructor(private readonly callback: Callback) { }

  setIsRepeating(isRepeating: boolean) {
    this.isRepeating = isRepeating;
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.playbackSpeed = isSlowMotion ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  }

  play(duration: number, onUpdateFn: (fraction: number) => void) {
    this.startAnimation(duration, onUpdateFn);
    this.callback.setIsPlaying(true);
  }

  pause() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
    this.callback.setIsPlaying(false);
  }

  rewind() {
    this.pause();
    this.shouldPlayInReverse = false;
    this.currentAnimatedFraction = 0;
  }

  fastForward() {
    this.pause();
    this.shouldPlayInReverse = true;
    this.currentAnimatedFraction = 1;
  }

  private startAnimation(duration: number, onUpdateFn: (fraction: number) => void) {
    let startTimestamp: number = undefined;
    const playbackSpeed = this.playbackSpeed;
    const onAnimationFrameFn = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp;
      if (progress < (duration * playbackSpeed)) {
        this.animationFrameId = requestAnimationFrame(onAnimationFrameFn);
      } else {
        this.shouldPlayInReverse = !this.shouldPlayInReverse;
        if (this.isRepeating) {
          this.timeoutId = window.setTimeout(() => {
            this.startAnimation(duration, onUpdateFn);
          }, REPEAT_DELAY);
        } else {
          this.pause();
        }
      }
      const fraction = Math.min(1, progress / (duration * playbackSpeed));
      onUpdateFn(fraction);
    };
    this.callback.runOutsideAngular(() => {
      this.animationFrameId = requestAnimationFrame(onAnimationFrameFn);
    });
  }
}

export interface Callback {
  readonly setIsPlaying: (isPlaying: boolean) => void;
  readonly runOutsideAngular: (fn: () => void) => void;
}
