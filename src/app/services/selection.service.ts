import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/model';
import { Observable } from 'rxjs/Observable';
import { EditorType } from '../scripts/model';

@Injectable()
export class SelectionService {
  private readonly selections: Selection[][] = [];
  private readonly sources: Subject<Selection[]>[] = [];
  private readonly streams: Observable<Selection[]>[] = [];

  constructor() {
    [EditorType.Start, EditorType.Preview, EditorType.End]
      .forEach(type => {
        this.sources[type] = new BehaviorSubject<Selection[]>([]);
        this.streams[type] = this.sources[type].asObservable();
      });
  }

  /** Returns the selections with the specified type. */
  getSelections(type: EditorType) {
    return this.selections[type];
  }

  /** Sets and broadcasts the selections with the specified type. */
  setSelections(type: EditorType, selections: Selection[]) {
    this.selections[type] = selections;
    this.notifyChange(type);
  }

  /** Broadcasts the selections with the specified type. */
  notifyChange(type: EditorType) {
    this.sources[type].next(this.selections[type]);
  }

  /**
   * Adds a listener to receive selection change events. The caller should
   * unsubscribe from the returned subscription object when it is destroyed.
   */
  addListener(
    type: EditorType,
    callback: (selections: Selection[]) => void) {
    return this.streams[type].subscribe(callback);
  }
}

type Selection = number;
