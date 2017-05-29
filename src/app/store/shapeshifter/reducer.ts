import { CanvasType } from '../../CanvasType';
import { AppMode, Hover, HoverType, Selection, SelectionType } from '.';
import * as actions from './actions';
import * as _ from 'lodash';

export interface State {
  readonly blockId: string;
  readonly appMode: AppMode;
  readonly hover: Hover;
  readonly selections: ReadonlyArray<Selection>;
}

export function buildInitialState() {
  return {
    blockId: undefined,
    appMode: AppMode.Selection,
    hover: undefined,
    selections: [],
  } as State;
}

const initialState = buildInitialState();

export function reducer(state = initialState, action: actions.Actions) {
  switch (action.type) {

    // Enter shape shifter mode.
    case actions.ENTER_SHAPE_SHIFTER_MODE: {
      const { blockId } = action.payload;
      state = buildInitialState();
      return { ...state, blockId };
    }

    // Exit shape shifter mode.
    case actions.EXIT_SHAPE_SHIFTER_MODE: {
      return buildInitialState();
    }

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

    case actions.REVERSE_POINTS: {
      // const selections = this.selectionService.getSubPathSelections();
      // const { source } = selections[0];
      // const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
      // for (const { subIdx } of this.selectionService.getSubPathSelections()) {
      //   pathMutator.reverseSubPath(subIdx);
      // }
      // this.stateService.updateActivePath(source, pathMutator.build());
      // this.hoverService.resetAndNotify();
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
