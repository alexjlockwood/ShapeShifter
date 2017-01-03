import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from './scripts/models';

@Injectable()
export class StateService {
  private startVectorLayer_: VectorLayer;
  private previewVectorLayer_: VectorLayer;
  private endVectorLayer_: VectorLayer;
  private readonly startSource = new BehaviorSubject<VectorLayer>(undefined);
  private readonly previewSource = new BehaviorSubject<VectorLayer>(undefined);
  private readonly endSource = new BehaviorSubject<VectorLayer>(undefined);
  private readonly startStream = this.startSource.asObservable();
  private readonly previewStream = this.previewSource.asObservable();
  private readonly endStream = this.endSource.asObservable();

  getStartLayerSubscription(callback: (layer: VectorLayer) => void) {
   return this.startStream.subscribe(callback);
  }

  getPreviewLayerSubscription(callback: (layer: VectorLayer) => void) {
   return this.previewStream.subscribe(callback);
  }

  getEndLayerSubscription(callback: (layer: VectorLayer) => void) {
   return this.endStream.subscribe(callback);
  }

  set startVectorLayer(vectorLayer: VectorLayer) {
    this.startVectorLayer_ = vectorLayer;
    this.startSource.next(vectorLayer);
  }

  set previewVectorLayer(vectorLayer: VectorLayer) {
    this.previewVectorLayer_ = vectorLayer;
    this.previewSource.next(vectorLayer);
  }

  set endVectorLayer(vectorLayer: VectorLayer) {
    this.endVectorLayer_ = vectorLayer;
    this.endSource.next(vectorLayer);
  }
}
