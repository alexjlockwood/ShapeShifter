import { CanvasCursor, ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';

import * as actions from './actions';
import { FocusedEditPath } from './actions';

export interface State {
  readonly toolMode: ToolMode;
  // TODO: should we store things in terms of viewport or physical pixels?
  readonly selectionBox: Readonly<{ from: Point; to: Point }>;
  readonly pathPreview: string;
  readonly focusedEditPath: FocusedEditPath;
  readonly canvasCursor: CanvasCursor;
}

export function buildInitialState(): State {
  return {
    toolMode: ToolMode.Selection,
    selectionBox: undefined,
    pathPreview: undefined,
    focusedEditPath: undefined,
    canvasCursor: undefined,
  };
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {
    case actions.SET_TOOL_MODE:
      return { ...state, toolMode: action.payload.toolMode };
    case actions.SET_SELECTION_BOX:
      return { ...state, selectionBox: action.payload.selectionBox };
    case actions.SET_PATH_PREVIEW:
      return { ...state, pathPreview: action.payload.pathData };
    case actions.SET_FOCUSED_EDIT_PATH:
      return { ...state, focusedEditPath: action.payload.focusedEditPath };
    case actions.SET_CANVAS_CURSOR:
      return { ...state, canvasCursor: action.payload.canvasCursor };
  }
  return state;
}
