import * as _ from 'lodash';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import { Index as CommandIndex } from '../scripts/commands';
import { EditorType } from '../EditorType';

/**
 * A simple service that broadcasts selection events to all parts of the application.
 * TODO: clear selections in an onBlur callback somehow
 * TODO: investigate the pros and cons of identifying by uniqueId rather than index
 */
@Injectable()
export class SelectionStateService {
  private readonly source = new BehaviorSubject<Selection[]>([]);
  readonly stream = this.source.asObservable();
  private selections: Selection[] = [];

  getSelections(): ReadonlyArray<Selection> {
    return this.selections;
  }

  /**
   * Toggles the specified selection. If the selection exists, it will be
   * removed from the list. Otherwise, it will be added to the list of selections.
   * By default, all other selections from the list will be cleared.
   */
  toggle(selection: Selection, appendToList = false) {
    // Remove all selections that don't match the new selections editor type.
    _.remove(this.selections, sel => sel.source !== selection.source);
    const existingSelections = _.remove(this.selections, sel => {
      // Remove any selections that are equal to the new selection.
      return areSelectionsEqual(selection, sel);
    });
    if (!existingSelections.length) {
      // If no selections were removed, then add the selection to the list.
      this.selections.push(selection);
    }
    if (!appendToList) {
      // If we aren't appending multiple selections at a time, then clear
      // any previous selections from the list.
      _.remove(this.selections, sel => !areSelectionsEqual(selection, sel));
    }
    this.source.next(this.selections);
  }

  /**
   * Clears the current list of selections.
   */
  clear() {
    this.selections = [];
    this.source.next(this.selections);
  }
}

/**
 * A selection represents an action that is the result of a mouse click.
 */
export interface Selection {
  readonly commandId?: CommandIndex;
  readonly source?: EditorType;
}

function areSelectionsEqual(sel1: Selection, sel2: Selection) {
  if (sel1.source !== sel2.source) {
    return false;
  }
  const id1 = sel1.commandId;
  const id2 = sel2.commandId;
  return id1.pathId === id2.pathId
    && id1.subIdx === id2.subIdx
    && id1.cmdIdx === id2.cmdIdx;
}
