import { ActionMode, ActionSource, Hover, Selection } from 'app/model/actionmode';

import * as actions from './actions';

export interface State {
  readonly mode: ActionMode;
  readonly hover: Hover;
  readonly selections: ReadonlyArray<Selection>;
  readonly pairedSubPaths: Set<number>;
  readonly unpairedSubPath: { readonly source: ActionSource; readonly subIdx: number };
}

export function buildInitialState() {
  return {
    mode: ActionMode.None,
    hover: undefined,
    selections: [],
    pairedSubPaths: new Set<number>(),
    unpairedSubPath: undefined,
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {
    // Set the app mode during action mode.
    case actions.SET_ACTION_MODE: {
      const { mode } = action.payload;
      if (mode === ActionMode.None) {
        return buildInitialState();
      }
      let { selections, pairedSubPaths, unpairedSubPath } = state;
      if (state.mode === ActionMode.PairSubPaths && mode !== state.mode) {
        // Reset the paired subpath state when leaving pair subpath mode.
        pairedSubPaths = new Set();
        unpairedSubPath = undefined;
      }
      if (mode === ActionMode.Selection && mode !== state.mode) {
        // Clear selections when switching back to selection mode.
        selections = [];
      }
      return { ...state, mode, selections, pairedSubPaths, unpairedSubPath };
    }

    // Set the hover mode during action mode.
    case actions.SET_ACTION_MODE_HOVER: {
      const { hover } = action.payload;
      return { ...state, hover };
    }

    // Set the path selections during action mode.
    case actions.SET_ACTION_MODE_SELECTIONS: {
      const { selections } = action.payload;
      return { ...state, selections };
    }

    // Set the currently paired subpaths.
    case actions.SET_PAIRED_SUBPATHS: {
      const pairedSubPaths = new Set(action.payload.pairedSubPaths);
      return { ...state, pairedSubPaths };
    }

    // Set the currently unpaired subpath in pair subpaths mode.
    case actions.SET_UNPAIRED_SUBPATH: {
      const { unpairedSubPath } = action.payload;
      return { ...state, unpairedSubPath };
    }
  }
  return state;
}
