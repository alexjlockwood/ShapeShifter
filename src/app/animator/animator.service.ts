import { Animation } from '../scripts/animations';
import { VectorLayer } from '../scripts/layers';
import {
  State,
  Store,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ToggleIsSlowMotion,
} from '../store';
import { getAnimatorState } from '../store/aia/selectors';
import {
  getIsPlaying,
  getIsRepeating,
  getIsSlowMotion,
} from '../store/playback/selectors';
import { AnimationRenderer } from './AnimationRenderer';
import { Animator } from './Animator';
import { Injectable, NgZone } from '@angular/core';
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

  // TODO: the 'should reverse' flag below doesn't work anymore... fix or remove?
  constructor(
    private readonly ngZone: NgZone,
    private readonly store: Store<State>,
  ) {
    this.animator = new Animator(ngZone, this.store);
    this.store.select(getIsSlowMotion).subscribe(s => this.animator.setIsSlowMotion(s));
    this.store.select(getIsPlaying).subscribe(p => p ? this.play() : this.pause());
    this.store.select(getIsRepeating).subscribe(r => this.animator.setIsRepeating(r));
    this.store.select(getAnimatorState)
      .subscribe(({ activeVectorLayer, activeAnimation }) => {
        this.activeAnimation = activeAnimation;
        this.animationRenderer = new AnimationRenderer(activeVectorLayer, activeAnimation);
        // TODO: can we make it possible to modify this data w/o pausing the animation?
        this.animator.pause();
      });
  }

  asObservable() {
    return this.animatorSubject.asObservable();
  }

  toggleIsSlowMotion() {
    this.store.dispatch(new ToggleIsSlowMotion());
  }

  toggleIsRepeating() {
    this.store.dispatch(new ToggleIsRepeating());
  }

  toggle() {
    this.store.dispatch(new ToggleIsPlaying());
  }

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
    this.animator = new Animator(this.ngZone, this.store);
  }
}
