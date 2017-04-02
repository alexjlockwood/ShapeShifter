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

  asObservable() {
    return this.source.asObservable();
  }

  getSelections() {
    return this.source.getValue();
  }

  getSelectedSubPaths(canvasType: CanvasType) {
    return this.getSelections()
      .filter(s => s.type === SelectionType.SubPath
        && s.source === canvasType)
      .map(s => s.index.subIdx);
  }

  getSelectedSubPathCommands(subIdx: number) {
    return this.getSelections()
      .filter(s => s.type === SelectionType.Command)
      .map(s => s.index.subIdx);
  }

  isSubPathSelected(canvasType: CanvasType, subIdx: number) {
    return this.getSelections().some(s => {
      return s.type === SelectionType.SubPath
        && s.source === canvasType
        && s.index.subIdx === subIdx;
    });
  }

  isCommandSelected(subIdx: number, cmdIdx: number) {
    return this.getSelections().some(s => {
      return s.type === SelectionType.Command
        && s.index.subIdx === subIdx
        && s.index.cmdIdx === cmdIdx;
    });
  }

  setSelections(selections: Selection[]) {
    this.source.next(selections);
  }

  toggleSubPath(source: CanvasType, subIdx: number) {
    this.toggle({
      type: SelectionType.SubPath,
      index: { subIdx },
      source,
    });
  }

  toggleCommand(source: CanvasType, subIdx: number, cmdIdx: number, appendToList = false) {
    this.toggle({
      type: SelectionType.Command,
      index: { subIdx, cmdIdx },
      source,
    });
  }

  /**
   * Toggles the specified selection. If the selection exists, it will be
   * removed from the list. Otherwise, it will be added to the list of selections.
   * By default, all other selections from the list will be cleared.
   */
  toggle(selection: Selection, appendToList = false) {
    const updatedSelections = this.source.getValue().slice();
    // Remove all selections that don't match the new selections canvas type.
    _.remove(updatedSelections, sel => sel.source !== selection.source);
    if (selection.type === SelectionType.SubPath) {
      // Remove all selections that aren't from the selected subpath.
      _.remove(updatedSelections, sel => {
        return sel.index.subIdx !== selection.index.subIdx;
      });
    }
    const existingSelections = _.remove(updatedSelections, sel => {
      // Remove any selections that are equal to the new selection.
      if (selection.type === SelectionType.SubPath) {
        // Toggling a subpath will also toggle all of its commands.
        return selection.index.subIdx === sel.index.subIdx;
      }
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
    this.setSelections([]);
  }
}

/**
 * A selection represents an action that is the result of a mouse click.
 */
export interface Selection {
  readonly type: SelectionType;
  readonly index: { subIdx: number, cmdIdx?: number };
  readonly source: CanvasType;
}

/**
 * Describes the different types of selection events.
 */
export enum SelectionType {
  // The user selected an entire subpath.
  SubPath,
  // The user selected an individual command in the subpath.
  Command,
}

function areSelectionsEqual(sel1: Selection, sel2: Selection) {
  if (sel1.source !== sel2.source || sel1.type !== sel2.type) {
    return false;
  }
  const id1 = sel1.index;
  const id2 = sel2.index;
  return id1.subIdx === id2.subIdx && id1.cmdIdx === id2.cmdIdx;
}
