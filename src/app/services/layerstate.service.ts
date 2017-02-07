import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import { CanvasType } from '../CanvasType';

@Injectable()
export class LayerStateService {
  private readonly layerMap = new Map<CanvasType, VectorLayer>();
  private readonly sources = new Map<CanvasType, Subject<VectorLayer>>();
  private readonly streams = new Map<CanvasType, Observable<VectorLayer>>();

  constructor() {
    [CanvasType.Start, CanvasType.Preview, CanvasType.End]
      .forEach(type => {
        this.layerMap.set(type, undefined);
        this.sources.set(type, new BehaviorSubject<VectorLayer>(undefined));
        this.streams.set(type, this.sources.get(type).asObservable());
      });
  }

  /**
   * Returns the vector layer with the specified type.
   */
  getLayer(type: CanvasType) {
    return this.layerMap.get(type);
  }

  /**
   * Sets and broadcasts the vector layer with the specified type.
   */
  setLayer(type: CanvasType, layer: VectorLayer) {
    this.layerMap.set(type, layer);
    this.notifyChange(type);
  }

  /**
   * Broadcasts the vector layer change with the specified type.
   */
  notifyChange(type: CanvasType) {
    this.sources.get(type).next(this.layerMap.get(type));
  }

  /**
   * Adds a listener to receive data change events. The caller should
   * unsubscribe from the returned subscription object when it is destroyed.
   */
  addListener(type: CanvasType, callback: (layer: VectorLayer) => void) {
    return this.streams.get(type).subscribe(callback);
  }
}
