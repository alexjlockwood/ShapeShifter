import * as _ from 'lodash';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/model';
import { Observable } from 'rxjs/Observable';
import { EditorType } from '../scripts/model';
import { BaseService } from './base.service';

@Injectable()
export class SelectionService extends BaseService<Array<Selection>> {
  private readonly hoverSources = new Map<EditorType, Subject<Hover>>();
  private readonly hoverStreams = new Map<EditorType, Observable<Hover>>();

  constructor() {
    super([]);
    [EditorType.Start, EditorType.Preview, EditorType.End]
      .forEach(type => {
        this.hoverSources.set(type, new Subject<Hover>());
        this.hoverStreams.set(type, this.hoverSources.get(type).asObservable());
      });
  }

  // TODO: make this API more flexible/generic
  toggleSelection(type: EditorType, selection: Selection) {
    const selections = this.getData(type);
    const isSelected = _.some(selections, selection);
    this.setData(type, isSelected ? [] : [selection]);
    this.notifyChange(type);
  }

  // TODO: clean up this API...
  reverse(type: EditorType, subPathIdx: number, numCommands: number) {
    this.setData(type, this.getData(type).map(sel => {
      if (sel.subPathIdx !== subPathIdx) {
        return sel;
      }
      // TODO: this doesn't quite work yet... but close enough for now.
      // ideally the selected path should stay the same. try it on a plus SVG to reproduce.
      return _.assign({}, sel, { drawIdx: numCommands - sel.drawIdx - 1 });
    }));
    this.notifyChange(type);
  }
}

/**
 * A selection represents an action that persists as the result of a user click.
 */
export interface Selection {
  pathId: string;
  subPathIdx: number;
  drawIdx: number;
}

/**
 * A hover represents a transient action that results as a result of a mouse hover.
 */
export interface Hover {
  pathId: string;
  subPathIdx: number;
  drawIdx: number;
  hoverType: HoverType;
}

/**
 * Describes the different types of hover events.
 */
export enum HoverType {
  // The user cleared a hover event.
  None,
  // The user hovered over a draw command in the inspector/canvas.
  Command,
  // The user hovered over the split button in the command inspector.
  Split,
  // The user hovered over the unsplit button in the command inspector.
  Unsplit,
};