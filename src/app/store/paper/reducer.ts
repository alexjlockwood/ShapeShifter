import { CanvasCursor, ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';

import * as actions from './actions';
import { FocusedEditPath } from './actions';

// TODO: fill/stroke color will need to be associated with the currently selected items as well
export interface State {
  readonly toolMode: ToolMode;
  readonly fillColor: string;
  readonly strokeColor: string;
  // TODO: should we store things in terms of viewport or physical pixels?
  readonly selectionBox: Readonly<{ from: Point; to: Point }>;
  readonly pathPreview: string;
  readonly focusedEditPath: FocusedEditPath;
  readonly canvasCursor: CanvasCursor;
}

export function buildInitialState(): State {
  return {
    toolMode: ToolMode.Selection,
    // TODO: figure out if these are appropriate initial values
    fillColor: '#000000',
    strokeColor: '#000000',
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
    case actions.SET_FILL_COLOR:
      return { ...state, fillColor: action.payload.fillColor };
    case actions.SET_STROKE_COLOR:
      return { ...state, strokeColor: action.payload.strokeColor };
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
