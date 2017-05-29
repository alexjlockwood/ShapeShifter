import * as _ from 'lodash';
import * as actions from './actions';
import { CanvasType } from '../../CanvasType';

/**
 * Different shape shifter app modes.
 */
export enum AppMode {
  Selection = 1,
  SplitCommands,
  SplitSubPaths,
  MorphSubPaths,
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
  SubPath = 1,
  // The user selected an individual segment in a subpath.
  Segment,
  // The user selected an individual point in a subpath.
  Point,
}

/**
 * A hover represents a transient action that results from a mouse movement.
 */
export interface Hover {
  readonly type: HoverType;
  readonly source: CanvasType;
  readonly subIdx: number;
  readonly cmdIdx?: number;
}

/**
 * Describes the different types of hover events.
 */
export enum HoverType {
  SubPath = 1,
  Segment,
  Point,
  Split,
  Unsplit,
  Reverse,
  ShiftBack,
  ShiftForward,
  SetFirstPosition,
}

export interface State {
  readonly appMode: AppMode;
  readonly hover: Hover;
  readonly selections: ReadonlyArray<Selection>;
}

export const initialState = buildInitialState();

export function buildInitialState(): State {
  return {
    appMode: AppMode.Selection,
    hover: undefined,
    selections: [],
  };
}

export function reducer(state = initialState, action: actions.Actions): State {
  switch (action.type) {

    // Set the app mode during shape shifter mode.
    case actions.SET_APP_MODE: {
      const { appMode } = action.payload;
      return { ...state, appMode };
    }

    // Set the hover mode during shape shifter mode.
    case actions.SET_HOVER: {
      const { hover } = action.payload;
      return { ...state, hover };
    }

    // Set the path selections during shape shifter mode.
    case actions.SET_SELECTIONS: {
      const { selections } = action.payload;
      return { ...state, selections };
    }

    // Toggle a subpath selection.
    case actions.TOGGLE_SUBPATH_SELECTION: {
      const { source, subIdx } = action.payload;
      let selections = state.selections.slice();
      _.remove(selections, s => s.type !== SelectionType.SubPath && s.source !== source);
      selections = toggleShapeShifterSelections(
        selections,
        [{ type: SelectionType.SubPath, source, subIdx }],
        false);
      return { ...state, selections };
    }

    // Toggle a segment selection.
    case actions.TOGGLE_SEGMENT_SELECTIONS: {
      const { source, segments } = action.payload;
      let selections = state.selections.slice();
      _.remove(selections, s => s.type !== SelectionType.Segment);
      selections = toggleShapeShifterSelections(
        selections,
        segments.map(segment => {
          const { subIdx, cmdIdx } = segment;
          return { type: SelectionType.Segment, source, subIdx, cmdIdx };
        }),
        false);
      return { ...state, selections };
    }

    // Toggle a point selection.
    case actions.TOGGLE_POINT_SELECTION: {
      const { source, subIdx, cmdIdx, appendToList } = action.payload;
      let selections = state.selections.slice();
      _.remove(selections, s => s.type !== SelectionType.Point && s.source !== source);
      selections = toggleShapeShifterSelections(
        selections,
        [{ type: SelectionType.Point, source, subIdx, cmdIdx }],
        appendToList,
      );
      return { ...state, selections };
    }

    default: {
      return state;
    }
  }
}

/**
  * Toggles the specified shape shifter selections. If a selection exists, all selections
  * will be removed from the list. Otherwise, they will be added to the list of selections.
  * By default, all other selections from the list will be cleared.
  */
function toggleShapeShifterSelections(
  currentSelections: Selection[],
  newSelections: Selection[],
  appendToList = false,
) {
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
  return currentSelections;
}
