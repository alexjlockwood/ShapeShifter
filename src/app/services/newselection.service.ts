import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/model';
import { Observable } from 'rxjs/Observable';
import { EditorType } from '../scripts/model';

@Injectable()
export class NewSelectionService {
  private readonly source = new BehaviorSubject<Array<Selection>>([]);
  private readonly stream = this.source.asObservable();
  private selections: Selection[] = [];

  constructor() { }

  getSelections(type: EditorType) {
    return this.selections;
  }

  setSelections(selections: Selection[]) {
    this.selections = selections;
    this.notifyChange();
  }

  notifyChange() {
    this.source.next(this.selections);
  }

  addListener(type: EditorType, callback: (selections: Selection[]) => void) {
    return this.stream.subscribe(callback);
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
}
