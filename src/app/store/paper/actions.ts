import { CanvasCursor, ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';
import { Action } from 'app/store/ngrx';

export enum ActionType {
  SetToolMode = '__paper__SET_TOOL_MODE',
  SetSelectionBox = '__paper__SET_SELECTION_BOX',
  SetCreatePathInfo = '__paper__SET_CREATE_PATH_INFO',
  SetSplitCurveInfo = '__paper__SET_SPLIT_CURVE_INFO',
  SetFocusedPathInfo = '__paper__SET_FOCUSED_PATH_INFO',
  SetCanvasCursor = '__paper__SET_CANVAS_CURSOR',
  SetSnapGuideInfo = '__paper__SET_SNAP_GUIDE_INFO',
  SetZoomPanInfo = '__paper__SET_ZOOM_PAN_INFO',
  SetTooltipInfo = '__paper__SET_TOOLTIP_INFO',
}

export class SetToolMode implements Action {
  readonly type = ActionType.SetToolMode;
  constructor(readonly toolMode: ToolMode) {}
}

export class SetSelectionBox implements Action {
  readonly type = ActionType.SetSelectionBox;
  constructor(readonly selectionBox: SelectionBox | undefined) {}
}

export class SetCreatePathInfo implements Action {
  readonly type = ActionType.SetCreatePathInfo;
  constructor(readonly createPathInfo: CreatePathInfo | undefined) {}
}

export class SetSplitCurveInfo implements Action {
  readonly type = ActionType.SetSplitCurveInfo;
  constructor(readonly splitCurveInfo: SplitCurveInfo | undefined) {}
}

export class SetFocusedPathInfo implements Action {
  readonly type = ActionType.SetFocusedPathInfo;
  constructor(readonly focusedPathInfo: FocusedPathInfo | undefined) {}
}

export class SetCanvasCursor implements Action {
  readonly type = ActionType.SetCanvasCursor;
  constructor(readonly canvasCursor: CanvasCursor | undefined) {}
}

export class SetSnapGuideInfo implements Action {
  readonly type = ActionType.SetSnapGuideInfo;
  constructor(readonly snapGuideInfo: SnapGuideInfo | undefined) {}
}

export class SetZoomPanInfo implements Action {
  readonly type = ActionType.SetZoomPanInfo;
  constructor(readonly zoomPanInfo: ZoomPanInfo) {}
}

export class SetTooltipInfo implements Action {
  readonly type = ActionType.SetTooltipInfo;
  constructor(readonly tooltipInfo: TooltipInfo | undefined) {}
}

export type Actions =
  | SetToolMode
  | SetSelectionBox
  | SetCreatePathInfo
  | SetSplitCurveInfo
  | SetFocusedPathInfo
  | SetCanvasCursor
  | SetSnapGuideInfo
  | SetZoomPanInfo
  | SetTooltipInfo;

export interface SelectionBox {
  readonly from: Point;
  readonly to: Point;
}

export interface CreatePathInfo {
  readonly pathData: string;
  readonly strokeColor: string;
}

export type Segment = Readonly<{ point: Point; handleIn: Point; handleOut: Point }>;

export interface SplitCurveInfo {
  readonly splitPoint: Point;
  readonly segment1: Segment;
  readonly segment2: Segment;
}

export interface FocusedPathInfo {
  // TODO: layerId? itemId? id?
  readonly layerId: string;
  // TODO: suffix these variables with 'index'
  readonly selectedSegments: ReadonlySet<number>;
  readonly visibleHandleIns: ReadonlySet<number>;
  readonly visibleHandleOuts: ReadonlySet<number>;
  readonly selectedHandleIn: number;
  readonly selectedHandleOut: number;
}

export type Line = Readonly<{ from: Point; to: Point }>;
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
