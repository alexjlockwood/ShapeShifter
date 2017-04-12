import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Interpolator, INTERPOLATORS } from '../scripts/animation';
import { MathUtil } from '../scripts/common';

const DEFAULT_SHOULD_LABEL_POINTS = false;
const DEFAULT_ROTATION = 0;

const MIN_DURATION = 100;
const DEFAULT_DURATION = 300;
const MAX_DURATION = 60000;

const DEFAULT_INTERPOLATOR = INTERPOLATORS[0];

/**
 * A simple service that broadcasts changes to the application's settings.
 */
@Injectable()
export class SettingsService {
  private readonly rotationSource = new BehaviorSubject<number>(DEFAULT_ROTATION);
  private readonly animationSettingsSource = new BehaviorSubject<AnimationSettings>(createDefaultAnimationSettings());
  private readonly canvasSettingsSource = new BehaviorSubject<CanvasSettings>(createDefaultCanvasSettings());

  getAnimationSettingsObservable() {
    return this.animationSettingsSource.asObservable();
  }

  getRotationObservable() {
    return this.rotationSource.asObservable();
  }

  getCanvasSettingsObservable() {
    return this.canvasSettingsSource.asObservable();
  }

  setShouldLabelPoints(shouldLabelPoints: boolean) {
    this.canvasSettingsSource.next({ shouldLabelPoints });
  }

  shouldLabelPoints() {
    return this.canvasSettingsSource.getValue().shouldLabelPoints;
  }

  setRotation(rotation: number) {
    this.rotationSource.next(rotation);
  }

  getRotation() {
    return this.rotationSource.getValue();
  }

  setDuration(duration: number) {
    duration = MathUtil.clamp(duration, MIN_DURATION, MAX_DURATION);
    const { interpolator } = this.animationSettingsSource.getValue();
    this.animationSettingsSource.next({ duration, interpolator });
  }

  getDuration() {
    return this.animationSettingsSource.getValue().duration;
  }

  setInterpolator(interpolator: Interpolator) {
    const { duration } = this.animationSettingsSource.getValue();
    this.animationSettingsSource.next({ duration, interpolator });
  }

  getInterpolator() {
    return this.animationSettingsSource.getValue().interpolator;
  }

  reset() {
    this.setShouldLabelPoints(DEFAULT_SHOULD_LABEL_POINTS);
    this.setDuration(DEFAULT_DURATION);
    this.setRotation(DEFAULT_ROTATION);
    this.animationSettingsSource.next(createDefaultAnimationSettings());
  }
}

function createDefaultCanvasSettings() {
  return { shouldLabelPoints: DEFAULT_SHOULD_LABEL_POINTS };
}

function createDefaultAnimationSettings() {
  return {
    duration: DEFAULT_DURATION,
    interpolator: DEFAULT_INTERPOLATOR,
  };
}

export interface CanvasSettings {
  readonly shouldLabelPoints: boolean;
}

export interface AnimationSettings {
  readonly duration: number;
  readonly interpolator: Interpolator;
}
