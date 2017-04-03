import * as _ from 'lodash';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { CanvasType } from '../CanvasType';
import { StateService } from './state.service';
// import { PathUtil } from '../scripts/paths';

/**
 * A simple service that broadcasts selection events to all parts of the application.
 * TODO: clear selections in an onBlur callback somehow
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
      .filter(s => s.type === SelectionType.SubPath && s.source === canvasType)
      .map(s => s.subIdx);
  }

  getSelectedSubPathCommands(subIdx: number) {
    return this.getSelections()
      .filter(s => s.type === SelectionType.Point)
      .map(s => s.subIdx);
  }

  isSubPathSelected(canvasType: CanvasType, subIdx: number) {
    return this.getSelections().some(s => {
      return s.type === SelectionType.SubPath
        && s.source === canvasType
        && s.subIdx === subIdx;
    });
  }

  isCommandSelected(subIdx: number, cmdIdx: number) {
    return this.getSelections().some(s => {
      return s.type === SelectionType.Point
        && s.subIdx === subIdx
        && s.cmdIdx === cmdIdx;
    });
  }

  setSelections(selections: Selection[]) {
    this.source.next(selections);
  }

  toggleSubPath(source: CanvasType, subIdx: number) {
    this.toggle({ type: SelectionType.SubPath, source, subIdx, });
  }

  toggleCommand(source: CanvasType, subIdx: number, cmdIdx: number, appendToList = false) {
    this.toggle({ type: SelectionType.Point, source, subIdx, cmdIdx });
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
        return sel.subIdx !== selection.subIdx;
      });
    }
    const existingSelections = _.remove(updatedSelections, sel => {
      // Remove any selections that are equal to the new selection.
      if (selection.type === SelectionType.SubPath) {
        // Toggling a subpath will also toggle all of its commands.
        return selection.subIdx === sel.subIdx;
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
  readonly source: CanvasType;
  readonly subIdx: number;
  readonly cmdIdx?: number;
}

/**
 * Describes the different types of selection events.
 */
export enum SelectionType {
  // The user selected an entire subpath.
  SubPath,
  // The user selected an individual segment in a subpath.
  Segment,
  // The user selected an individual point in a subpath.
  Point,
}

function areSelectionsEqual(sel1: Selection, sel2: Selection) {
  return sel1.source === sel2.source
    && sel1.type === sel2.type
    && sel1.subIdx === sel2.subIdx
    && sel1.cmdIdx === sel2.cmdIdx;
}

/**
 * Deletes any currently selected split points.
 * TODO: rewrite this according to the new selection rules!
 */
export function deleteSelectedSplitPoints(
  lss: StateService,
  sss: SelectionService) {

  // const selections = sss.getSelections();
  // if (!selections.length) {
  //   return;
  // }
  // // Preconditions: all selections exist in the same editor and
  // // all selections correspond to the currently active path id.
  // const canvasType = selections[0].source;
  // const activePathLayer = lss.getActivePathLayer(canvasType);
  // const unsplitOpsMap: Map<number, Array<{ subIdx: number, cmdIdx: number }>> = new Map();
  // for (const selection of selections) {
  //   const { subIdx, cmdIdx } = selection;
  //   if (!activePathLayer.pathData.getSubPaths()[subIdx].getCommands()[cmdIdx].isSplit()) {
  //     continue;
  //   }
  //   let subIdxOps = unsplitOpsMap.get(subIdx);
  //   if (!subIdxOps) {
  //     subIdxOps = [];
  //   }
  //   subIdxOps.push({ subIdx, cmdIdx });
  //   unsplitOpsMap.set(subIdx, subIdxOps);
  // }
  // sss.reset();
  // const mutator = activePathLayer.pathData.mutate();
  // unsplitOpsMap.forEach((ops, idx) => {
  //   // TODO: perform these as a single batch instead of inside a loop? (to reduce # of broadcasts)
  //   PathUtil.sortPathOps(ops);
  //   for (const op of ops) {
  //     mutator.unsplitCommand(op.subIdx, op.cmdIdx);
  //   }
  // });
  // lss.updateActivePath(canvasType, mutator.build());
}
