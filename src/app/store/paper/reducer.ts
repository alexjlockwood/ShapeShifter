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
  readonly zoomPanInfo: ZoomPanInfo;
  readonly toolModeInfo: ToolModeInfo;
}

interface ToolModeInfo {
  readonly toolMode: ToolMode;
  readonly selectionBox?: SelectionBox;
  readonly createPathInfo?: CreatePathInfo;
  readonly splitCurveInfo?: SplitCurveInfo;
  readonly focusedPathInfo?: FocusedPathInfo;
  readonly snapGuideInfo?: SnapGuideInfo;
  readonly tooltipInfo?: TooltipInfo;
  readonly canvasCursor?: CanvasCursor;
}

export function buildInitialState(): State {
  return {
    zoomPanInfo: { zoom: 1, translation: { tx: 0, ty: 0 } },
    toolModeInfo: { toolMode: ToolMode.Selection },
  };
}

export function reducer(state = buildInitialState(), action: Actions): State {
  const { toolModeInfo } = state;
  switch (action.type) {
    case ActionType.SetZoomPanInfo:
      return { ...state, zoomPanInfo: action.zoomPanInfo };
    case ActionType.SetToolMode:
      return { ...state, toolModeInfo: { toolMode: action.toolMode } };
    case ActionType.SetSelectionBox:
      return { ...state, toolModeInfo: { ...toolModeInfo, selectionBox: action.selectionBox } };
    case ActionType.SetCreatePathInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, createPathInfo: action.createPathInfo } };
    case ActionType.SetSplitCurveInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, splitCurveInfo: action.splitCurveInfo } };
    case ActionType.SetFocusedPathInfo:
      return {
        ...state,
        toolModeInfo: { ...toolModeInfo, focusedPathInfo: action.focusedPathInfo },
      };
    case ActionType.SetSnapGuideInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, snapGuideInfo: action.snapGuideInfo } };
    case ActionType.SetTooltipInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, tooltipInfo: action.tooltipInfo } };
    case ActionType.SetCanvasCursor:
      return { ...state, toolModeInfo: { ...toolModeInfo, canvasCursor: action.canvasCursor } };
  }
  return state;
}
