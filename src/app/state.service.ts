import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from './scripts/models';


@Injectable()
export class StateService {
  // These are identical to the constants defined in AppComponent.
  private readonly start = 'start';
  private readonly preview = 'preview';
  private readonly end = 'end';

  private startVectorLayer: VectorLayer;
  private previewVectorLayer: VectorLayer;
  private endVectorLayer: VectorLayer;
  private startLayerSource = new BehaviorSubject<VectorLayer>(undefined);
  private previewLayerSource = new BehaviorSubject<VectorLayer>(undefined);
  private endLayerSource = new BehaviorSubject<VectorLayer>(undefined);
  private startLayerStream = this.startLayerSource.asObservable();
  private previewLayerStream = this.previewLayerSource.asObservable();
  private endLayerStream = this.endLayerSource.asObservable();

  getVectorLayer(key: string) {
    if (key === this.start) {
      return this.startVectorLayer;
    } else if (key === this.preview) {
      return this.previewVectorLayer;
    } else if (key === this.end) {
      return this.endVectorLayer;
    }
    throw new Error('Invalid key: ' + key);
  }

  subscribeToVectorLayer(key: string, callback: (vectorLayer: VectorLayer) => void) {
    if (key === this.start) {
      return this.startLayerStream.subscribe(callback);
    } else if (key === this.preview) {
      return this.previewLayerStream.subscribe(callback);
    } else if (key === this.end) {
      return this.endLayerStream.subscribe(callback);
    }
    throw new Error('Invalid key: ' + key);
  }

  setVectorLayer(key: string, vectorLayer: VectorLayer) {
    if (key === this.start) {
      this.startVectorLayer = vectorLayer;
      this.startLayerSource.next(vectorLayer);
    } else if (key === this.preview) {
      this.previewVectorLayer = vectorLayer;
      this.previewLayerSource.next(vectorLayer);
    } else if (key === this.end) {
      this.endVectorLayer = vectorLayer;
      this.endLayerSource.next(vectorLayer);
    } else {
      throw new Error('Invalid key: ' + key);
    }
  }
}
