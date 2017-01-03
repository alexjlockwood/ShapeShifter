import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from './scripts/models';
import { Observable } from 'rxjs/Observable';


@Injectable()
export class StateService {
  private readonly vectorLayers: VectorLayer[];
  private readonly vectorLayerSources: Subject<VectorLayer>[];
  private readonly vectorLayerStreams: Observable<VectorLayer>[];

  constructor() {
    const vectorLayerTypes: VectorLayerType[] =
      [VectorLayerType.Start, VectorLayerType.Preview, VectorLayerType.End];
    const vectorLayerSources: Subject<VectorLayer>[] = [];
    const vectorLayerStreams: Observable<VectorLayer>[] = [];
    const vectorLayers: VectorLayer[] = [];
    vectorLayerTypes.forEach(t => {
      vectorLayerSources[t] = new BehaviorSubject<VectorLayer>(undefined);
      vectorLayerStreams[t] = vectorLayerSources[t].asObservable();
      vectorLayers[t] = undefined;
    });
    this.vectorLayerSources = vectorLayerSources;
    this.vectorLayerStreams = vectorLayerStreams
    this.vectorLayers = vectorLayers;
  }

  getVectorLayer(type: VectorLayerType) {
    return this.vectorLayers[type];
  }

  subscribeToVectorLayer(type: VectorLayerType, callback: (vectorLayer: VectorLayer) => void) {
    return this.vectorLayerStreams[type].subscribe(callback);
  }

  setVectorLayer(type: VectorLayerType, vectorLayer: VectorLayer) {
    this.vectorLayers[type] = vectorLayer;
    this.vectorLayerSources[type].next(vectorLayer);
  }
}

export enum VectorLayerType {
  Start, Preview, End
}
