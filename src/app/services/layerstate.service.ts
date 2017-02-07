import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer, PathLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import { CanvasType } from '../CanvasType';

@Injectable()
export class LayerStateService {
  private readonly vectorLayerMap = new Map<CanvasType, VectorLayer>();
  private readonly vectorLayerSources = new Map<CanvasType, Subject<VectorLayer>>();
  private readonly vectorLayerStreams = new Map<CanvasType, Observable<VectorLayer>>();
  private readonly pathLayerMap = new Map<CanvasType, PathLayer>();
  private readonly pathLayerSources = new Map<CanvasType, Subject<PathLayer>>();
  private readonly pathLayerStreams = new Map<CanvasType, Observable<PathLayer>>();

  constructor() {
    [CanvasType.Start, CanvasType.Preview, CanvasType.End]
      .forEach(type => {
        this.vectorLayerMap.set(type, undefined);
        this.vectorLayerSources.set(type, new BehaviorSubject<VectorLayer>(undefined));
        this.vectorLayerStreams.set(type, this.vectorLayerSources.get(type).asObservable());
        this.pathLayerMap.set(type, undefined);
        this.pathLayerSources.set(type, new BehaviorSubject<PathLayer>(undefined));
        this.pathLayerStreams.set(type, this.pathLayerSources.get(type).asObservable());
      });
  }

  getVectorLayer(type: CanvasType) {
    return this.vectorLayerMap.get(type);
  }

  setVectorLayer(type: CanvasType, layer: VectorLayer) {
    this.vectorLayerMap.set(type, layer);
    this.notifyVectorLayerChange(type);
  }

  notifyVectorLayerChange(type: CanvasType) {
    this.vectorLayerSources.get(type).next(this.vectorLayerMap.get(type));
  }

  addVectorLayerListener(type: CanvasType, callback: (layer: VectorLayer) => void) {
    return this.vectorLayerStreams.get(type).subscribe(callback);
  }

  getPathLayer(type: CanvasType) {
    return this.vectorLayerMap.get(type);
  }

  setPathLayer(type: CanvasType, layer: PathLayer) {
    this.pathLayerMap.set(type, layer);
    this.notifyVectorLayerChange(type);
  }

  notifyPathLayerChange(type: CanvasType) {
    this.pathLayerSources.get(type).next(this.pathLayerMap.get(type));
  }

  addPathLayerListener(type: CanvasType, callback: (layer: PathLayer) => void) {
    return this.pathLayerStreams.get(type).subscribe(callback);
  }

  forCanvasType(type: CanvasType) {
    return new TypedLayerStateServiceImpl(this, type);
  }
}

export interface TypedLayerStateService {
  getVectorLayer(): VectorLayer;
  setVectorLayer(layer: VectorLayer);
  notifyVectorLayerChange();
  addVectorLayerListener(callback: (layer: VectorLayer) => void);
  getPathLayer();
  setPathLayer(layer: PathLayer);
  notifyPathLayerChange();
  addPathLayerListener(callback: (layer: PathLayer) => void);
}

class TypedLayerStateServiceImpl {
  constructor(
    private layerStateService: LayerStateService,
    private canvasType: CanvasType) { }

  getVectorLayer() {
    return this.layerStateService.getVectorLayer(this.canvasType);
  }

  setVectorLayer(layer: VectorLayer) {
    return this.layerStateService.setVectorLayer(this.canvasType, layer);
  }

  notifyVectorLayerChange() {
    this.layerStateService.notifyVectorLayerChange(this.canvasType);
  }

  addVectorLayerListener(callback: (layer: VectorLayer) => void) {
    return this.layerStateService.addVectorLayerListener(this.canvasType, callback);
  }

  getPathLayer() {
    return this.layerStateService.getPathLayer(this.canvasType);
  }

  setPathLayer(layer: PathLayer) {
    return this.layerStateService.setPathLayer(this.canvasType, layer);
  }

  notifyPathLayerChange() {
    this.layerStateService.notifyPathLayerChange(this.canvasType);
  }

  addPathLayerListener(callback: (layer: PathLayer) => void) {
    return this.layerStateService.addPathLayerListener(this.canvasType, callback);
  }
}
