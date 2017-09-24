import { CanvasCursor, ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';
import { Action } from 'app/store/ngrx';

export enum ActionType {
  SetToolMode = '__paper__SET_TOOL_MODE',
  SetSelectionBox = '__paper__SET_SELECTION_BOX',
  SetPathOverlayInfo = '__paper__SET_PATH_OVERLAY',
  SetFocusedPathInfo = '__paper__SET_FOCUSED_PATH_INFO',
  SetCanvasCursor = '__paper__SET_CANVAS_CURSOR',
  SetSnapGuideInfo = '__paper__SET_SNAP_GUIDE_INFO',
  SetZoomPanInfo = '__paper__SET_ZOOM_PAN_INFO',
  SetTooltipInfo = '__paper__SET_TOOLTIP_INFO',
}

export class SetToolMode implements Action {
  readonly type = ActionType.SetToolMode;
  readonly payload: { toolMode: ToolMode };
  constructor(toolMode: ToolMode) {
    this.payload = { toolMode };
  }
}

export class SetSelectionBox implements Action {
  readonly type = ActionType.SetSelectionBox;
  readonly payload: { selectionBox: { from: Point; to: Point } };
  constructor(selectionBox: { from: Point; to: Point } | undefined) {
    this.payload = { selectionBox };
  }
}

export class SetPathOverlayInfo implements Action {
  readonly type = ActionType.SetPathOverlayInfo;
  readonly payload: { pathOverlayInfo: PathOverlayInfo };
  constructor(pathOverlayInfo: PathOverlayInfo) {
    this.payload = { pathOverlayInfo };
  }
}

export class SetFocusedPathInfo implements Action {
  readonly type = ActionType.SetFocusedPathInfo;
  readonly payload: { focusedPathInfo: FocusedPathInfo };
  constructor(focusedPathInfo: FocusedPathInfo) {
    this.payload = { focusedPathInfo };
  }
}

export class SetCanvasCursor implements Action {
  readonly type = ActionType.SetCanvasCursor;
  readonly payload: { canvasCursor: CanvasCursor };
  constructor(canvasCursor: CanvasCursor) {
    this.payload = { canvasCursor };
  }
}

export class SetSnapGuideInfo implements Action {
  readonly type = ActionType.SetSnapGuideInfo;
  readonly payload: { snapGuideInfo: SnapGuideInfo };
  constructor(snapGuideInfo: SnapGuideInfo) {
    this.payload = { snapGuideInfo };
  }
}

export class SetZoomPanInfo implements Action {
  readonly type = ActionType.SetZoomPanInfo;
  readonly payload: { zoomPanInfo: ZoomPanInfo };
  constructor(zoomPanInfo: ZoomPanInfo) {
    this.payload = { zoomPanInfo };
  }
}

export class SetTooltipInfo implements Action {
  readonly type = ActionType.SetTooltipInfo;
  readonly payload: { tooltipInfo: TooltipInfo };
  constructor(tooltipInfo: TooltipInfo) {
    this.payload = { tooltipInfo };
  }
}

export type Actions =
  | SetToolMode
  | SetSelectionBox
  | SetPathOverlayInfo
  | SetFocusedPathInfo
  | SetCanvasCursor
  | SetSnapGuideInfo
  | SetZoomPanInfo
  | SetTooltipInfo;

export interface SelectionBox {
  readonly from: Point;
  readonly to: Point;
}

export interface PathOverlayInfo {
  readonly pathData: string;
  readonly strokeColor: string;
}

export interface FocusedPathInfo {
  readonly layerId: string;
  readonly selectedSegments: ReadonlySet<number>;
  readonly visibleHandleIns: ReadonlySet<number>;
  readonly visibleHandleOuts: ReadonlySet<number>;
  readonly selectedHandleIn: number;
  readonly selectedHandleOut: number;
}

export type Line = Readonly<{ from: Point; to: Point }>;
export type Guide = ReadonlyArray<Line>;
export type Ruler = Readonly<{ line: Line; delta: number }>;

export interface SnapGuideInfo {
  readonly guides: ReadonlyArray<Line>;
  readonly rulers: ReadonlyArray<Ruler>;
}

export interface ZoomPanInfo {
  readonly zoom: number;
  readonly translation: Readonly<{ tx: number; ty: number }>;
}

export interface TooltipInfo {
  readonly point: Point;
  readonly label: string;
}
