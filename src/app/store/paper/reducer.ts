import { CanvasCursor, ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';

import * as actions from './actions';
import { FocusedPathInfo, PathOverlayInfo } from './actions';

export interface State {
  readonly toolMode: ToolMode;
  readonly selectionBox: Readonly<{ from: Point; to: Point }>;
  readonly pathOverlayInfo: PathOverlayInfo;
  readonly focusedPathInfo: FocusedPathInfo;
  readonly canvasCursor: CanvasCursor;
}

export function buildInitialState(): State {
  return {
    toolMode: ToolMode.Selection,
    selectionBox: undefined,
    pathOverlayInfo: undefined,
    focusedPathInfo: undefined,
    canvasCursor: undefined,
  };
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {
    case actions.SET_TOOL_MODE:
      return { ...state, toolMode: action.payload.toolMode };
    case actions.SET_SELECTION_BOX:
      return { ...state, selectionBox: action.payload.selectionBox };
    case actions.SET_PATH_OVERLAY_INFO:
      return { ...state, pathOverlayInfo: action.payload.pathOverlayInfo };
    case actions.SET_FOCUSED_PATH_INFO:
      return { ...state, focusedPathInfo: action.payload.focusedPathInfo };
    case actions.SET_CANVAS_CURSOR:
      return { ...state, canvasCursor: action.payload.canvasCursor };
  }
  return state;
}
