import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Interpolator, INTERPOLATORS } from '../scripts/animation';
import {
  AnimatorService,
  LayerStateService,
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
    private animatorService: AnimatorService,
    private layerStateService: LayerStateService,
    private settingsService: SettingsService) { }

  ngOnInit() {
    this.shouldDisableSettingsObservable = Observable.combineLatest(
      this.animatorService.getAnimatorSettingsObservable(),
      this.layerStateService.getMorphabilityStatusObservable())
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

    const activeEndVectorLayer = this.layerStateService.getVectorLayer(CanvasType.End);
    const width = activeEndVectorLayer.width;
    const height = activeEndVectorLayer.height;
    const transforms = [
      Matrix.fromTranslation(-width / 2, -height / 2),
      Matrix.fromRotation(-this.rotation),
      Matrix.fromTranslation(width / 2, height / 2),
    ];
    const activeEndPathLayer = this.layerStateService.getActivePathLayer(CanvasType.End);
    activeEndPathLayer.pathData =
      activeEndPathLayer.pathData.mutate()
        .setTransforms(transforms)
        .build();
    this.layerStateService.updateActiveRotationLayer(CanvasType.Start, 0, false);
    this.layerStateService.updateActiveRotationLayer(CanvasType.Preview, 0, false);
    this.layerStateService.updateActiveRotationLayer(CanvasType.End, this.rotation, false);
    this.layerStateService.notifyChange(CanvasType.Start);
    this.layerStateService.notifyChange(CanvasType.Preview);
    this.layerStateService.notifyChange(CanvasType.End);
  }

  get shouldLabelPoints() {
    return this.settingsService.shouldLabelPoints();
  }

  set shouldLabelPoints(shouldLabelPoints: boolean) {
    this.settingsService.setShouldLabelPoints(shouldLabelPoints);
  }
}
