import { ActionSource } from '../store';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { Subject } from 'rxjs/Subject';

/**
 * A selection represents an action that is the result of a mouse click.
 * @deprecated
 */
export interface Selection {
  readonly type: SelectionType;
  readonly source: ActionSource;
  readonly subIdx: number;
  readonly cmdIdx?: number;
}

/**
 * Describes the different types of selection events.
 * @deprecated
 */
export enum SelectionType {
  // The user selected an entire subpath.
  SubPath = 1,
  // The user selected an individual segment in a subpath.
  Segment,
  // The user selected an individual point in a subpath.
  Point,
}

/**
 * A simple service that broadcasts selection events to all parts of the application.
 * @deprecated
 */
@Injectable()
export class SelectionService {
  private readonly source = new Subject<ReadonlyArray<Selection>>();
  private selections: ReadonlyArray<Selection> = [];

  asObservable() {
    return this.source.asObservable();
  }

  setSelections(selections: ReadonlyArray<Selection>) {
    this.selections = selections.slice();
    return this;
  }

  getSelections() {
    return this.selections.slice();
  }

  getSubPathSelections() {
    return this.getSelections().filter(s => s.type === SelectionType.SubPath);
  }

  getSegmentSelections() {
    return this.getSelections().filter(s => s.type === SelectionType.Segment);
  }

  getPointSelections() {
    return this.getSelections().filter(s => s.type === SelectionType.Point);
  }

  toggleSubPath(source: ActionSource, subIdx: number, appendToList = false) {
    // TODO: support multi-selection for subpaths
    appendToList = false;

    const selections = this.getSelections().slice();
    _.remove(selections, sel => sel.type !== SelectionType.SubPath && sel.source !== source);
    this.toggleSelections(
      selections,
      [{ type: SelectionType.SubPath, source, subIdx }],
      appendToList);
    return this;
  }

  toggleSegments(
    source: ActionSource,
    segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }>,
    appendToList = false) {

    // TODO: support multi-selection for segments
    appendToList = false;

    const selections = this.getSelections().slice();
    _.remove(selections, sel => sel.type !== SelectionType.Segment);
    this.toggleSelections(
      selections,
      segments.map(seg => {
        const { subIdx, cmdIdx } = seg;
        return { type: SelectionType.Segment, source, subIdx, cmdIdx };
      }),
      appendToList);
    return this;
  }

  togglePoint(source: ActionSource, subIdx: number, cmdIdx: number, appendToList = false) {
    const selections = this.getSelections().slice();
    _.remove(selections, sel => sel.type !== SelectionType.Point && sel.source !== source);
    this.toggleSelections(
      selections,
      [{ type: SelectionType.Point, source, subIdx, cmdIdx }],
      appendToList);
    return this;
  }

  /**
    * Toggles the specified selections. If a selection exists, all selections will be
    * removed from the list. Otherwise, they will be added to the list of selections.
    * By default, all other selections from the list will be cleared.
    */
  private toggleSelections(
    currentSelections: Selection[],
    newSelections: Selection[],
    appendToList = false) {

    const matchingSelections = _.remove(currentSelections, currSel => {
      // Remove any selections that are equal to a new selection.
      return newSelections.some(newSel => _.isEqual(newSel, currSel));
    });
    if (!matchingSelections.length) {
      // If no selections were removed, then add all of the selections to the list.
      currentSelections.push(...newSelections);
    }
    if (!appendToList) {
      // If we aren't appending multiple selections at a time, then clear
      // any previous selections from the list.
      _.remove(currentSelections, currSel => {
        return newSelections.every(newSel => !_.isEqual(currSel, newSel));
      });
    }
    this.selections = currentSelections;
  }

  /**
   * Clears the current list of selections without notifying any observers.
   */
  reset() {
    this.selections = [];
    return this;
  }

  /**
   * Clears the current list of selections.
   */
  resetAndNotify() {
    this.reset().notify();
  }

  notify() {
    this.source.next(this.selections);
  }
}
