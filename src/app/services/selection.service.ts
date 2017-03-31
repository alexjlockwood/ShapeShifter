import * as _ from 'lodash';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { CanvasType } from '../CanvasType';

/**
 * A simple service that broadcasts selection events to all parts of the application.
 * TODO: clear selections in an onBlur callback somehow
 * TODO: investigate the pros and cons of identifying by uniqueId rather than index
 */
@Injectable()
export class SelectionService {
  private readonly source = new BehaviorSubject<ReadonlyArray<Selection>>([]);

  observe() {
    return this.source.asObservable();
  }

  getSelections(): ReadonlyArray<Selection> {
    return this.source.getValue();
  }

  /**
   * Toggles the specified selection. If the selection exists, it will be
   * removed from the list. Otherwise, it will be added to the list of selections.
   * By default, all other selections from the list will be cleared.
   */
  toggle(selection: Selection, appendToList = false) {
    // Remove all selections that don't match the new selections editor type.
    const updatedSelections = this.source.getValue().slice();
    _.remove(updatedSelections, sel => {
      return sel.source !== selection.source;
    });
    const existingSelections = _.remove(updatedSelections, sel => {
      // Remove any selections that are equal to the new selection.
      return areSelectionsEqual(selection, sel);
    });
    if (!existingSelections.length) {
      // If no selections were removed, then add the selection to the list.
      updatedSelections.push(selection);
    }
    if (!appendToList) {
      // If we aren't appending multiple selections at a time, then clear
      // any previous selections from the list.
      _.remove(updatedSelections, sel => !areSelectionsEqual(selection, sel));
    }
    this.source.next(updatedSelections);
  }

  /**
   * Clears the current list of selections.
   */
  reset() {
    this.source.next([]);
  }
}

/**
 * A selection represents an action that is the result of a mouse click.
 */
export interface Selection {
  readonly commandId: { subIdx: number, cmdIdx: number };
  readonly source: CanvasType;
}

function areSelectionsEqual(sel1: Selection, sel2: Selection) {
  if (sel1.source !== sel2.source) {
    return false;
  }
  const id1 = sel1.commandId;
  const id2 = sel2.commandId;
  return id1.subIdx === id2.subIdx && id1.cmdIdx === id2.cmdIdx;
}
