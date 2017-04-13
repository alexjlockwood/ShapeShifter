import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Interpolator, INTERPOLATORS } from '../scripts/animation';
import {
  AnimatorService,
  StateService,
  MorphStatus,
  SettingsService,
} from '../services';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  readonly INTERPOLATORS = INTERPOLATORS;
  shouldDisableSettingsObservable: Observable<boolean>;

  constructor(
    private readonly animatorService: AnimatorService,
    private readonly stateService: StateService,
    private readonly settingsService: SettingsService,
  ) { }

  ngOnInit() {
    this.shouldDisableSettingsObservable = Observable.combineLatest(
      this.animatorService.getAnimatorSettingsObservable(),
      this.stateService.getMorphStatusObservable())
      .map((value: [{ isPlaying: boolean }, MorphStatus]) => {
        return value[0].isPlaying || value[1] !== MorphStatus.Morphable;
      });
    // We subscribe here to ensure that Angular 2 change detection works properly.
    this.settingsService.getCanvasSettingsObservable().subscribe(() => { });
    this.settingsService.getAnimationSettingsObservable().subscribe(() => { });
    this.settingsService.getRotationObservable().subscribe(() => { });
  }

  get selectedInterpolator() {
    return this.settingsService.getInterpolator();
  }

  set selectedInterpolator(interpolator: Interpolator) {
    this.settingsService.setInterpolator(interpolator);
  }

  get duration() {
    return this.settingsService.getDuration();
  }

  set duration(duration: number) {
    this.settingsService.setDuration(duration);
  }

  get rotation() {
    return this.settingsService.getRotation();
  }

  set rotation(rotation: number) {
    this.settingsService.setRotation(rotation);
  }

  get shouldLabelPoints() {
    return this.settingsService.shouldLabelPoints();
  }

  set shouldLabelPoints(shouldLabelPoints: boolean) {
    this.settingsService.setShouldLabelPoints(shouldLabelPoints);
  }
}
