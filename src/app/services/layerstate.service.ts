import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer, PathLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import { CanvasType } from '../CanvasType';

/**
 * The global state service that is in charge of keeping track of the loaded
 * SVGs, active path layers, and the current morphability status.
 */
@Injectable()
export class LayerStateService {
  private readonly vectorLayerMap = new Map<CanvasType, VectorLayer>();
  private readonly activePathIdMap = new Map<CanvasType, string>();
  private readonly eventSources = new Map<CanvasType, Subject<LayerStateEvent>>();
  private readonly eventStreams = new Map<CanvasType, Observable<LayerStateEvent>>();

  constructor() {
    [CanvasType.Start, CanvasType.Preview, CanvasType.End]
      .forEach(type => {
        this.vectorLayerMap.set(type, undefined);
        this.eventSources.set(type, new BehaviorSubject<LayerStateEvent>({
          vectorLayer: undefined,
          activePathId: undefined,
          morphabilityStatus: MorphabilityStatus.None,
        }));
        this.eventStreams.set(type, this.eventSources.get(type).asObservable());
      });
  }

  /**
   * Called by the PathSelectorComponent when a new vector layer is imported.
   */
  setVectorLayer(type: CanvasType, layer: VectorLayer) {
    this.vectorLayerMap.set(type, layer);
    this.activePathIdMap.delete(type);
    this.notifyChange(type);
  }

  /**
   * Called by the PathSelectorComponent when a new vector layer path is selected.
   */
  setActivePathId(type: CanvasType, pathId: string) {
    const activePathId = this.getActivePathId(type);
    if (activePathId !== pathId) {
      this.activePathIdMap.set(type, pathId);
      this.notifyChange(type);
    }
  }

  getVectorLayer(type: CanvasType) {
    return this.vectorLayerMap.get(type);
  }

  getActivePathId(type: CanvasType) {
    return this.activePathIdMap.get(type);
  }

  getActivePathLayer(canvasType: CanvasType) {
    const vectorLayer = this.getVectorLayer(canvasType);
    const activePathId = this.getActivePathId(canvasType);
    if (!vectorLayer || !activePathId) {
      return undefined;
    }
    return vectorLayer.findLayerById(activePathId) as PathLayer;
  }

  notifyChange(type: CanvasType) {
    this.eventSources.get(type).next({
      vectorLayer: this.vectorLayerMap.get(type),
      activePathId: this.activePathIdMap.get(type),
      morphabilityStatus: this.getMorphabilityStatus(),
    });
  }

  addListener(type: CanvasType, callback: (layerStateEvent: LayerStateEvent) => void) {
    return this.eventStreams.get(type).subscribe(callback);
  }

  getMorphabilityStatus() {
    const startPathLayer = this.getActivePathLayer(CanvasType.Start);
    const endPathLayer = this.getActivePathLayer(CanvasType.End);
    if (!startPathLayer || !endPathLayer) {
      return MorphabilityStatus.None;
    }
    if (startPathLayer.isMorphableWith(endPathLayer)) {
      return MorphabilityStatus.Morphable;
    }
    return MorphabilityStatus.Unmorphable;
  }
}

// TODO: also need to handle case where paths are invalid (i.e. unequal # of subpaths)
export enum MorphabilityStatus {
  None,
  Unmorphable,
  Morphable,
}

export interface LayerStateEvent {
  vectorLayer: VectorLayer | undefined;
  activePathId: string | undefined;
  morphabilityStatus: MorphabilityStatus;
}
