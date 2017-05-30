import { CanvasType } from '../../CanvasType';
import {
  Hover,
  HoverType,
  Selection,
  SelectionType,
  ShapeShifterMode,
} from '.';
import * as actions from './actions';
import * as _ from 'lodash';

export interface State {
  readonly blockId: string;
  readonly mode: ShapeShifterMode;
  readonly hover: Hover;
  readonly selections: ReadonlyArray<Selection>;
}

export function buildInitialState() {
  return {
    blockId: undefined,
    mode: ShapeShifterMode.Selection,
    hover: undefined,
    selections: [],
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {

    // Set the currently active block ID, enabling shape shifter mode.
    case actions.SET_ACTIVE_PATH_BLOCK_ID: {
      const { blockId } = action.payload;
      return { ...buildInitialState(), blockId };
    }

    // Clear the currently active block ID, ending shape shifter mode.
    case actions.CLEAR_ACTIVE_PATH_BLOCK_ID: {
      return buildInitialState();
    }

    // Set the app mode during shape shifter mode.
    case actions.SET_SHAPE_SHIFTER_MODE: {
      const { mode } = action.payload;
      return { ...state, mode };
    }

    // Set the hover mode during shape shifter mode.
    case actions.SET_PATH_HOVER: {
      const { hover } = action.payload;
      return { ...state, hover };
    }

    // Set the path selections during shape shifter mode.
    case actions.SET_PATH_SELECTIONS: {
      const { selections } = action.payload;
      return { ...state, selections };
    }

    // Toggle a subpath selection.
    case actions.TOGGLE_SUBPATH_SELECTION: {
      const { source, subIdx } = action.payload;
      let selections = state.selections.slice();
      _.remove(selections, s => s.type !== SelectionType.SubPath && s.source !== source);
      selections = toggleSelections(
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
      selections = toggleSelections(
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
      selections = toggleSelections(
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
function toggleSelections(
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
