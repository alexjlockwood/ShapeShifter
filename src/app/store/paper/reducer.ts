import { CanvasCursor, ToolMode } from 'app/model/paper';

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
  TransformPathInfo,
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
  readonly transformPathInfo?: TransformPathInfo;
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
      return {
        ...state,
        toolModeInfo: { ...toolModeInfo, focusedPathInfo: action.focusedPathInfo },
      };
    case PaperActionTypes.SetRotateItemsInfo:
      return {
        ...state,
        toolModeInfo: { ...toolModeInfo, rotateItemsInfo: action.rotateItemsInfo },
      };
    case PaperActionTypes.SetTransformPathInfo:
      return {
        ...state,
        toolModeInfo: { ...toolModeInfo, transformPathInfo: action.transformPathInfo },
      };
    case PaperActionTypes.SetSnapGuideInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, snapGuideInfo: action.snapGuideInfo } };
    case PaperActionTypes.SetTooltipInfo:
      return { ...state, toolModeInfo: { ...toolModeInfo, tooltipInfo: action.tooltipInfo } };
    case PaperActionTypes.SetCanvasCursor:
      return { ...state, toolModeInfo: { ...toolModeInfo, canvasCursor: action.canvasCursor } };
  }
  return state;
}
