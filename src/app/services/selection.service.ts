import * as _ from 'lodash';
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

  // TODO: maybe it does make sense to move selection state into the path commands after all?
  // first impression was that synchronizing inspector and selection state might be difficult
  // otherwise (i.e. making sure selections and reversals/shifts/splits/etc. stay in sync).
  constructor() {
    const editorTypes = [EditorType.Start, EditorType.Preview, EditorType.End];
    editorTypes.forEach(type => {
      this.selections[type] = [];
      this.sources[type] = new BehaviorSubject<Selection[]>([]);
      this.streams[type] = this.sources[type].asObservable();
    });
  }

  /** Returns the selections with the specified type. */
  private getSelections(type: EditorType) {
    return this.selections[type];
  }

  /** Sets and broadcasts the selections with the specified type. */
  private setSelections(type: EditorType, selections: Selection[]) {
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

  toggleSelection(type: EditorType, selection: Selection) {
    const isSelected = _.some(this.selections[type], selection);
    this.selections[type] = isSelected ? [] : [selection];
    this.notifyChange(type);
  }
}

// TODO: figure out how to keep these in sync with reversals/shifts/splits/unsplits.
export interface Selection {
  pathId: string;
  subPathIdx: number;
  drawIdx: number;
}
