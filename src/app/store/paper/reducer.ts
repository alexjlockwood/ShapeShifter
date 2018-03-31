import { CursorType, ToolMode } from 'app/model/paper';

import {
  CreatePathInfo,
  FocusedPathInfo,
  PaperActionTypes,
  PaperActions,
  RotateItemsInfo,
  SelectionBox,
  SnapGuideInfo,
  SplitCurveInfo,
  TooltipInfo,
  TransformPathsInfo,
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
  readonly rotateItemsInfo?: RotateItemsInfo;
  readonly transformPathsInfo?: TransformPathsInfo;
  readonly snapGuideInfo?: SnapGuideInfo;
  readonly tooltipInfo?: TooltipInfo;
  readonly canvasCursor?: CursorType;
}

export function buildInitialState(): State {
  return {
    zoomPanInfo: { zoom: 1, translation: { tx: 0, ty: 0 } },
    toolModeInfo: { toolMode: ToolMode.Selection },
  };
}

export function reducer(state = buildInitialState(), action: PaperActions): State {
  const { toolModeInfo } = state;
  switch (action.type) {
    case PaperActionTypes.SetZoomPanInfo:
      return { ...state, zoomPanInfo: action.zoomPanInfo };
    case PaperActionTypes.SetToolMode:
      // TODO: don't wipe out all of the other tool mode info here...
      return { ...state, toolModeInfo: { toolMode: action.toolMode } };
    case PaperActionTypes.SetSelectionBox:
      return { ...state, toolModeInfo: { ...toolModeInfo, selectionBox: action.selectionBox } };
    case PaperActionTypes.SetCreatePathInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, createPathInfo: action.createPathInfo } };
    case PaperActionTypes.SetSplitCurveInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, splitCurveInfo: action.splitCurveInfo } };
    case PaperActionTypes.SetFocusedPathInfo:
      const { focusedPathInfo } = action;
      return { ...state, toolModeInfo: { ...toolModeInfo, focusedPathInfo } };
    case PaperActionTypes.SetRotateItemsInfo:
      const { rotateItemsInfo } = action;
      return { ...state, toolModeInfo: { ...toolModeInfo, rotateItemsInfo } };
    case PaperActionTypes.SetTransformPathInfo:
      const { transformPathsInfo } = action;
      return { ...state, toolModeInfo: { ...toolModeInfo, transformPathsInfo } };
    case PaperActionTypes.SetSnapGuideInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, snapGuideInfo: action.snapGuideInfo } };
    case PaperActionTypes.SetTooltipInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, tooltipInfo: action.tooltipInfo } };
    case PaperActionTypes.SetCursorType:
      return { ...state, toolModeInfo: { ...toolModeInfo, canvasCursor: action.cursorType } };
  }
  return state;
}
