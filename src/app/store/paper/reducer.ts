import { CanvasCursor, ToolMode } from 'app/model/paper';

import { ActionType, Actions } from './actions';
import {
  CreatePathInfo,
  FocusedPathInfo,
  SelectionBox,
  SnapGuideInfo,
  SplitCurveInfo,
  TooltipInfo,
  ZoomPanInfo,
} from './actions';

export interface State {
  readonly toolMode: ToolMode;
  readonly selectionBox: SelectionBox | undefined;
  readonly createPathInfo: CreatePathInfo | undefined;
  readonly splitCurveInfo: SplitCurveInfo | undefined;
  readonly focusedPathInfo: FocusedPathInfo | undefined;
  readonly canvasCursor: CanvasCursor | undefined;
  readonly snapGuideInfo: SnapGuideInfo | undefined;
  readonly zoomPanInfo: ZoomPanInfo;
  readonly tooltipInfo: TooltipInfo | undefined;
}

export function buildInitialState(): State {
  return {
    toolMode: ToolMode.Selection,
    selectionBox: undefined,
    createPathInfo: undefined,
    splitCurveInfo: undefined,
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
      return { ...state, toolMode: action.toolMode };
    case ActionType.SetSelectionBox:
      return { ...state, selectionBox: action.selectionBox };
    case ActionType.SetCreatePathInfo:
      return { ...state, createPathInfo: action.createPathInfo };
    case ActionType.SetSplitCurveInfo:
      return { ...state, splitCurveInfo: action.splitCurveInfo };
    case ActionType.SetFocusedPathInfo:
      return { ...state, focusedPathInfo: action.focusedPathInfo };
    case ActionType.SetCanvasCursor:
      return { ...state, canvasCursor: action.canvasCursor };
    case ActionType.SetSnapGuideInfo:
      return { ...state, snapGuideInfo: action.snapGuideInfo };
    case ActionType.SetZoomPanInfo:
      return { ...state, zoomPanInfo: action.zoomPanInfo };
    case ActionType.SetTooltipInfo:
      return { ...state, tooltipInfo: action.tooltipInfo };
  }
  return state;
}
