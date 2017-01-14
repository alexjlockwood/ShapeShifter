import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from './scripts/model';
import { Observable } from 'rxjs/Observable';

@Injectable()
export class StateService {
  private readonly vls: VectorLayer[] = [];
  private readonly sources: Subject<VectorLayer>[] = [];
  private readonly streams: Observable<VectorLayer>[] = [];

  private currentAnimationFraction = 0;
  private readonly animationChangeSource = new BehaviorSubject<number>(0);
  private readonly animationChangeStream = this.animationChangeSource.asObservable();

  constructor() {
    [VectorLayerType.Start, VectorLayerType.Preview, VectorLayerType.End]
      .forEach(type => {
        this.sources[type] = new BehaviorSubject<VectorLayer>(undefined);
        this.streams[type] = this.sources[type].asObservable();
      });
  }

  /** Returns the vector layer with the specified type. */
  getVectorLayer(type: VectorLayerType) {
    return this.vls[type];
  }

  /** Sets and broadcasts the vector layer with the specified type. */
  setVectorLayer(type: VectorLayerType, vl: VectorLayer) {
    this.vls[type] = vl;
    this.notifyVectorLayerChange(type);
  }

  /** Broadcasts the vector layer with the specified type. */
  notifyVectorLayerChange(type: VectorLayerType) {
    this.sources[type].next(this.vls[type]);
  }

  /**
   * Adds a listener to receive vector layer change events. The caller should
   * unsubscribe from the returned subscription object when it is destroyed.
   */
  addOnVectorLayerChangeListener(
    type: VectorLayerType,
    callback: (vl: VectorLayer) => void) {
    return this.streams[type].subscribe(callback);
  }

  /** Returns the current global animation fraction. */
  getAnimationFraction() {
    return this.currentAnimationFraction;
  }

  /** Sets and broadcasts the current global animation fraction. */
  setAnimationFraction(fraction: number) {
    this.currentAnimationFraction = fraction;
    this.notifyAnimationChange();
  }

  /** Broadcasts the current global animation fraction. */
  notifyAnimationChange() {
    this.animationChangeSource.next(this.currentAnimationFraction);
  }

  /**
   * Adds a listener to receive animation change events. The caller should
   * unsubscribe from the returned subscription object when it is destroyed.
   */
  addOnAnimationChangeListener(callback: (fraction: number) => void) {
    return this.animationChangeStream.subscribe(callback);
  }
}

export enum VectorLayerType {
  Start, Preview, End
}
