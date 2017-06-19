import {
  Animator,
  Callback,
} from './Animator';
import {
  Injectable,
  NgZone,
} from '@angular/core';
import { AnimationRenderer } from 'app/scripts/animator';
import { VectorLayer } from 'app/scripts/model/layers';
import { Animation } from 'app/scripts/model/timeline';
import { PlaybackService } from 'app/services/playback/playback.service';
import {
  State,
  Store,
} from 'app/store';
import { getAnimatorState } from 'app/store/common/selectors';
import {
  getIsPlaying,
  getIsRepeating,
  getIsSlowMotion,
} from 'app/store/playback/selectors';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

const DEFAULT_ANIMATOR_EVENT = {
  vl: undefined as VectorLayer,
  currentTime: 0,
};

/**
 * Coordinates and stores information about the currently active animation.
 */
@Injectable()
export class AnimatorService {
  private readonly animatorSubject = new BehaviorSubject(DEFAULT_ANIMATOR_EVENT);
  private animator: Animator;
  private animationRenderer: AnimationRenderer;
  private activeAnimation: Animation;
  private readonly animatorCallback: Callback;

  constructor(
    private readonly ngZone: NgZone,
    private readonly store: Store<State>,
    private readonly playbackService: PlaybackService,
  ) {
    this.animatorCallback = {
      setIsPlaying: (isPlaying: boolean) => {
        this.playbackService.setIsPlaying(isPlaying);
      },
      runOutsideAngular: (fn: () => void) => this.ngZone.runOutsideAngular(fn),
    };
    this.animator = new Animator(this.animatorCallback);
    this.store.select(getIsSlowMotion).subscribe(s => this.animator.setIsSlowMotion(s));
    this.store.select(getIsPlaying).subscribe(p => p ? this.play() : this.pause());
    this.store.select(getIsRepeating).subscribe(r => this.animator.setIsRepeating(r));
    this.store.select(getAnimatorState)
      .subscribe(({ vectorLayer, animation }) => {
        this.activeAnimation = animation;
        this.animationRenderer = new AnimationRenderer(vectorLayer, animation);
        this.animator.rewind();
      });
  }

  getCurrentTime() {
    return this.animatorSubject.getValue().currentTime;
  }

  asObservable() {
    return this.animatorSubject.asObservable();
  }

  // TODO: make it possible to pause/resume animations (right now playing resets the time back to 0)
  private play() {
    this.animator.play(this.activeAnimation.duration, fraction => {
      const currentTime = this.activeAnimation.duration * fraction;
      const renderedVectorLayer = this.animationRenderer.setAnimationTime(currentTime);
      if (fraction === 0 || fraction === 1) {
        // Allow change detection at the start/end of the animation.
        this.ngZone.run(() => this.animatorSubject.next({ vl: renderedVectorLayer, currentTime }));
      } else {
        // By default the callback is invoked outside the default Angular
        // zone. Clients receiving this callback should be aware of that.
        this.animatorSubject.next({ vl: renderedVectorLayer, currentTime });
      }
    });
  }

  private pause() {
    this.animator.pause();
  }

  // TODO: make it so rewind navigates to the start of the currently active block?
  rewind() {
    this.animator.rewind();
    const currentTime = 0;
    const vl = this.animationRenderer.setAnimationTime(currentTime);
    this.animatorSubject.next({ vl, currentTime });
  }

  // TODO: make it so fast forward navigates to the end of the currently active block?
  fastForward() {
    this.animator.fastForward();
    const currentTime = this.activeAnimation.duration;
    const vl = this.animationRenderer.setAnimationTime(currentTime);
    this.animatorSubject.next({ vl, currentTime });
  }

  setAnimationTime(currentTime: number) {
    const vl = this.animationRenderer.setAnimationTime(currentTime);
    this.animatorSubject.next({ vl, currentTime });
  }

  reset() {
    this.rewind();
    this.animator = new Animator(this.animatorCallback);
  }
}
