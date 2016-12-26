import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { VectorLayer, PathLayer } from './scripts/models';
import { SvgPathData } from './scripts/svgpathdata';
import * as SvgLoader from './scripts/svgloader';

@Injectable()
export class StateService {
  readonly timelineChangedSource = new Subject<number>();
  readonly timelineChangedStream = this.timelineChangedSource.asObservable();

  private startVectorLayer_: VectorLayer;
  private previewVectorLayer_: VectorLayer;
  private endVectorLayer_: VectorLayer;

  constructor() {
    const startSvgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M 4 4 L 16 16" stroke="red" stroke-width="2" />
      </svg>`;
    this.startVectorLayer_ = SvgLoader.loadVectorLayerFromSvgString(startSvgString);
    const endSvgString = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M 8 8 L 20 20" stroke="red" stroke-width="2" />
      </svg>`;
    this.endVectorLayer_ = SvgLoader.loadVectorLayerFromSvgString(endSvgString);
    this.previewVectorLayer_ = this.startVectorLayer_.clone();

    this.timelineChangedSource.subscribe(
      animationFraction => {
        animationFraction /= 1000;
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
}
