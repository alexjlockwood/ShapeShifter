import { CanvasCursor, ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';

import { ActionType, Actions } from './actions';
import {
  FocusedPathInfo,
  PathOverlayInfo,
  SelectionBox,
  SnapGuideInfo,
  TooltipInfo,
  ZoomPanInfo,
} from './actions';

export interface State {
  readonly toolMode: ToolMode;
  readonly selectionBox: SelectionBox;
  readonly tooltipInfo: TooltipInfo;
  readonly pathOverlayInfo: PathOverlayInfo;
  readonly focusedPathInfo: FocusedPathInfo;
  readonly canvasCursor: CanvasCursor;
  readonly snapGuideInfo: SnapGuideInfo;
  readonly zoomPanInfo: ZoomPanInfo;
}

export function buildInitialState(): State {
  return {
    toolMode: ToolMode.Selection,
    selectionBox: undefined,
    pathOverlayInfo: undefined,
    focusedPathInfo: undefined,
    canvasCursor: undefined,
    snapGuideInfo: undefined,
    zoomPanInfo: { zoom: 1, translation: { tx: 0, ty: 0 } },
    tooltipInfo: undefined,
  };
}

export function reducer(state = buildInitialState(), action: Actions): State {
  switch (action.type) {
    case ActionType.SetToolMode:
      return { ...state, toolMode: action.payload.toolMode };
    case ActionType.SetSelectionBox:
      return { ...state, selectionBox: action.payload.selectionBox };
    case ActionType.SetPathOverlayInfo:
      return { ...state, pathOverlayInfo: action.payload.pathOverlayInfo };
    case ActionType.SetFocusedPathInfo:
      return { ...state, focusedPathInfo: action.payload.focusedPathInfo };
    case ActionType.SetCanvasCursor:
      return { ...state, canvasCursor: action.payload.canvasCursor };
    case ActionType.SetSnapGuideInfo:
      return { ...state, snapGuideInfo: action.payload.snapGuideInfo };
    case ActionType.SetZoomPanInfo:
      return { ...state, zoomPanInfo: action.payload.zoomPanInfo };
    case ActionType.SetTooltipInfo:
      return { ...state, tooltipInfo: action.payload.tooltipInfo };
  }
  return state;
}
