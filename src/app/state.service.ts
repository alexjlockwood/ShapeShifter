import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { VectorLayer, PathLayer } from './scripts/models';
import { SvgPathData } from './scripts/svgpathdata';
import * as SvgLoader from './scripts/svgloader';

@Injectable()
export class StateService {
  private readonly timelineSliderSource = new Subject<number>();
  private readonly timelineSliderStream = this.timelineSliderSource.asObservable();
  private readonly timelineCheckboxSource = new Subject<boolean>();
  private readonly timelineCheckboxStream = this.timelineCheckboxSource.asObservable();

  private startVectorLayer_: VectorLayer;
  private previewVectorLayer_: VectorLayer;
  private endVectorLayer_: VectorLayer;

  constructor() {
    const startSvgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <path d="M 5,11 L 11,11 L 11,5 L 13,5 L 13,11 L 19,11 L 19,13
                 L 13,13 L 13,19 L 11,19 L 11,13 L 5,13 Z" fill="#000" />
      </svg>`;
    this.startVectorLayer_ = SvgLoader.loadVectorLayerFromSvgString(startSvgString);
    const endSvgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24">
        <path d="M 5,11 L 11,11 L 11,11 L 13,11 L 13,11 L 19,11 L 19,13
                 L 13,13 L 13,13 L 11,13 L 11,13 L 5,13 Z" fill="#000" />
      </svg>`;
    this.endVectorLayer_ = SvgLoader.loadVectorLayerFromSvgString(endSvgString);
    this.previewVectorLayer_ = this.startVectorLayer_.clone();

    this.getAnimationFractionChangedSubscription(
      animationFraction => {
        console.log('re-interpolating preview canvas: ' + animationFraction);
        this.animatePreview(animationFraction);
      });
  }

  private animatePreview(fraction: number) {
    const animateLayer = layer => {
      if (layer.children) {
        layer.children.forEach(c => animateLayer(c));
        return;
      }
      if (layer instanceof PathLayer) {
        const sl = this.startVectorLayer.findLayerById(layer.id);
        const el = this.endVectorLayer.findLayerById(layer.id);
        if (sl && el && sl instanceof PathLayer && el instanceof PathLayer) {
          const newPathData = SvgPathData.interpolate(sl.pathData, el.pathData, fraction);
          console.log(sl.pathData, el.pathData, newPathData);
          if (newPathData) {
            layer.pathData = newPathData;
          }
        }
      }
    };
    animateLayer(this.previewVectorLayer);
  }

  get startVectorLayer() {
    return this.startVectorLayer_;
  }

  get previewVectorLayer() {
    return this.previewVectorLayer_;
  }

  get endVectorLayer() {
    return this.endVectorLayer_;
  }

  notifyAnimationFractionChanged(animationFraction: number) {
    this.timelineSliderSource.next(animationFraction);
  }

  notifyShouldLabelPointsChanged(isChecked: boolean) {
    this.timelineCheckboxSource.next(isChecked);
  }

  getAnimationFractionChangedSubscription(callback: (number) => void) {
    return this.timelineSliderSource.subscribe(callback);
  }

  getShouldLabelPointsChangedSubscription(callback: (boolean) => void) {
    return this.timelineCheckboxSource.subscribe(callback);
  }
}
