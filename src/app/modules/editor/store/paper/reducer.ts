import { CursorType, ToolMode } from 'app/modules/editor/model/paper';

import {
  CreatePathInfo,
  EditPathInfo,
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

// Note that we should only ever store points in their viewport/local coordinates.
// We should never store points in coordinates that are dependent on the view.

export interface State {
  readonly zoomPanInfo: ZoomPanInfo;
  readonly toolModeInfo: ToolModeInfo;
  readonly cursorType: CursorType;
}

interface ToolModeInfo {
  readonly toolMode: ToolMode;
  readonly selectionBox?: SelectionBox;
  readonly createPathInfo?: CreatePathInfo;
  readonly splitCurveInfo?: SplitCurveInfo;
  readonly editPathInfo?: EditPathInfo;
  readonly rotateItemsInfo?: RotateItemsInfo;
  readonly transformPathsInfo?: TransformPathsInfo;
  readonly snapGuideInfo?: SnapGuideInfo;
  readonly tooltipInfo?: TooltipInfo;
  readonly hoveredLayerId?: string;
}

export function buildInitialState(): State {
  return {
    zoomPanInfo: { zoom: 1, translation: { tx: 0, ty: 0 } },
    toolModeInfo: { toolMode: ToolMode.Default },
    cursorType: CursorType.Default,
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
    case PaperActionTypes.SetEditPathInfo:
      const { editPathInfo } = action;
      return { ...state, toolModeInfo: { ...toolModeInfo, editPathInfo } };
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
      return { ...state, cursorType: action.cursorType };
    case PaperActionTypes.SetHoveredLayerId:
      const { hoveredLayerId } = action;
      return { ...state, toolModeInfo: { ...toolModeInfo, hoveredLayerId } };
  }
  return state;
}
