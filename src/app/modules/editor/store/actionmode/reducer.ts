import { ActionMode, ActionSource, Hover, Selection } from 'app/modules/editor/model/actionmode';

import { ActionModeActionTypes, ActionModeActions } from './actions';

export interface State {
  readonly mode: ActionMode;
  readonly hover: Hover;
  readonly selections: ReadonlyArray<Selection>;
  readonly pairedSubPaths: ReadonlySet<number>;
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

// TODO: move as much logic as possible from here into action mode service
export function reducer(state = buildInitialState(), action: ActionModeActions) {
  switch (action.type) {
    // Set the app mode during action mode.
    case ActionModeActionTypes.SetActionMode: {
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
    case ActionModeActionTypes.SetActionModeHover: {
      const { hover } = action.payload;
      return { ...state, hover };
    }

    // Set the path selections during action mode.
    case ActionModeActionTypes.SetActionModeSelections: {
      const { selections } = action.payload;
      return { ...state, selections };
    }

    // Set the currently paired subpaths.
    case ActionModeActionTypes.SetPairedSubPaths: {
      const pairedSubPaths = new Set(action.payload.pairedSubPaths);
      return { ...state, pairedSubPaths };
    }

    // Set the currently unpaired subpath in pair subpaths mode.
    case ActionModeActionTypes.SetUnpairedSubPath: {
      const { unpairedSubPath } = action.payload;
      return { ...state, unpairedSubPath };
    }
  }
  return state;
}
