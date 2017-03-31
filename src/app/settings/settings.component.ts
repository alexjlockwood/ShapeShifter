import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Interpolator, INTERPOLATORS } from '../scripts/animation';
import {
  AnimatorService,
  StateService,
  MorphabilityStatus,
  SettingsService,
} from '../services';
import { CanvasType } from '../CanvasType';
import { Observable } from 'rxjs/Observable';
import { Matrix } from '../scripts/common';
import 'rxjs/add/observable/combineLatest';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  interpolators = INTERPOLATORS;
  private rotation_ = 0;
  shouldDisableSettingsObservable: Observable<boolean>;

  constructor(
    private readonly animatorService: AnimatorService,
    private readonly stateService: StateService,
    private readonly settingsService: SettingsService,
  ) { }

  ngOnInit() {
    this.shouldDisableSettingsObservable = Observable.combineLatest(
      this.animatorService.getAnimatorSettingsObservable(),
      this.stateService.getMorphabilityStatusObservable())
      .map((value: [{ isPlaying: boolean }, MorphabilityStatus]) => {
        return value[0].isPlaying || value[1] !== MorphabilityStatus.Morphable;
      });
  }

  get selectedInterpolator() {
    return this.animatorService.getInterpolator();
  }

  set selectedInterpolator(interpolator: Interpolator) {
    this.animatorService.setInterpolator(interpolator);
  }

  get duration() {
    return this.animatorService.getDuration();
  }

  // TODO: validate this input (i.e. between min/max values)
  set duration(duration: number) {
    this.animatorService.setDuration(duration);
  }

  get rotation() {
    return this.rotation_;
  }

  // TODO: remove the layer if both attributes are set to 0?
  // TODO: make these the rotation gets exported as well
  set rotation(rotation: number) {
    this.rotation_ = rotation;

    const activeEndVectorLayer = this.stateService.getVectorLayer(CanvasType.End);
    const width = activeEndVectorLayer.width;
    const height = activeEndVectorLayer.height;
    const transforms = [
      Matrix.fromTranslation(-width / 2, -height / 2),
      Matrix.fromRotation(-this.rotation),
      Matrix.fromTranslation(width / 2, height / 2),
    ];
    const activeEndPathLayer = this.stateService.getActivePathLayer(CanvasType.End);
    activeEndPathLayer.pathData =
      activeEndPathLayer.pathData.mutate()
        .setTransforms(transforms)
        .build();
    this.stateService.updateActiveRotationLayer(CanvasType.Start, 0, false);
    this.stateService.updateActiveRotationLayer(CanvasType.Preview, 0, false);
    this.stateService.updateActiveRotationLayer(CanvasType.End, this.rotation, false);
    this.stateService.notifyChange(CanvasType.Start);
    this.stateService.notifyChange(CanvasType.Preview);
    this.stateService.notifyChange(CanvasType.End);
  }

  get shouldLabelPoints() {
    return this.settingsService.shouldLabelPoints();
  }

  set shouldLabelPoints(shouldLabelPoints: boolean) {
    this.settingsService.setShouldLabelPoints(shouldLabelPoints);
  }
}
