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
 * TODO: handle case where vector layer and/or path layer are cleared
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

  getVectorLayer(type: CanvasType) {
    return this.vectorLayerMap.get(type);
  }

  /**
   * Should only be called by the path selector.
   */
  setVectorLayer(type: CanvasType, layer: VectorLayer) {
    this.vectorLayerMap.set(type, layer);
    this.activePathIdMap.delete(type);
    this.notifyChange(type);
  }

  getActivePathId(type: CanvasType) {
    return this.activePathIdMap.get(type);
  }

  /**
   * Should only be called by the path selector component.
   */
  setActivePathId(type: CanvasType, pathId: string) {
    const activePathId = this.getActivePathId(type);
    if (activePathId !== pathId) {
      this.activePathIdMap.set(type, pathId);
      this.notifyChange(type);
    }
  }

  getActivePathLayer(canvasType: CanvasType) {
    const vectorLayer = this.getVectorLayer(canvasType);
    const pathId = this.getActivePathId(canvasType);
    if (!vectorLayer || !pathId) {
      return undefined;
    }
    return vectorLayer.findLayerById(pathId) as PathLayer;
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
    const startVector = this.getVectorLayer(CanvasType.Start);
    const endVector = this.getVectorLayer(CanvasType.End);
    if (!startVector || !endVector) {
      return MorphabilityStatus.None;
    }
    const startPathId = this.getActivePathId(CanvasType.Start);
    const endPathId = this.getActivePathId(CanvasType.End);
    if (!startPathId || !endPathId) {
      return MorphabilityStatus.None;
    }
    const startPathLayer = startVector.findLayerById(startPathId);
    const endPathLayer = endVector.findLayerById(endPathId);
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
