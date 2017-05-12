import * as _ from 'lodash';
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Store } from '@ngrx/store';
import {
  State,
  getAnimations,
  getActiveAnimation,
  getVectorLayers,
  getPlaybackSettings,
  getIsSlowMotion,
  getIsPlaying,
  getIsRepeating,
  SetIsPlaying,
  ToggleIsSlowMotion,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ResetPlaybackSettings,
} from '../store';
import { Animation, AnimationBlock, INTERPOLATORS } from '../scripts/animations';
import { VectorLayer, Layer } from '../scripts/layers';
import { ModelUtil, LayerMap, PropertyMap } from '../scripts/common';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

const REPEAT_DELAY = 750;
const DEFAULT_IS_SLOW_MOTION = false;
const DEFAULT_PLAYBACK_SPEED = 1;
const SLOW_MOTION_PLAYBACK_SPEED = 5;
const DEFAULT_IS_REPEATING = false;
const DEFAULT_IS_PLAYING = false;
const DEFAULT_ANIMATOR_EVENT = { vl: undefined, currentTime: 0 };

/**
 * Coordinates and stores information about the currently active animation.
 */
@Injectable()
export class AnimatorService {
  private readonly animatorSubject = new BehaviorSubject<AnimatorEvent>(DEFAULT_ANIMATOR_EVENT);
  private animator: Animator;
  private animationRenderer: AnimationRenderer;
  private activeAnimation: Animation;

  // TODO: the 'should reverse' flag below doesn't work anymore... fix or remove?
  constructor(
    private readonly ngZone: NgZone,
    private readonly store: Store<State>,
  ) {
    this.animator = new Animator(ngZone, this.store);
    this.store.select(getIsSlowMotion)
      .subscribe(isSlowMotion => this.animator.setIsSlowMotion(isSlowMotion));
    this.store.select(getIsPlaying)
      .subscribe(isPlaying => isPlaying ? this.play() : this.pause());
    this.store.select(getIsRepeating)
      .subscribe(isRepeating => this.animator.setIsRepeating(isRepeating));
    Observable.combineLatest(
      this.store.select(getVectorLayers),
      this.store.select(getActiveAnimation),
    ).subscribe(([vls, activeAnimation]) => {
      if (!vls.length || !activeAnimation) {
        // TODO: make it so these cases are never possible
        return;
      }
      this.activeAnimation = activeAnimation;
      const vl = vls[0];
      this.animationRenderer = new AnimationRenderer(vl, activeAnimation);
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

  reset() {
    this.rewind();
    this.store.dispatch(new ResetPlaybackSettings());
    this.animator = new Animator(this.ngZone, this.store);
  }
}

class Animator {
  private timeoutId: number;
  private animationFrameId: number;
  private playbackSpeed = DEFAULT_IS_SLOW_MOTION ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  private isRepeating = false;
  private currentAnimatedFraction = 0;
  private shouldPlayInReverse = false;

  constructor(
    private readonly ngZone: NgZone,
    private readonly store: Store<State>,
  ) { }

  setIsRepeating(isRepeating: boolean) {
    this.isRepeating = isRepeating;
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.playbackSpeed = isSlowMotion ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  }

  play(duration: number, onUpdateFn: (fraction: number) => void) {
    this.startAnimation(duration, onUpdateFn);
    this.store.dispatch(new SetIsPlaying(true));
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
    this.store.dispatch(new SetIsPlaying(false));
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
      const shouldPlayInReverse = this.shouldPlayInReverse;
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
    this.ngZone.runOutsideAngular(() => {
      this.animationFrameId = requestAnimationFrame(onAnimationFrameFn);
    });
  }
}

const DEFAULT_LAYER_PROPERTY_STATE: PropertyState = {
  activeBlock: undefined,
  interpolatedValue: false
};

// TODO: should we 'link selected state' here similar to AIA?
class AnimationRenderer {
  private readonly renderedVectorLayer: VectorLayer;
  private readonly animDataByLayer: LayerMap<RendererData> = {};

  constructor(
    readonly originalVectorLayer: VectorLayer,
    readonly activeAnimation: Animation,
  ) {
    this.renderedVectorLayer = originalVectorLayer.deepClone();
    const animDataByLayer = ModelUtil.getOrderedBlocksByPropertyByLayer(activeAnimation);
    Object.keys(animDataByLayer).forEach(layerId => {
      this.animDataByLayer[layerId] = {
        originalLayer: originalVectorLayer.findLayerById(layerId),
        renderedLayer: this.renderedVectorLayer.findLayerById(layerId),
        orderedBlocks: animDataByLayer[layerId],
      };
    });
    this.setAnimationTime(0);
  }

  setAnimationTime(time: number) {
    Object.keys(this.animDataByLayer).forEach(layerId => {
      const animData = this.animDataByLayer[layerId];
      animData.cachedState = animData.cachedState || {} as PropertyState;

      Object.keys(animData.orderedBlocks).forEach(propertyName => {
        const blocks = animData.orderedBlocks[propertyName];
        const _ar = Object.assign({}, DEFAULT_LAYER_PROPERTY_STATE);

        // cCmpute rendered value at given time.
        const property = animData.originalLayer.animatableProperties.get(propertyName);
        let value = animData.originalLayer[propertyName];
        for (const block of blocks) {
          if (time < block.startTime) {
            break;
          }
          if (time < block.endTime) {
            const fromValue = ('fromValue' in block) ? block.fromValue : value;
            let f = (time - block.startTime) / (block.endTime - block.startTime);
            // TODO: this is a bit hacky... no need to perform a search every time.
            const interpolatorFn =
              _.find(INTERPOLATORS, i => i.value === block.interpolator).interpolateFn;
            f = interpolatorFn(f);
            value = property.interpolateValue(fromValue, block.toValue, f);
            _ar.activeBlock = block;
            _ar.interpolatedValue = true;
            break;
          }
          value = block.toValue;
          _ar.activeBlock = block;
        }

        animData.renderedLayer[propertyName] = value;

        // Cached data.
        animData.cachedState[propertyName] = animData.cachedState[propertyName] || {};
        animData.cachedState[propertyName] = _ar;
      });
    });
    return this.renderedVectorLayer;
  }

  private getLayerPropertyValue(layerId: string, propertyName: string) {
    return this.renderedVectorLayer.findLayerById(layerId)[propertyName];
  }

  private getLayerPropertyState(layerId: string, propertyName: string) {
    const layerAnimData = this.animDataByLayer[layerId];
    return layerAnimData
      ? (layerAnimData.cachedState[propertyName] || {}) as PropertyState
      : Object.assign({}, DEFAULT_LAYER_PROPERTY_STATE);
  }
}

interface AnimatorEvent {
  readonly vl: VectorLayer;
  readonly currentTime: number;
}

interface RendererData {
  readonly originalLayer: Layer;
  readonly renderedLayer: Layer;
  readonly orderedBlocks: PropertyMap<AnimationBlock<any>[]>;
  cachedState?: PropertyState;
}

interface PropertyState {
  activeBlock: AnimationBlock<any>;
  interpolatedValue: boolean;
}
