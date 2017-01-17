import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/model';
import { Observable } from 'rxjs/Observable';
import { EditorType } from '../scripts/model';

@Injectable()
export class LayerStateService {
  private readonly vls: VectorLayer[] = [];
  private readonly sources: Subject<VectorLayer>[] = [];
  private readonly streams: Observable<VectorLayer>[] = [];

  private currentAnimationFraction = 0;
  private readonly animationChangeSource = new BehaviorSubject<number>(0);
  private readonly animationChangeStream = this.animationChangeSource.asObservable();

  constructor() {
    [EditorType.Start, EditorType.Preview, EditorType.End]
      .forEach(type => {
        this.sources[type] = new BehaviorSubject<VectorLayer>(undefined);
        this.streams[type] = this.sources[type].asObservable();
      });
  }

  /** Returns the vector layer with the specified type. */
  getVectorLayer(type: EditorType) {
    return this.vls[type];
  }

  /** Sets and broadcasts the vector layer with the specified type. */
  setVectorLayer(type: EditorType, vl: VectorLayer) {
    this.vls[type] = vl;
    this.notifyChange(type);
  }

  /** Broadcasts the vector layer with the specified type. */
  notifyChange(type: EditorType) {
    this.sources[type].next(this.vls[type]);
  }

  /**
   * Adds a listener to receive vector layer change events. The caller should
   * unsubscribe from the returned subscription object when it is destroyed.
   */
  addListener(
    type: EditorType,
    callback: (vl: VectorLayer) => void) {
    return this.streams[type].subscribe(callback);
  }
}
